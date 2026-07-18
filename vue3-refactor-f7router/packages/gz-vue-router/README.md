# gz-vue-router

Vue 3 下的轻量路由库，API 形状对齐 vue-router（`push`/`replace`/`back`/`go`/`forward`、`useRouter`/`useRoute`、导航守卫、嵌套路由），额外内置了 Framework7 风格的"页面栈 + Android(Material Design) 滑动过渡动画"和"可叠加多层的 URL 可寻址弹层栈"。

不依赖 Framework7、不依赖任何特定 UI 库（包括渲染弹层用的 `<GZModalView>` 也是自己实现的遮罩+卡片，不依赖 Vuetify 的 `<v-dialog>`）——示例工程搭配的是 Vuetify 做业务组件（`v-card`/`v-btn` 等），路由本身和 UI 库完全解耦。

> 这份文档讲"怎么用"。想了解各个文件的分工和一次导航/渲染背后代码的执行顺序，看 [ARCHITECTURE.md](./ARCHITECTURE.md)；想了解某个设计为什么长这样、踩过什么坑，看 [CLAUDE.md](./CLAUDE.md)。

## 这是什么、为什么会有这个包

它的设计动机来自对 Framework7 `core/modules/router` 的迁移分析：F7 的路由引擎能做出很像原生 App 的页面切换动画（前进新页从右侧滑入、后退当前页滑出淡出、上一页若隐若现地露出一角），但这套引擎是建立在 Dom7（类 jQuery 的 DOM 操作库）和 F7 自己的事件系统之上的，直接搬进一个纯 Vue 3 + Vuetify 工程会背上一整套非 Vue 原生的依赖。

`gz-vue-router` 保留了同样的动画设计范式（状态机式的 forward/backward 过渡、页面栈、方向感知），但完全用 Vue 3 原生能力重新实现（`<TransitionGroup>`、`reactive`、`provide`/`inject`），同时把 API 形状向 vue-router 靠拢，让熟悉 vue-router 的开发者可以直接上手。

## 快速上手

工程内以 npm workspace 方式引用（`packages/*`），直接消费源码，不需要单独构建这个包。

**1. 定义路由表**

```ts
// src/router/routes.ts
import type { RouteRecordRaw } from 'gz-vue-router';
import HomePage from '../pages/HomePage.vue';
import DetailPage from '../pages/DetailPage.vue';
import SettingsDialog from '../pages/SettingsDialog.vue';
import ConfirmDialog from '../pages/ConfirmDialog.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomePage, meta: { title: '首页' } },
  {
    path: '/detail/:id',
    name: 'detail',
    component: DetailPage,
    // 路由独享守卫：只对这一条路由生效
    beforeEnter: (to) => {
      if (Number(to.params.id) > 500) return '/'; // 返回字符串 = 重定向
      return true; // 或 undefined，都表示放行
    },
  },
  // meta.modal: true —— 声明为"URL 可寻址的弹层"，不会被当成全屏页面
  {
    path: '/settings',
    name: 'settings',
    component: SettingsDialog,
    meta: { modal: true, modalStyle: { maxWidth: '480px' } },
  },
  // 弹层可以叠加：这一条是从 settings 弹层内部 push/replace 出去的第二层弹层
  { path: '/settings/confirm', name: 'confirm', component: ConfirmDialog, meta: { modal: true } },
];
```

**2. 创建路由实例，注册全局守卫**

```ts
// src/router/index.ts
import { createGZRouter } from 'gz-vue-router';
import { routes } from './routes';

export const router = createGZRouter({
  routes,
  initialUrl: '/', // 找不到上一页历史时的兜底目标
  syncBrowserHistory: true, // 同步到浏览器地址栏/前进后退按钮
});

router.beforeEach((to, from) => {
  console.info(`navigating: ${from.fullPath} -> ${to.fullPath}`);
});

router.afterEach((to) => {
  if (to.meta.title) document.title = `${to.meta.title} · MyApp`;
});
```

**3. 安装插件**

```ts
// src/main.ts
import { createApp } from 'vue';
import 'gz-vue-router/styles/transitions.css'; // 默认的 Android/MD 过渡动画
import { router } from './router';
import App from './App.vue';

createApp(App).use(router).mount('#app');
```

**4. 渲染视图 + 弹层出口**

```vue
<!-- App.vue -->
<script setup lang="ts">
import { GZRouterView, GZModalView } from 'gz-vue-router';
</script>

<template>
  <GZRouterView />
  <GZModalView />
</template>
```

`<GZModalView>` 不需要任何 props，会自动渲染 `router.modalStack` 里当前叠着的所有弹层（可能是 0 层、1 层或多层）。

**5. 页面组件里使用**

```vue
<script setup lang="ts">
import { useRouter, useRoute, onBeforeRouteLeave, onBeforeRouteUpdate } from 'gz-vue-router';

const router = useRouter();
const route = useRoute(); // 响应式对象，直接 route.params.id 访问，无需 .value

function openDetail(id: string) {
  router.push({ name: 'detail', params: { id } }); // 也可以直接传字符串 '/detail/1'
}

// 离开确认：返回 false 会取消这次导航（弹层里的组件同样可以调用，见下文"弹层栈"）
onBeforeRouteLeave(() => {
  if (hasUnsavedChanges.value) return window.confirm('有未保存的更改，确定要离开吗？');
});

// 同一个组件被复用、只是路由参数变化时触发（对应 router.replace() 命中同组件的场景）
onBeforeRouteUpdate((to) => {
  console.info('params changed to', to.params);
});
</script>
```

## API 参考

### `createGZRouter(options): GZRouter`

| 参数 | 说明 |
|---|---|
| `routes` | `RouteRecordRaw[]`，路由配置表 |
| `initialUrl` | 应用默认路由（找不到上一页历史/弹层背景页时的兜底目标），默认 `'/'` |
| `syncBrowserHistory` | 是否把内部页面栈/弹层栈同步到浏览器地址栏/前进后退按钮 |

### `RouteRecordRaw`

| 字段 | 说明 |
|---|---|
| `path` / `name` / `component` | 同 vue-router |
| `meta.modal` | `true` 表示这是一条弹层路由（见下文"弹层栈"） |
| `meta.modalStyle` | `<GZModalView>` 渲染这条弹层时，附加在弹层卡片容器上的行内样式（比如 `{ maxWidth: '480px' }`） |
| `meta.title` | 仅作为约定字段，本身不做任何事，配合 `afterEach` 可实现标题同步等副作用 |
| `beforeEnter` | 路由独享守卫，进入这条路由、或进入它的任意子孙路由时都会触发（见下文"嵌套路由"） |
| `children` | 子路由数组，见下文"嵌套路由" |

### `GZRouter`（`useRouter()` 拿到的实例）

| 成员 | 说明 |
|---|---|
| `currentRoute` | 响应式的当前路由对象（`reactive`，不是 `ref`，字段直接访问） |
| `push(to)` / `replace(to)` | `to` 可以是字符串路径，也可以是 `{ name, params, query }` |
| `back(fallbackUrl?)` | 优先应用内返回；没有则走真实浏览器历史；两者都没有就跳到 `fallbackUrl`（默认 `initialUrl`） |
| `forward()` / `go(delta)` | 等价于 `history.forward()` / `history.go(delta)` |
| `beforeEach(guard)` / `afterEach(hook)` | 注册全局守卫/钩子，返回一个注销函数 |
| `stack` / `modalStack` / `direction` / `canGoBack` | gz-vue-router 特有的扩展状态，见下文 |

`stack`/`modalStack`/`direction`/`canGoBack` 是 vue-router 没有的概念，专门驱动 `<GZRouterView>` 的页面过渡动画和 `<GZModalView>` 的弹层栈：vue-router 只有单一的"当前路由视图"，没有"页面栈 + 可叠加的弹层栈"的设计。**不要**依赖 `app.config.globalProperties.$router`/`$route`——这个包故意不注册它们（原因见下文"已知限制"）。

### 导航守卫

守卫签名：`(to, from) => 返回值`，也兼容 `(to, from, next) => void` 的旧写法。返回值含义：

- `undefined`/`true`：放行
- `false`：取消本次导航
- 字符串或 `{name, params, query}`：重定向

优先级（同一次导航里的执行顺序）：**离开守卫（onBeforeRouteLeave/onBeforeRouteUpdate）→ 全局 `beforeEach` → 目标路由的 `beforeEnter`**，全部通过才会真正修改页面栈/弹层栈/历史记录，然后触发全局 `afterEach`。

重定向目标如果就是用户当前已经停留的页面，不会产生任何导航效果（不入栈、不播放过渡动画）——只有重定向到一个**不同**的页面时才会像一次正常的 `push` 一样播放过渡动画。

### `onBeforeRouteLeave` / `onBeforeRouteUpdate`

必须在页面组件的 `setup()` 内调用。**页面级路由（`<GZRouterView>`）和弹层路由（`<GZModalView>`）里的组件都支持**，两者都会给渲染出来的组件套一层 `EntryProvider` 提供必要的上下文。

## 弹层栈（`meta.modal`）

声明为弹层的路由不会进入页面栈变成一个全屏页面，而是叠加渲染在 `<GZModalView>` 里，支持多层：

- **`push()` 打开弹层**：如果当前已经有弹层开着，新弹层叠在上面，**旧弹层保留挂载**（关闭新弹层后能看到旧弹层还在）。
- **`replace()` 打开弹层**：**销毁**当前最上层的弹层，新弹层取而代之（如果新旧弹层是同一个组件，走 `onBeforeRouteUpdate` 原地更新而不重新挂载，语义和页面栈的 `replace()` 完全一致）。
- **关闭**：`router.back()` 永远关闭"当前最上层"的那一个（更下面的弹层，或者背景页，会显现出来）。判断背后是否存在真实可回退的历史（`canGoBack`），有就走真实的 `history.back()`，没有就用 `replaceState` 把地址栏落回下一层的 URL，不会把用户带出应用或者卡住没反应。
- **点遮罩关闭**：`<GZModalView>` 自带的遮罩点击会调用 `router.back()`。因为多层弹层各自的遮罩是从下到上层叠的、后开的盖住先开的，天然只有最上层能被点到，不需要业务方自己判断"点的是哪一层"。
- **直接访问弹层 URL**（刷新、直接输入地址、物理前进/后退落到这个 URL 上）：**背景页/更下层的弹层会自动一起挂载**——如果内存里已经知道下面应该是什么（比如物理前进重新落到一个曾经打开过的第二层弹层，第一层还在），就保留它；如果完全无法得知（比如全新标签页直接访问弹层 URL），背景页默认用 `initialUrl`。这是浏览器 API 的限制——JS 无法读取"上一条历史记录对应哪个路由"，不是实现偷懒。

## 嵌套路由（`children`）

父路由可以设置整体布局，子路由的内容渲染在布局内部，用法和 vue-router 的嵌套路由基本一致：

```ts
{
  path: '/dashboard',
  name: 'dashboard',
  component: DashboardLayout, // 布局组件，自己的模板里放一个嵌套的 <GZRouterView />
  beforeEnter: (to) => {
    // 父路由的 beforeEnter 对它自己和它的所有子孙路由都生效
    console.info(`entering dashboard section: ${to.fullPath}`);
    return true;
  },
  children: [
    // path 默认相对父路由拼接：'overview' -> '/dashboard/overview'；以 '/' 开头则是绝对路径
    { path: 'overview', name: 'dashboard-overview', component: DashboardOverview },
    { path: 'stats', name: 'dashboard-stats', component: DashboardStats },
  ],
}
```

```vue
<!-- DashboardLayout.vue -->
<script setup lang="ts">
import { GZRouterView } from 'gz-vue-router';
</script>
<template>
  <div class="sidebar">...</div>
  <GZRouterView /> <!-- 渲染匹配到的子路由，同一个组件既能当根视图用也能当嵌套视图用 -->
</template>
```

行为要点：

- **有 `children` 的父路由自己不独立可匹配**（和 vue-router 一致）：想让 `/dashboard` 本身也能命中，在 `children` 里加一条 `{ path: '', component: ... }`。
- **`beforeEnter` 级联**：父路由的守卫先跑，子路由自己的守卫后跑，对任意深度的子孙路由都生效。
- **`meta` 浅合并**：`to.meta` 是从根到叶按顺序合并的结果，子路由能覆盖父路由的同名字段。
- **在兄弟子路由之间用 `replace()` 切换，布局不会重新挂载**：`replace()` 判断"是否原地更新"的依据从"叶子组件是否相同"扩展成了"路由记录链的根（`chain[0]`）是否相同"——只要挂的是同一个布局，切换子路由时布局组件实例保留（可以在布局里用 `onBeforeRouteUpdate` 感知子路由变化），只有子路由自己的内容会重新挂载。用 `push()` 则总是完整地一次前进导航，会带着布局一起重新挂载（想要"标签页切换"的观感请用 `replace()`，想要"进入一个新页面"的观感用 `push()`）。

## 已知限制

- 物理前进/后退如果被守卫拦截，会调用 `history.go()` 撤销已经发生的浏览器导航，中间会有一瞬间的地址栏闪烁——这是 History API 的固有限制（vue-router 自己也是这样处理的）。
- 只支持单一页面栈 + 单一弹层栈，没有 F7 的多视图/master-detail 布局。
- `onBeforeRouteLeave`/`onBeforeRouteUpdate` 的粒度是"每个页面栈/弹层栈 entry 一份"，不是"每一层嵌套路由记录一份"——嵌套场景下，布局和它的子路由如果都注册了守卫，会共享同一份登记（都在同一个 entry 上）。用 `replace()` 在共享布局的兄弟子路由间切换时，这次导航按"更新"处理，只会触发 `onBeforeRouteUpdate`，子路由自己注册的 `onBeforeRouteLeave` 不会触发——子路由如果需要在这种"被同级路由替换掉"的场景下做确认，应该用 `onBeforeRouteUpdate` 而不是 `onBeforeRouteLeave`。
- 没有 `<RouterLink>` 之类的组件，业务方自己用按钮/`<a>` 调用 `router.push`。
- 首屏落地不会触发 `beforeEach`/`beforeEnter`（避免被拦截后卡在空白页、没有兜底），只会触发 `afterEach` 这类只读副作用。
- **不会**、也**不应该**设置 `app.config.globalProperties.$router`/`$route`：Vuetify 的 `<v-dialog>`/`<v-menu>` 等组件（基于 `VOverlay`）会自动探测 `$router` 是否存在，探测到就注册自己的一套"物理返回关闭浮层"逻辑，和这个包自己的 `popstate` 处理会互相打架、导致死循环。这也是弹层渲染改成自己实现而不是包一层 `<v-dialog>` 的直接原因，详见 [`CLAUDE.md`](./CLAUDE.md) 和 [`bugs/0003`](./bugs/0003-vdialog-closeonback-conflict.md)。
- 弹层没有 Esc 键关闭，只支持点遮罩关闭。

## 目录结构

```
src/
├── index.ts                 包的公开导出（barrel）
├── types.ts                 路由配置/守卫/RouteLocation 等类型定义
├── matcher.ts                路由匹配（含嵌套路由展开成路径链）+ resolveUrl（命名路由 -> URL）
├── history.ts                seq 分配器（sessionStorage 持久化）+ 浏览器 history 读写封装
├── guards.ts                 守卫执行器（兼容两种签名）
├── router.ts                 createGZRouter() 核心实现（页面栈 + 弹层栈 + 守卫管线 + 浏览器同步）
├── injection.ts              useRouter() / useRoute()
├── injection-keys.ts         provide/inject 用的 Symbol key（含嵌套路由用的 CHAIN_KEY/DEPTH_KEY）
├── composables.ts            onBeforeRouteLeave / onBeforeRouteUpdate
├── components/
│   ├── GZRouterView.vue      渲染页面栈 + 过渡动画；同一个组件也用作嵌套路由的内层视图
│   ├── GZModalView.vue       渲染弹层栈（自己实现遮罩+卡片，不依赖 v-dialog）
│   └── EntryProvider.vue     内部用：给每个渲染出的页面/弹层提供 entry-id + 路由记录链上下文
└── styles/transitions.css    默认的 Android/MD 过渡动画（keyframes 移植自 framework7）
```

> 维护须知：新增 API、或者改变了某个方法对外可观察的行为，才需要同步更新这份 README（以及 `CLAUDE.md` 里对应的架构说明）。单纯修复 bug、不影响这里描述的行为的，去 [`CLAUDE.md`](./CLAUDE.md) 里按约定在 `bugs/` 目录单独建一篇修复日志，不用改这份 README。
