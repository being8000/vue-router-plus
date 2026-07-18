# 0006. 前进导航到一条 persistent 路由时，没有复用已存活的实例，创建了重复的 entry

- **日期**：2026-07-18
- **涉及文件**：`src/router.ts`（`push()`、`replace()`）

## 现象

首页（`persistent: true`）前进导航到别的页面之后，再通过 `push()`（包括守卫重定向内部触发的
`push()`，比如 `DetailPage` 深入到 id > 500 时 `beforeEnter` 重定向回首页）回到首页，页面栈里
会同时出现**两个**首页的 `<div class="gz-router-view__page">`，一个是 `is-dormant`（原来那个，
一直存活），一个是新出现的（拿到了当前显示状态，`is-current` 或 `is-previous`）。两个实例的组件
状态完全独立，用户在原来那个首页上的任何本地状态（比如勾选框、输入框）在"新的首页"上都看不到。

## 根因

`persistent` 最初的实现（见 CLAUDE.md 设计决策 16）只解决了"这个 entry 会不会被真的销毁"——
`<GZRouterView>` 渲染层会把被挤出可视窗口的 persistent entry 保留成 `is-dormant`，`stack`
数组本身也一直留着它。但 `push()`/`replace()` 在创建新 entry 之前，从来没有检查过"目标路由
是不是已经在 `stack` 里活着"——`push()` 无条件 `stack.push(makeEntry(matched, seq))`，
`replace()`（非原地更新分支）无条件 `stack.splice(indexOf(currentTop), 1, newEntry)`。
如果目标恰好是一条已经在 `stack` 里存活（`is-previous` 或 `is-dormant`）的 persistent 路由，
这两个函数都会凭空再建一份新的，而不是把已有那份挪上来复用。

## 修复

新增两个 helper：

```ts
function findPersistentEntry(matched: MatchedRoute, exclude?: StackEntry): StackEntry | undefined {
  if (!matched.route.persistent) return undefined;
  return stack.find((entry) => entry !== exclude && entry.matched.route === matched.route);
}

function promoteExistingEntry(existing: StackEntry, matched: MatchedRoute, seq: number): StackEntry {
  stack.splice(stack.indexOf(existing), 1);
  const promoted = makeEntry(matched, seq, existing.id); // 复用同一个 id，组件实例不重建
  stack.push(promoted);
  return promoted;
}
```

`push()`/`replace()`（非原地更新分支）在构造 `mutate()` 之前先调用 `findPersistentEntry`；找到了
就用 `promoteExistingEntry` 复用（同时把这个已存在 entry 的 `enterGuardsMap` 加进守卫链，按
"重新变回当前层"处理，会触发 `onBeforeRouteEnter`/`onRouteActivated`，不触发 `onMounted`），
找不到才退回原来"新建一个 entry"的逻辑。`replace()` 里如果命中复用，还要先把被替换掉的
`currentTop` 从 `stack` 里移除（它是被 `replace` 销毁的那一个，和被复用的 persistent entry
是两个不同的对象）。

## 验证

用 Playwright 复现原始场景：首页 → 详情页深入 5 层（`goDeeper()` 每次 id +100，最终触达
`id > 500`）→ 第 5 次深入触发 `beforeEnter` 重定向回首页。修复前：DOM 里同时出现两个首页
`entry`；修复后：`is-dormant` 计数为 0（原来那个首页被正确挪上来变成 `is-current`），
`home mounted` 不再出现在 console 里（证明不是重新创建的实例），`onBeforeRouteEnter`/
`onRouteActivated` 正常触发。额外验证：复用之后再次 `push` 离开首页，首页正确回到
`is-previous`（不是 `is-dormant` 里躺着一个重复的）。

## 教训

`persistent` 这个特性隐含了一个没有在最初实现时讲清楚的不变量："标了 persistent 的路由，
整个页面栈里任何时刻最多只有一个实例"——只做"不被裁剪掉"这一半（渲染层），没做"不会被
无意间再造一个"这一半（导航层），特性就是不完整的，会在"从别处导航回来"这种最常见的用法下
立刻暴露。以后新增任何"跨越多个函数才能拼出完整语义"的特性，最好先把隐含的不变量写下来
（比如这里的"至多一个实例"），再逐个检查每个会创建新 entry 的入口是否遵守。
