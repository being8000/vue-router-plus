# 0001. 守卫重定向回当前页时，仍然多播一次前进过渡动画

- **日期**：2026-07-17
- **涉及文件**：`src/router.ts`（`withGuards()`）

## 现象

`routes.ts` 里给 `/detail/:id` 配置了 `beforeEnter`：id 超过 500 会被拦截并重定向回 `/`。在首页点击"跳转到订单 #999"按钮后，虽然页面确实没有跳转到 `/detail/999`，但视觉上仍然播放了一次"前进"过渡动画。

## 根因

`withGuards()` 处理守卫返回的重定向地址时：

```ts
if (redirectUrl !== to.fullPath) push(redirectUrl);
```

`to` 是**被拦截的目标**（`/detail/999`），`redirectUrl` 是重定向目标（`/`）。这个判断只防得住"守卫把你重定向到它自己"这种自环，防不住"重定向回用户已经在的那个页面"——因为 `/` 显然不等于 `/detail/999`，条件永远成立，于是对已经处于 `/` 的用户又执行了一次 `push('/')`。

`push('/')` 会把首页当成一个全新的 `StackEntry` 塞进 `stack`（`direction.value = 'forward'; stack.push(...)`），`<GZRouterView>` 因此认为发生了一次真正的前进导航，播放了滑入动画——即便最终显示内容还是首页，用户也能感知到这次"凭空多播"的动画和多出来的一层历史。

## 修复

判断依据从"被拦截的目标 `to`"改成"当前实际停留的页面 `currentRoute`"：

```ts
if (redirectUrl !== currentRoute.fullPath) push(redirectUrl);
```

守卫还没放行、`mutate()` 从未执行，此时 `currentRoute` 就是用户真实所在的页面。重定向目标如果就是这个页面，直接跳过——不产生任何 `stack` 变化，也就没有动画；只有重定向到一个**不同**的页面，才会正常走一次 `push`，播放符合预期的前进动画。

## 验证

Headless 浏览器实测（`playwright-core`），关键断言：

- 点击触发拦截前后，`.gz-router-view__page` 的节点数量保持不变（`1 -> 1`，不再变成 `1 -> 2`）。
- 用 `MutationObserver` 监听 `.gz-router-view` 子树的 class 变化，确认没有出现过任何 `*-enter-active`（证明动画确实没有播放，而不是"播放了但太快没看见"）。
- 后续正常导航（进入详情页、再返回）行为不受影响，栈深度正确回落。

```
BEFORE page-node count: 1  AFTER: 1
Spurious enter-active animation observed: false
Still correctly on home: true
```
