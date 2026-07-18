# Framework7 路由体系迁移到 Vue3 + Vuetify 工程的可行性分析与设计方案

## 结论

不建议直接移植 F7 的 `core/modules/router` 源码，建议**"取思想、弃实现"**，用 Vue 3 原生能力（`<Transition>`、`reactive`、`provide/inject`、`<KeepAlive>`）重新实现一套轻量路由 + 过渡动画层。

原因：F7 core router 与 Dom7（类 jQuery DOM 库）、`Framework7Class`（自制事件系统）、`ssr-window`、以及 F7 自己的 Modal/Tabs UI 组件强耦合。硬搬过来会在 Vuetify 工程里引入第二套 DOM 操作范式和第二套组件体系，长期维护成本高，还有 `.page`/`.view` 这类全局 class 命名和 Vuetify 样式冲突的风险。真正值得复用的是它的**设计范式**：状态机式过渡动画、历史栈管理、生命周期钩子命名习惯——这些可以完全用 Vue 3 原生方式重写，反而更简单。

---

## 一、逐项拆解：哪些能直接抄、哪些必须重写

| F7 组成部分 | 依赖 | 能否直接复用 | 建议 |
|---|---|---|---|
| `path-to-regexp` 路由匹配 | 独立 npm 包 | 可直接用 | F7 本身也是引入这个包，跟框架无关，直接装 |
| `flattenRoutes`/`findMatchingRoute` 算法 | 纯函数，无框架依赖 | 思路可搬 | 逻辑简单，重新用 TS 写一遍即可（去掉 tabs/master-detail 等不需要的分支） |
| `Router` 类（历史栈、currentRoute） | `Framework7Class`（自制 events）、Dom7 | 部分 | 历史栈的**思路**（`history` 数组、`browserHistory` 同步）值得抄，实现改用 Vue `reactive` |
| `f7routers` 注册表 + `*RouterDidUpdate` 事件握手 | 为了桥接"非响应式 Dom7 操作"与"Vue 响应式渲染" | 不需要 | 这套机制存在的唯一原因是 F7 core router 假设同步 DOM 插入。如果路由本身就是 Vue 原生写的、天生响应式，这层桥接直接消失，是最大的简化点 |
| Page 过渡动画（`page-current/previous/next` + `animationend`） | Dom7 + CSS class | CSS 可抄，JS 不用抄 | keyframes 直接复制，JS 部分用 Vue `<Transition>` 原生实现，比手写 class 增删 + `animationend` 监听简单得多 |
| iOS swipe-back 手势 | 大段 touch 事件计算 | 不需要 | 明确不要 iOS，这部分可以整个丢弃 |
| Tabs 横滑/Swiper 联动 | Dom7 + 可选 Swiper | 不需要 | Vuetify 的 `<v-window>` 已经原生实现了等价效果，没必要重造 |
| Modal 打开关闭 + 路由反向同步 | F7 自己的 Modal 组件 | 思路可抄 | "UI 关闭反向调用 `router.back()`" 这个设计模式值得抄，具体用 Vuetify `<v-dialog v-model>` 事件实现 |
| `keepAlive` | 手写 DOM 挪位 | 不需要 | Vue 3 内置 `<KeepAlive>` 就是标准解法 |

---

## 二、迁移设计方案

### 1. 路由匹配层（纯逻辑，可完全独立于 UI）

```ts
import { pathToRegexp } from 'path-to-regexp';

interface RouteConfig {
  path: string;
  name?: string;
  component: Component | (() => Promise<Component>);
  keepAlive?: boolean;
  meta?: { modal?: boolean };
}

function matchRoute(routes: RouteConfig[], url: string) {
  const path = url.split('?')[0];
  for (const route of routes) {
    const keys: any[] = [];
    const matched = pathToRegexp(route.path, keys).exec(path);
    if (matched) {
      const params = Object.fromEntries(keys.map((k, i) => [k.name, matched[i + 1]]));
      return { route, params, path, url };
    }
  }
  return undefined;
}
```

比 F7 的 `flattenRoutes` 简单很多，因为不需要 `tabs`/`detailRoutes`/`master` 这些为多视图平板布局设计的分支（除非后续要做平板双栏）。

### 2. 响应式页面栈（替代 `Router` 类 + `f7routers`）

```ts
export function createPageStack(routes: RouteConfig[]) {
  const stack = reactive<{ id: number; matched: ReturnType<typeof matchRoute>; direction: 'forward' | 'backward' }[]>([]);
  let uid = 0;

  function push(url: string) {
    const matched = matchRoute(routes, url);
    if (!matched) return;
    stack.push({ id: ++uid, matched, direction: 'forward' });
    history.pushState({ stackLen: stack.length }, '', url);
  }
  function pop() {
    if (stack.length <= 1) return;
    stack[stack.length - 1].direction = 'backward';
    stack.pop();
    history.back();
  }

  window.addEventListener('popstate', () => {
    if (history.state?.stackLen < stack.length) pop();
  });

  return { stack, push, pop };
}
```

这里天然就是 Vue 的 `reactive` 数组，不需要 F7 里"先注册进全局表、等 DOM 更新事件、再反查"那一整套——因为栈本身就是响应式源头，`<PageView>` 组件直接 watch 它就行，没有"核心引擎不知道 Vue 何时渲染完"的问题（那个问题只存在于"外部非响应式引擎 + Vue 渲染"的组合场景）。用 `provide('pageStack', stack)` 分发给子孙组件，替代 `routerId`/`el` 双 key 查找。

### 3. `<PageView>` 容器（替代 `<f7-view>`）

关键洞察：F7 forward 动画本质是"旧页面和新页面同时存在、同时播放各自的位移动画"，这正是 Vue `<Transition>`（非 `mode="out-in"`）的原生行为——enter 和 leave 默认就是同时进行的。不需要手写 `page-current/next/previous` 三态 class 和 `animationend` 监听，Vue 会自动调用 `@after-enter`/`@after-leave`。

```vue
<template>
  <div class="page-view">
    <Transition :name="topDirection === 'forward' ? 'page-fwd' : 'page-bwd'">
      <component
        :is="resolveComponent(top.matched)"
        :key="top.id"
        v-bind="top.matched.params"
        @after-enter="onEntered"
        @after-leave="onLeft"
      />
    </Transition>
  </div>
</template>
```

因为过渡期间需要"旧页面还留在原地一小段时间"，用 `position: absolute; inset: 0` 让新旧两页在同一容器内堆叠即可（和 F7 `.page { position: absolute }` 思路一致）。

### 4. 动画 CSS —— 只保留 Android(MD)，复用 F7 的 keyframes 思路

```css
.page-view { position: relative; overflow: hidden; height: 100%; }
.page-view > * { position: absolute; inset: 0; }

/* 前进：新页从右侧盖入，旧页轻微左移 */
.page-fwd-enter-active {
  animation: md-page-next-to-current 400ms cubic-bezier(0, 0.8, 0.3, 1) forwards;
}
.page-fwd-leave-active {
  animation: md-page-current-to-previous 400ms cubic-bezier(0, 0.8, 0.3, 1) forwards;
}
@keyframes md-page-next-to-current {
  from { transform: translate3d(100%, 0, 0); }
  to   { transform: translate3d(0, 0, 0); }
}
@keyframes md-page-current-to-previous {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-24px, 0, 0); }
}

/* 后退：反向 */
.page-bwd-enter-active {
  animation: md-page-previous-to-current 200ms cubic-bezier(0, 1, 0.8, 1) forwards;
}
.page-bwd-leave-active {
  animation: md-page-current-to-next 200ms cubic-bezier(0, 1, 0.8, 1) forwards,
             md-fade-out 200ms forwards;
}
@keyframes md-page-previous-to-current {
  from { transform: translate3d(-24px, 0, 0); }
  to   { transform: translate3d(0, 0, 0); }
}
@keyframes md-page-current-to-next {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(100%, 0, 0); }
}
@keyframes md-fade-out {
  from { opacity: 1; } to { opacity: 0; }
}
```

> 原版用 `128px` 表示新页起始偏移，是配合 F7 自己的页面宽度体系；换算成 `100%`（相对自身容器宽度）更符合 Vuetify 里任意容器尺寸的场景，视觉效果等价。

丢弃的部分：iOS 分支、`router-transition-custom`（cover/dive/parallax/flip/push/fade/circle 等具名过渡）、`animateCustom`、RTL 镜像——这些在只做 Android 单主题时全部是死代码。

### 5. Tabs：不重造，直接用 Vuetify `<v-window>`

```vue
<v-window v-model="activeTab">
  <v-window-item value="home"><PageView :stack="homeStack" /></v-window-item>
  <v-window-item value="profile"><PageView :stack="profileStack" /></v-window-item>
</v-window>
```

`<v-window>` 自带横滑过渡动画，效果上等价于 F7 `tabs-animated-wrap`，且是 Vuetify 官方维护、和 Material 规范对齐，没有理由重写 F7 的 `tabs.js`。每个 tab 内部若要有独立浏览栈，就在 `v-window-item` 里各自塞一个 `<PageView>`，用各自的 `createPageStack()` 实例。

### 6. Modal（如果需要 URL 可寻址的弹层）：抄"反向同步"这个设计模式，用 Vuetify 组件实现

```vue
<v-dialog
  :model-value="isDialogRoute"
  @update:model-value="(v) => !v && pageStack.pop()"
>
  <component :is="dialogRoute?.matched.route.component" />
</v-dialog>
```

这正是移植了 F7 `modal.js` 里"`modalClose` 事件里 `if (!modal.closeByRouter) router.back()`"这条设计——用户点击遮罩关闭弹层时，要把这个"UI 事件"同步回路由状态，而不是让 URL 和实际显示脱节。Vuetify 的 `v-model` 天生就是这个事件通道，不需要重新发明。

### 7. keepAlive：直接用 Vue 内置组件

```vue
<KeepAlive :include="keepAliveNames">
  <component :is="..." :key="..." />
</KeepAlive>
```

F7 手写的 `keepAliveData`/DOM 挪位逻辑是因为它没有虚拟 DOM 层可以依赖，Vue 3 完全不需要移植这部分。

---

## 三、总体工作量与收益评估

- **需要新写**：路由匹配（约 50 行）、响应式页面栈（约 80 行）、`<PageView>` 组件（约 60 行）、MD 动画 CSS（约 40 行）。整体是"迷你版 vue-router + 一个过渡动画组件"的量级。
- **直接省掉的依赖**：Dom7、`Framework7Class`、`ssr-window`、F7 自带的 Tabs/Modal/Panel UI 组件、iOS 相关全部代码、`f7routers` 注册表整套桥接机制。
- **风险点**：如果后续需要"平板宽屏 master-detail 双栏"这种复杂布局，F7 那套 `masterDetailBreakpoint` 逻辑确实复杂，届时可单独评估要不要部分借鉴；目前的诉求（单一 Android 动画、Vuetify 组件）用不到这块。

---

## 四、验证工程

已在仓库根目录新建 `vue3-refactor-f7router/` 独立 Vite + Vue3 + Vuetify 工程，落地了上述方案的最小可运行版本：

- `src/router/matchRoute.ts` —— 路由匹配（`path-to-regexp`）
- `src/router/createPageStack.ts` —— 响应式页面栈（push/back + 浏览器历史同步）
- `src/components/PageView.vue` —— 过渡动画容器（Vue `<Transition>` + MD keyframes）
- `src/pages/*.vue` —— 演示页面（配合 Vuetify 组件）
- `src/App.vue` —— 顶层挂载，包含前进/后退操作按钮用于手动验证动画效果

运行方式：

```bash
cd vue3-refactor-f7router
npm install
npm run dev
```
