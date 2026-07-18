# 0003. Vuetify `<v-dialog>` 的 closeOnBack 特性和自己的 popstate 处理互相打架，导致无限循环

- **日期**：2026-07-17
- **涉及文件**：`src/router.ts`（`install()`）、`src/components/GZModalView.vue`（整体重写，弃用 `<v-dialog>`）

## 现象

修完 [0002](./0002-reactive-wrapped-component-infinite-loop.md) 之后，多层弹层的 push/replace
场景（应用内点击触发）全部正常，唯独"打开二级弹层后按浏览器物理返回"这一个场景会让页面彻底卡死，
控制台疯狂刷同一行日志：

```
[gz-vue-router] beforeEach: /settings/confirm -> /settings
[gz-vue-router] beforeEach: /settings/confirm -> /settings
[gz-vue-router] beforeEach: /settings/confirm -> /settings
...（无限重复）
```

## 根因

在每个守卫结果上加日志后发现，真正让 `withGuards()` 判定为 `allowed:false` 的不是我们自己注册的
任何守卫，而是一个来自 `node_modules/vuetify/lib/composables/router.js` 的陌生函数：

```js
// vuetify: composables/router.js
export function useBackButton(router, cb) {
  ...
  removeBefore = router.beforeEach(() => {
    if (!inTransition) {
      inTransition = true;
      return new Promise(resolve => {
        setTimeout(() => resolve(popped ? cb() : undefined));
      });
    }
    return popped ? cb() : undefined;
  });
  ...
}

// vuetify: components/VOverlay/VOverlay.js
const router = useRouter(); // 内部实现：getCurrentInstance()?.proxy?.$router
useToggleScope(() => props.closeOnBack, () => {
  useBackButton(router, () => {
    if (globalTop.value && isActive.value) {
      if (!props.persistent) isActive.value = false; else animateClick();
      return false; // <- 就是这个 false
    }
  });
});
```

`<v-dialog>`（继承自 `VOverlay`）默认开启 `closeOnBack`：只要 Vuetify 探测到 `vm.proxy.$router`
存在，就会**自己**调用 `router.beforeEach()` 注册一个守卫，目的是"物理返回时不真的导航，而是拦下
这次导航、顺便把最上层的弹层关掉"——这是 Vuetify 设计给 vue-router 用的标准整合方式：guard 返回
`false` 会让 vue-router 判定导航被取消，并把浏览器历史"弹"回原来的位置。

而我们在 `createGZRouter().install(app)` 里为了模拟 vue-router 的 Options API 用法，写了：

```js
app.config.globalProperties.$router = router;
app.config.globalProperties.$route = currentRoute;
```

这两行让 Vuetify 的探测逻辑命中了，`VOverlay` 就把它自己的 `beforeEach` 挂到了我们的路由实例上。
问题是：**我们已经在 `popstate` 监听器里自己实现了一套完整的"物理返回关闭最上层弹层"逻辑**，
两套机制同时响应同一次 `popstate`：我们的 `popstate` 处理器跑完 `withGuards()` 时，Vuetify 注册的
那个 `beforeEach` 也在守卫队列里被依次执行、返回 `false`，导致我们自己的 `withGuards()` 判定
`allowed:false`；接着我们的"撤销导航"逻辑又调用了 `history.go()`，这又触发一次新的 `popstate`，
Vuetify 的守卫再次响应、再次返回 `false`……形成了两套独立实现互相抢同一个方向盘的死循环。

## 修复

两处都改：

1. **不再暴露 `$router`/`$route` 全局属性**（`router.ts` 的 `install()`）。我们的 API 设计本来就是
   Composition-API-only（`useRouter()`/`useRoute()`），Options API 的 `$router`/`$route` 从未被
   文档记录为支持的能力，去掉它没有任何功能损失，却从根上切断了 Vuetify 任何 overlay 组件
   （不只是 `v-dialog`，`v-menu`/`v-bottom-sheet` 等都走同一套 `useBackButton`）的自动探测。
2. **弃用 `<v-dialog>`，`<GZModalView>` 自己实现遮罩 + 卡片容器**（不再依赖 Vuetify 的 `VOverlay`）。
   这样即使某天因为别的原因又要暴露 `$router`，也不会有第三方组件在我们背后偷偷注册守卫。

## 教训

**任何"探测宿主环境有没有装某个东西就自动接管一部分行为"的第三方库整合点，都要假设它会真的生效**，
不能因为"我们的路由不是真的 vue-router"就想当然认为不会被认出来——探测逻辑通常只看鸭子类型
（`$router` 存在、有 `beforeEach` 方法），不会检查"这真的是 vue-router 吗"。凡是这个包要暴露的、
可能被第三方库探测到的全局挂载点（`$router`/`$route`、未来如果做 `<RouterLink>` 之类），都要先确认
清楚会不会被 Vuetify（或其它已安装的库）反向勾住。
