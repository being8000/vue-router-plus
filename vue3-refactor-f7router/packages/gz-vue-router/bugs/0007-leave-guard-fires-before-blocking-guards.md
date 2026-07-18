# 0007. 目标路由被 `beforeEach`/`beforeEnter` 拦截时，`onBeforeRouteLeave`/`onBeforeRouteUpdate` 已经先触发了

- **日期**：2026-07-18
- **涉及文件**：`src/router.ts`（`push()`/`replace()`/`replaceModal()`/`back()`/`popstate` 里所有拼 `guards` 数组的地方）

## 现象

给 `/dashboard` 加了 `meta: { auth: true }`，全局 `beforeEach` 里对 `auth` 路由无条件 `return false`
拦截。从首页点击"打开仪表盘"，调试发现：页面确实没有跳转（符合预期），但首页的
`onBeforeRouteLeave` 却已经触发了。如果这个钩子里做了"未保存修改，确认要离开吗"之类的拦截
逻辑，用户会经历一次confirm 弹窗，确认之后却发现根本没有跳转——体验上说不通。

## 根因

`guards` 数组的拼接顺序一直是"离开/更新守卫在前，`beforeEach`/`beforeEnter` 在后"：

```ts
const guards = [
  ...(outgoing ? Array.from(leaveGuardsMap.get(outgoing.id) ?? []) : []),
  ...beforeEachGuards,
  ...collectChainGuards(matched),
];
```

`runGuardSequence` 按顺序执行、遇到第一个不放行的就短路——但顺序本身决定了"谁先跑"，和"谁的
返回值最终生效"是两回事。离开守卫排最前面，意味着不管后面 `beforeEach`/`beforeEnter` 最终是否
放行，离开守卫（以及它的副作用，比如 `console.log`、`window.confirm`）都已经无条件执行过了。

## 修复

把 `beforeEach`/`beforeEnter`（决定"这次导航有没有资格发生"的守卫）挪到数组最前面，离开/更新/
进入守卫（都是"这次导航局部于某个组件的感知"）挪到后面：

```ts
const guards = [
  ...beforeEachGuards,
  ...collectChainGuards(matched),
  ...(outgoing ? Array.from(leaveGuardsMap.get(outgoing.id) ?? []) : []),
];
```

这个改动涉及 `router.ts` 里所有拼 `guards` 数组的地方（`push`/`replace`/`replaceModal`、`back()`
的四个分支、`popstate` 的四个分支），逐一把 `beforeEachGuards`/`collectChainGuards(matched)` 挪到
离开/更新/进入守卫前面，其余逻辑不变。

## 验证

用 Playwright 复现：首页点击"打开仪表盘"（`meta.auth` 无条件被 `beforeEach` 拦截）。修复前：
`home onBeforeRouteLeave` 会出现在 console 里；修复后：完全不会（因为 `beforeEach` 直接返回
`false`，短路后数组里排在后面的离开守卫压根不会被执行到）。额外的意外收获：之前
`DetailPage` 深入到 id > 500 触发 `beforeEnter` 重定向回首页时，离开守卫会触发两次（一次是
被拦截的原始导航，一次是重定向触发的新导航）——现在只触发一次，因为被拦截的那次导航里，
离开守卫排在 `beforeEnter` 后面，根本没机会执行到。

## 教训

守卫数组里"谁排前面"不只是执行顺序的问题，是"谁的副作用会不会被无意义地触发"的问题。像
`onBeforeRouteLeave`/`onBeforeRouteUpdate` 这种可能有可见副作用（弹确认框、打点）的守卫，
应该放在所有"纯粹判断这次导航合不合法"的守卫（`beforeEach`/`beforeEnter`）后面，只有确定
导航大概率会发生，才值得去问"这一步局部的感知"。新增任何守卫类型时，先想清楚它是"决定导航
合法性"的那一类，还是"对某个具体组件局部生效"的那一类，决定它该排在数组的前半段还是后半段。
