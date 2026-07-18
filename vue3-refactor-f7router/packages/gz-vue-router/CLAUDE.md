# CLAUDE.md — gz-vue-router

给后续在这个包里工作的 Claude Code（以及人类开发者）的上下文说明。业务向的使用文档见同目录 [README.md](./README.md)；这份文件关注**为什么这么设计**、**改动时不能踩的坑**、以及**怎么验证改动是对的**。文件分工和代码执行顺序（谁调用谁、按什么顺序跑）见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

> **维护约定（三条分开看）：**
> 1. **新增功能 / 功能行为发生变动**（新增 API、改变某个方法的对外行为、调整默认值……）：在同一次改动里同步更新 README.md 和这份 CLAUDE.md 里对应的描述。不涉及功能变动的纯内部重构不需要碰这两份文档。
> 2. **修复 bug**：不要把细节堆进这份 CLAUDE.md。在 [`bugs/`](./bugs/) 目录下新增一个 `NNN-简短描述.md`（编号递增，看现有文件顺延即可），按"现象 / 根因 / 修复 / 验证"记录。如果这个 bug 顺带暴露了一条值得后人记住的架构不变量，再把**一句话**的提炼加进下面"关键设计决策"列表并链接过去；不要整段复制。
> 3. **新增文件、或者改变了模块之间的调用关系/执行顺序**：同步更新 [ARCHITECTURE.md](./ARCHITECTURE.md) 里对应的图和小节。

## 这个包解决什么问题

从 Framework7 的 `core/modules/router` 迁移出来的轻量路由，目标场景：全新 Vue 3 工程、UI 用 Vuetify（不用 F7 的组件体系），但想保留 F7 那种"页面栈 + 前进新页滑入/后退当前页滑出"的原生 App 观感，且只需要 Android(Material Design) 一套动画。API 形状刻意向 vue-router 靠拢，方便熟悉 vue-router 的人直接上手。

## 架构总览

```
routes(RouteRecordRaw[], 支持 children 嵌套)
   |
   | matcher.ts: flattenRoutes() 递归展开成 [{ fullPath, chain(根到叶的记录数组) }]
   v
matchByUrl/resolveUrl --> MatchedRoute { route(叶子), chain(根到叶), params, path, url }
                                                        |
createGZRouter() ---持有响应式状态---> stack / modalStack / direction / currentRoute
                  ---导航方法-------> push / replace / back / go / forward
                  ---守卫管线-------> beforeEach / afterEach
                                     / beforeEnter（沿 chain 级联收集，见下）
                                     / onBeforeRouteLeave / onBeforeRouteUpdate / onBeforeRouteEnter
                                       （每个 entry 一份，不分链上层级；onBeforeRouteEnter 只在
                                        “组件实例本来没被销毁、现在重新变回当前层”时触发，见下）
                  ---只读通知-------> onRouteActivated（entry 变成 is-current/弹层栈顶时触发，
                                       覆盖首屏/刷新/push/replace 新建 + onBeforeRouteEnter 覆盖
                                       的重新激活，不是守卫、不能取消导航，见下）
                  ---浏览器同步-----> history.ts 的 seq 分配器 + popstate 监听
                                        |
                                 <GZRouterView> 根用法：消费 stack/direction 渲染页面过渡动画，
                                               渲染每个 entry 时是 chain[0]（未嵌套时就是唯一的叶子）
                                 <GZRouterView> 嵌套用法：放在 chain[0]（布局组件）自己的模板里，
                                               靠 inject 到的 DEPTH_KEY 渲染 chain[depth]，逐层往下嵌套
                                 <GZModalView> 消费 modalStack 渲染弹层栈（自己实现遮罩+卡片，
                                               不依赖 Vuetify 的 <v-dialog>，原因见下）
```

`stack`（页面）和 `modalStack`（弹层）是两个独立的栈，但共用**同一个**单调递增的 seq 计数器——
两边的历史条目因此落在同一条时间线上，`popstate` 处理器只需要按 seq 判断"这一步该从哪个栈里找、
该动哪个栈"，不需要额外记录"这一步操作的是页面还是弹层"。物理返回/前进落到某个页面级 seq 上时，
会连带清空当前的 `modalStack`（因为任何弹层都必然是在某个页面之后才打开的，seq 更大）。

嵌套路由是在**同一个** `StackEntry`/`ModalStack` entry 内部展开的，不会让 `stack`/`modalStack`
多出层级——一次导航命中一条 3 层嵌套的路由，`stack` 里也只多一个 entry，只是这个 entry 的
`matched.chain` 长度是 3，渲染时靠 `<GZRouterView>` 的 depth 递归下钻，而不是靠页面栈本身的
深度。这个设计是刻意的：页面栈的"栈"表达的是*导航历史*（能不能物理返回），嵌套路由的"层级"
表达的是*同一个历史节点内部的组件组合关系*，两者是正交的概念，不应该混在一起。

## 关键设计决策 + 踩过的坑（不要在重构时无意间违反）

这些都是实际调试真实 bug 后固化下来的，如果要改动相关代码，先确认没有绕开这几条：

1. **seq 必须持久化到 `sessionStorage`（`history.ts` 的 `createSeqAllocator`），不能是纯内存计数器。**
   - 教训：早期版本每次刷新页面 seq 从 0 重新数，深层页面刷新后会和更早的历史记录"撞号"——刷新前 `/detail/1` 是 seq:2，刷新后又被标成 seq:1，和首页那条历史的 seq 撞在一起，导致物理返回时误判"已经到位"，页面不同步。
   - 如果要改 seq 的生成方式，必须保证：跨刷新单调递增、不同标签页/会话互不干扰（`sessionStorage` 天然满足后者）。页面栈和弹层栈共用同一个分配器，不要给弹层单独搞一套计数。

2. **`back()` 不能只看 `stack.length`，要看 `canGoBack`。**
   - `canGoBack = stack.length > 1 || currentSeq.value > baseSeq`——第二个条件是为了识别"内存里没有上一页，但浏览器 session history 里其实有（多半是刷新导致内存丢失了）"这种情况，这时要 `history.back()` 交给 `popstate` 去正确同步，而不是直接 no-op。
   - `baseSeq` 只在"这个 tab 会话第一次出现"时写入一次（`writeBaseSeqOnce`），代表"再往前不存在任何真实历史"。这个判断对弹层栈同样适用，不需要单独判断 `modalStack.length`——弹层的 seq 增长必然发生在 baseSeq 之后。

3. **`popstate` 处理器如果在两个栈里都找不到目标 seq，必须用 `location.pathname` 重新匹配路由，而不是假装没发生。**
   - 这是刷新/直接深链接访问导致内存历史丢失的恢复路径。绝对不要在这个分支里跳过匹配直接 return——那样地址栏会变但组件不会同步。
   - 恢复出来的目标如果是弹层路由，用 `modalStack.push(...)` **叠加**，不要用 `splice(0, length, ...)` **整体替换**——替换会把当时可能还挂着的其它弹层一并顶掉（详见 [bugs/0005](./bugs/0005-physical-forward-into-modal-wipes-stack.md)）。

4. **`StackEntry` 存在 `shallowReactive` 数组里，不能就地 `mutate` 某个 entry 的字段（比如 `entry.matched = xxx`），也不要把 entry 复制进另一个用 `reactive()` 包的本地状态。**
   - `shallowReactive` 只追踪数组自身的增删/长度变化，数组里的对象不是深层响应式的，原地改字段不会触发任何组件重渲染。正确做法：`stack.splice(index, 1, 新的entry对象)`。`replace()` 里"原地更新"（`onBeforeRouteUpdate` 场景）靠的是**新对象 + 复用同一个 `id`**——`id` 不变让 Vue 的 `:key` 保持一致（组件实例不重建），但整体是全新对象引用触发数组层面的响应式，两者缺一不可。
   - 反过来，如果哪个组件想把 entry 复制到本地状态（比如做过渡动画的两阶段管理），本地容器也必须是 `shallowReactive`，绝不能用 `reactive()`——entry 里的 `matched.route.component` 是原始 Vue 组件定义对象，被深层代理会导致 `<component :is>` 每次都认为组件变了、无限重新挂载卡死页面（详见 [bugs/0002](./bugs/0002-reactive-wrapped-component-infinite-loop.md)）。

5. **弹层路由（`meta.modal`）不能被当成页面塞进 `stack`，要走独立的 `modalStack`。**
   - 初始化（`initLanding`）和 `popstate` 的恢复分支，都必须显式检查 `matched.route.meta?.modal`，命中就走 `modalStack`，不要走 `stack.push`/`stack.splice`——否则弹层会被渲染成一个占满全屏、没有遮罩样式的普通页面，背景页也不会挂载。
   - `modalStack` 支持叠加多层：`push()` 在已有弹层之上再开一层（两层都保留挂载），`replace()` 销毁当前最上层、换成新的一层（对齐页面栈 `replace()` 的"原地更新 vs 全新替换"语义，靠是否同一个组件判断走 `onBeforeRouteUpdate` 还是普通 leave+enter）。

6. **`direction`（forward/backward）是路由实例上独立的一个 `ref`，只服务于页面栈的过渡动画，不要挂回具体某个 `StackEntry`，弹层栈不需要它。**
   - 早期版本把方向存在 entry 自己身上，导致后退完成后 `top` 指向的新 entry 读到的是它自己当初"被 push 时"的方向（一般是 forward），过渡动画方向判断错误、后退动画播不出来。弹层用 `<Transition>`/`<TransitionGroup>` 原生的 enter/leave 机制做动画，天然不需要方向判断。

7. **首屏落地（`initLanding`）不跑 `beforeEach`/`beforeEnter`，只用 `queueMicrotask` 补跑一次 `afterEach`。**
   - 原因：`beforeEach` 是异步的、可以取消，如果首屏被拦截，没有"取消后回退到哪"的合理去处，会让应用卡在空白页。`afterEach` 是只读副作用（demo 里用来同步 `document.title`），跑一次没有坏处，用 `queueMicrotask` 延后是为了让 `createGZRouter()` 返回后紧跟着调用的 `router.afterEach(...)` 先完成注册（同步模块求值顺序保证这一点成立，详见 `router.ts` 里 `initLanding` 的注释）。

8. **`NavigationGuard` 类型是单一函数签名（`(to, from, next?) => ...`），不是两个函数类型的 union。**
   - 之前用 union 类型（区分"两参返回值"和"三参 next 回调"两种写法）会导致 TS 没法对传进来的箭头函数做上下文类型推导，`to`/`from` 会被推成 `any`。改成单一签名、`next` 标可选，问题消失——运行时依然用 `guard.length` 判断实际传入的函数声明了几个参数（这是 JS 运行时特性，和类型声明是否可选无关）。

9. **守卫重定向时，判断"是不是原地无需导航"要跟 `currentRoute.fullPath`（实际当前所在页面）比，不能跟 `to.fullPath`（被拦截的目标）比。**
   - 详见 [bugs/0001](./bugs/0001-guard-redirect-replays-animation.md)。

10. **不要往 `app.config.globalProperties` 上挂 `$router`/`$route`。**
    - 这个包的 API 设计是 Composition-API-only（`useRouter()`/`useRoute()`），从未文档化支持 Options API 访问。挂上去看似是"贴近 vue-router"的免费彩蛋，实际会被 Vuetify 的 `VOverlay`（`<v-dialog>`/`<v-menu>` 等的基类）自动探测到，进而注册它自己的 `beforeEach`/`afterEach` 来实现"物理返回关闭浮层"——这套逻辑和我们自己在 `popstate` 里实现的同名功能会互相打架，表现为守卫无限触发、页面卡死。详见 [bugs/0003](./bugs/0003-vdialog-closeonback-conflict.md)（这也是 `<GZModalView>` 最终放弃 `<v-dialog>`、自己实现遮罩+卡片的直接原因）。

11. **嵌套路由的展开结果（`matcher.ts` 的 `flattenRoutes`）按 `routes` 数组的引用缓存在 `WeakMap` 里，不要每次导航都重新递归展开。**
    - `routes` 是静态配置，导航发生的频率远高于路由表本身变化的频率（路由表基本不会在运行时变），缓存是纯粹的性能优化，没有正确性上的取舍。如果哪天要支持运行时动态增删路由（`router.addRoute()` 之类），要记得让缓存失效或者换成别的 key。

12. **`<GZRouterView>` 同一个组件既是根视图也是嵌套视图，靠有没有 inject 到 `DEPTH_KEY` 区分；`CHAIN_KEY` 传的是 `ComputedRef`，不是纯对象。**
    - 如果传纯对象快照，`replace()` 命中"链根相同、原地更新"（entry 复用同一个 `id`，`EntryProvider` 组件实例不重建）时，`props.chain`/`props.params` 变了但 `setup()` 不会重跑，嵌套的 `<GZRouterView>` 会读到旧值——子路由切换了但内容不更新。用 `ComputedRef` 包一层解决这个问题，同时**不能**用 `reactive()` 包（chain 里的 `RouteRecordRaw.component` 是原始组件定义对象，会重蹈 [bugs/0002](./bugs/0002-reactive-wrapped-component-infinite-loop.md) 的覆辙）——`computed()` 只包一层容器，不深层代理返回值，两全其美。

13. **`replace()`/`replaceModal()` 判断"是否原地更新"，比较的是 `matched.chain[0].component`（链根），不是 `matched.route.component`（叶子）。**
    - 未嵌套路由 `chain[0] === route`，行为和之前完全一样，不是破坏性变更。嵌套路由场景下，这个改动是"父路由设置整体布局"这个需求能落地的关键：只要新旧导航共享同一个链根（同一个布局），就复用同一个 `entry.id`（布局组件实例不重建，只有 `onBeforeRouteUpdate` 感知到变化），链上更深的部分交给嵌套 `<GZRouterView>` 通过响应式的 `CHAIN_KEY` 自然重新渲染。`push()` 故意没有做同样的处理——`push()` 语义上就是"新开一页"，应该总是完整重新挂载（包括布局），想要"同一布局下切换子路由不重新挂载"的效果要用 `replace()`。
    - 代价（已知限制，写进了 README）：`onBeforeRouteLeave`/`onBeforeRouteUpdate` 是按 entry（不是按链上层级）登记的，链根相同触发的是"整个 entry 的 update 守卫"，叶子组件自己注册的 `onBeforeRouteLeave` 不会被触发——叶子如果要在"被同级路由替换掉"时做确认，应该注册 `onBeforeRouteUpdate` 而不是 `onBeforeRouteLeave`。

14. **`onBeforeRouteEnter` 判断"这个 entry 是不是本来就还活着"，页面栈和弹层栈的算法不一样，不要写反。**
    - 背景：`<GZRouterView>` 只同时挂载 `stack` 最后两条（`is-current` + `is-previous`），`<GZModalView>` 则整体渲染 `modalStack`（弹层从打开到关闭全程挂载）——两者对"这个 entry 有没有被销毁过"的判断依据完全不同。
    - 页面栈：只有目标 entry **在这次操作之前**恰好处于 `stack.length - 2` 这个位置（也就是当前的 `is-previous`）时，才算"本来就还活着"，要跑它的 enter 守卫；如果物理返回一次跳了不止一级，中间/更早的位置本来就没在可视窗口里、早就被销毁过，重新进入是货真价实的新建，不该跑 enter 守卫（跑了也没意义，因为组件是全新实例，`onMounted` 已经覆盖了这个场景）。判断代码：`pageIndex === stack.length - 2`（用操作之前的 `stack.length`）。
    - 弹层栈：只要 `modalStack` 里还存在"下面一层"（`below`/`modalStack[modalIndex]`），它就必然是一直挂载着的，无条件跑它的 enter 守卫，不需要位置判断。
    - 这套判断分散在四个地方（`back()` 的页面分支和弹层分支、`popstate` 的 `modalIndex` 分支和 `pageIndex` 分支），改任何一处物理返回/应用内返回的逻辑时，如果动了出栈/截断的位置计算，要连带检查这四处的"是否已挂载"判断是否还成立。

15. **`onRouteActivated` 不能只靠 `onMounted` 判断"变成当前层"，也不能只靠 router 内部的登记表判断——必须两路信号合并，且各自都要做"是否真的是栈顶"的校验。**
    - 背景：这个钩子要覆盖 `onBeforeRouteEnter` 之外的场景（首屏加载、刷新、`push`/`replace` 新建），这些场景组件是**全新挂载**的，router 内部任何"mutate 之后同步查表通知"的机制都够不到——新组件的 `setup()`/`onMounted` 还没跑（Vue 的渲染是异步的，`withGuards` 里 `mutate()` 之后紧跟着的同步代码执行时，新组件实例根本还不存在），所以这部分只能靠组件自己的 `onMounted` 探测。
    - 但 `onMounted` 不能当作"我就是当前层"的充分条件：多级 `popstate` 回退时，一个早就被真正销毁过的 entry 可能会被顺带带回可视窗口，但落地位置是 `is-previous`（真正的 `is-current` 是回退目标本身）——这时 `onMounted` 会触发，但这个 entry 并不是"正在展示给用户"的那一层。必须在 `onMounted` 里额外校验 `entryId` 是否真的等于 `router.stack`/`router.modalStack` 当前的栈顶 id，不是就跳过。
    - 反过来，"重新激活"（组件本来就没销毁，只是从 `is-previous` 被顶回 `is-current`）不会重新触发 `onMounted`，这部分靠 `router.ts` 里单独一张 `activatedCallbacksMap`（不是复用 `enterGuardsMap`——`onBeforeRouteEnter` 是可取消的导航守卫，混进同一张表会让"纯通知"钩子意外获得取消导航的副作用），在 `withGuards` 的 `mutate()` 之后统一对比 mutate 前后的 `top`/`topModal` id 是否变化来触发，一个地方就能覆盖 `push`/`replace`/`back`/`popstate` 所有分支，不需要像 `onBeforeRouteEnter` 那样在四个分支分别判断"是否已经预挂载"。
    - 两路信号天然互斥：已经存活的实例走登记表这一路（`onMounted` 不会重跑），全新创建的实例走 `onMounted`+校验这一路（登记表在这个 entryId 上还没有任何注册，查表是空操作），不会重复触发。

16. **`persistent`（`RouteRecordRaw.persistent`）是纯渲染层 + 守卫判断层的改动，不改 `stack` 本身的数据结构/mutate 逻辑。**
    - 关键前提：`stack` 数组本来就永久保留所有 entry（`push`/`back`/`popstate` 从不因为"超出两层可视窗口"去删它），只有 `<GZRouterView>` 的渲染层用 `slice(-2)` 决定挂载谁——所以"持久化"不需要改数据结构，只需要让渲染层对 `persistent` entry 网开一面。
    - `GZRouterView.vue`：`renderedEntries` = `[...被挤出窗口但 persistent 的 entry, ...stack.slice(-2)]`，靠 `entryClass()`（用 `===` 比较 `top`/`previous`，不是数组下标）分成 `is-current`/`is-previous`/`is-dormant` 三态。这个 entry 从 `is-dormant` 变到 `is-previous`/`is-current` 只是同一个 TransitionGroup 子节点的 class 切换（key 全程不变），不会被当成"新增"触发 enter 过渡、更不会重新挂载组件——这是持久化能生效的关键，如果哪天重构成"不在窗口内就 `v-if` 掉"，会直接破坏这个特性。
    - 只有一处守卫判断需要联动改：`popstate` 里多级跳跃的 `pageIndex` 分支，`wasAlreadyMounted` 原本只认"物理返回恰好一层"（`pageIndex === stack.length - 2`），现在要 `|| entering.matched.route.persistent`——否则一次跳好几级直接落到一个 persistent 页面上时，明明组件从来没被销毁过，却会被误判成"全新创建"，不触发 `onBeforeRouteEnter`。`back()` 自己的单层 pop 分支不用改（本来就总是恰好一层，判断天然成立）。
    - `onRouteActivated`（设计决策 15）**完全不用改**：它的两路信号本来就是"这个 entryId 是不是真的还活着"的通用判断（`onMounted`+校验栈顶、或者已注册的登记表），不关心"活着"是因为在两层窗口内还是因为 `persistent`，天然兼容。
    - 只在 `matched.route.persistent`（叶子）上检查，不沿 `chain` 级联——嵌套路由如果要整体持久化，应该在叶子路由上标，不是在布局（`chain[0]`）上标。
    - **隐含不变量：标了 `persistent` 的路由，页面栈里任何时刻最多只有一个存活实例。** `push()`/`replace()` 创建新 entry 之前都要先用 `findPersistentEntry` 查一遍 `stack` 里是否已经有活的，有就用 `promoteExistingEntry` 挪上来复用，不能无条件新建——不然会同时存在两个同路由的 entry、状态互不相通，详见 [bugs/0006](./bugs/0006-persistent-push-creates-duplicate-entry.md)。

17. **`guards` 数组的拼接顺序：`beforeEach`/`beforeEnter` 永远排在 leave/update/enter 守卫前面。**
    - 这两类守卫的性质不一样：`beforeEach`/`beforeEnter` 回答的是"这次导航合不合法/有没有资格发生"（权限、参数校验……），`onBeforeRouteLeave`/`onBeforeRouteUpdate`/`onBeforeRouteEnter` 回答的是"某个具体组件对这次导航的局部感知"（要不要确认离开、参数变了要不要刷新……），后者只有在前者已经放行的前提下才有意义去问。
    - `runGuardSequence` 是顺序执行、遇到第一个不放行就短路——数组顺序直接决定了"谁的副作用会不会被无意义触发"。如果把 leave/update 守卫排在前面，目标一旦被 `beforeEach`/`beforeEnter` 拦截，这些守卫的副作用（`console.log`、`window.confirm` 弹窗……）已经无条件跑过了，即使最终没有真的导航过去，详见 [bugs/0007](./bugs/0007-leave-guard-fires-before-blocking-guards.md)。
    - 这个顺序要求覆盖 `router.ts` 里所有拼 `guards` 数组的地方（`push`/`replace`/`replaceModal`、`back()` 的四个分支、`popstate` 的四个分支）——新增任何调用 `withGuards` 的地方，先把 `beforeEachGuards`/`collectChainGuards(matched)` 放进数组最前面，再拼局部守卫。

## Bug 修复日志

每一处 bug 修复都在 [`bugs/`](./bugs/) 目录下单独建档（现象/根因/修复/验证），不在这份文件里堆叙述。按修复时间顺序：

- [0001 - 守卫重定向回当前页时，仍然多播一次前进过渡动画](./bugs/0001-guard-redirect-replays-animation.md)
- [0002 - 本地镜像数组用 reactive() 包裹组件定义，导致页面卡死](./bugs/0002-reactive-wrapped-component-infinite-loop.md)
- [0003 - Vuetify v-dialog 的 closeOnBack 特性和自己的 popstate 处理互相打架](./bugs/0003-vdialog-closeonback-conflict.md)
- [0004 - 弹层栈内多级 popstate 被拦截时，撤销方向写反了](./bugs/0004-modal-popstate-undo-direction-wrong.md)
- [0005 - 物理前进重新落到弹层 URL 时，把还在下面的弹层也顶掉了](./bugs/0005-physical-forward-into-modal-wipes-stack.md)
- [0006 - 前进导航到一条 persistent 路由时，没有复用已存活的实例，创建了重复的 entry](./bugs/0006-persistent-push-creates-duplicate-entry.md)
- [0007 - 目标路由被 beforeEach/beforeEnter 拦截时，onBeforeRouteLeave/onBeforeRouteUpdate 已经先触发了](./bugs/0007-leave-guard-fires-before-blocking-guards.md)

新增条目时文件名用 `编号-简短英文/拼音描述.md`，编号接着现有最大编号往下顺延。

## 验证方法论

这个包目前没有单元测试套件——每一处修复都是用 **headless 浏览器实测**验证的，不是靠读代码"觉得应该没问题"。改动这个包之后建议照这个模式验证：

- 用 `playwright-core`（`node_modules` 里已有缓存的 Chromium，路径形如 `~/AppData/Local/ms-playwright/chromium-N/chrome-win64/chrome.exe`，写脚本时用 `chromium.launch({ executablePath: ... })`）而不是完整 `playwright`（避免重新下载浏览器）。
- 需要"全新会话"的场景（比如验证"这个 tab 第一次直接访问深链接"）用 `browser.newContext()` 隔离 `sessionStorage`，不要复用同一个 `page`。
- 用 `.gz-router-view__page.is-current` 精确定位当前可见页面、`.gz-modal-view__dialog`/`.gz-modal-view__backdrop` 定位弹层再点击/断言——不要用 Vuetify 的 `.v-overlay`/`.v-card` 之类选择器（`<GZModalView>` 已经不用 `<v-dialog>` 了）。
- 涉及物理前进/后退或守卫拦截的改动，**不要只跑到"能复现预期效果"就停**——务必单独验证一次"守卫真的拦截时会发生什么"，历史上好几个 bug（0003/0004/0005）都是只在这个分支才会暴露。
- 至少要覆盖的回归场景（每次改动路由核心逻辑后建议重跑一遍）：
  1. 正常前进/后退的动画 class（`gz-page-fwd-*` / `gz-page-bwd-*`）方向是否正确
  2. 深层页面刷新后：应用内返回按钮 + 物理返回，是否都能正确同步
  3. 连续前进 N 级后 `history.go(-N)` 一次性物理跳回，栈是否精确同步（不多不少）
  4. 直接访问 / 刷新停在 / 物理前进后退落到弹层 URL：背景页是否挂载、弹层是否正常显示
  5. 弹层关闭：有真实历史 vs 没有真实历史两种分支是否都对
  6. 守卫：`beforeEnter` 拦截+重定向、`onBeforeRouteLeave` 取消/放行、`onBeforeRouteUpdate` 触发但不重新挂载组件
  11. **`onBeforeRouteEnter`**：前进一层（组件保留在背景里）后应用内/物理返回——只触发 `onBeforeRouteEnter`，不触发 `onMounted`，组件实例标记不变；前进两层以上（组件已经真的被挤出去销毁过）后再返回——触发的是 `onMounted` 不是 `onBeforeRouteEnter`；连续两次返回时如果第一次返回让某个 entry 从"销毁状态"变成"挂载状态"，紧接着的第二次返回如果命中它，应该正确判定为"已挂载"（多步物理返回场景，容易漏测）
  12. **`onRouteActivated`**：首屏加载、以及 `push`/`replace` 新建 entry 都要触发；标准的"回退一层、组件保留在背景里"场景要触发（和 `onBeforeRouteEnter` 同时触发，不重复不遗漏）；**关键边界场景**——深入 2 级以上后物理返回，某个早被销毁的 entry 被顺带带回可视窗口但只是排在 `is-previous` 位置（`onMounted` 会触发），此时**不应该**触发 `onRouteActivated`；紧接着再返回一步，这个 entry 变成真正的 `is-current`（这次是重新激活，不重新 `onMounted`），才应该触发
  13. **`persistent`**：标了 `persistent` 的页面深入 N 层（N > 2）之后，DOM 里应该还能查到它（`class` 里带 `is-dormant`），不应该触发它的 `onUnmounted`；从深层用 `history.go(-N)` **一次性**跳回它（真正的单次多级 popstate，不是连点几次物理返回——那样会拆成好几次单级 popstate，测不出这个分支）：不应该触发 `onMounted`，应该触发 `onBeforeRouteEnter` 和 `onRouteActivated`；**用 `push()`/`replace()`（应用内前进，包括守卫重定向触发的那种）导航回一条已经存活的 persistent 路由**：DOM 里应该只有一份该路由的 entry（不能同时出现两个），不触发 `onMounted`，触发 `onBeforeRouteEnter`/`onRouteActivated`（bugs/0006 专门测的场景）
  14. **守卫顺序**：给目标路由挂一个无条件拦截的 `beforeEach`（或 `beforeEnter`），从当前页发起导航——当前页的 `onBeforeRouteLeave`/`onBeforeRouteUpdate` **不应该**出现在 console 里（导航压根没资格发生，不该问"要不要离开"）；换成一个会放行的 `beforeEach`，正常导航一次，`onBeforeRouteLeave` 应该照常触发（确认没有连带把正常场景也拦掉）；守卫重定向场景（`beforeEnter` 返回字符串）下，离开守卫应该只触发一次（在重定向目标那次导航里），不应该在被拦截的原始导航里也触发一次（bugs/0007）
  7. 守卫重定向回"当前就在的页面"时，确认没有多余的 stack 节点、没有多播一次过渡动画——用 `MutationObserver` 盯 class 变化比截图肉眼看更可靠
  8. **弹层栈叠加**：`push` 打开二级弹层要保留一级弹层挂载，`replace` 要销毁一级弹层；关闭/物理返回/物理前进要能正确地一层一层增减，且不能相互吞掉对方（0005）
  9. **弹层内容里的 `onBeforeRouteLeave`/`onBeforeRouteUpdate`** 要能正常触发（弹层组件也走 `EntryProvider`）
  10. **嵌套路由**：布局 + 子路由能正确渲染；父路由 `beforeEnter` 对子孙路由级联生效；用 `replace()` 在共享布局的兄弟子路由间切换时，布局组件实例标记（比如一个 setup() 里生成一次的随机串）不变、子路由组件的标记会变；直接深链接访问子路由 URL、物理返回都要正常

## 待补齐的方向（按需再做，不是当前范围）

- 没有 `<RouterLink>`。
- 没有多视图/master-detail 布局（F7 那套复杂度目前没有移植过来）。
- `onBeforeRouteLeave`/`onBeforeRouteUpdate`/`onBeforeRouteEnter` 是按 entry 登记的，不区分嵌套路由链上的具体层级（见设计决策 13）。
- 守卫阻止物理前进/后退时会有一瞬间的地址栏闪烁（`history.go()` 撤销导致），暂未做更精细的处理。
- 弹层没有 Esc 键关闭（只支持点遮罩关闭 + `router.back()`）。

这些如果之后要做，属于"新增功能/功能变动"，要同步更新 README.md 和这份文件；过程中顺带修的具体 bug，仍然按上面的约定单独记一篇 `bugs/`。
