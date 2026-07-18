import { getCurrentInstance, inject, onMounted, onUnmounted } from 'vue';
import { ENTRY_ID_KEY, ROUTER_KEY } from './injection-keys';
import type { NavigationGuard, RouteLocationNormalized } from './types';

/**
 * 对齐 vue-router 的 onBeforeRouteLeave：在页面组件 setup() 里注册一个守卫，
 * 当这个组件即将“不再是当前页”时触发（无论是应用内返回、前进到别的页面，还是物理返回/前进）。
 *
 * 和 vue-router 的语义有一点刻意的差异：vue-router 的 beforeRouteLeave 绑定的是“组件即将被
 * 销毁”，而 gz-vue-router 为了支持滑动过渡动画，前进导航时旧页面其实还挂载在背景里、并没有被
 * 销毁——但从“用户离开了这个页面的关注焦点”这个守卫真正要保护的场景（未保存的修改、正在进行的
 * 操作）来看，这里选择在“不再是当前页”时就触发，更符合这个 API 的实际使用目的。
 *
 * 仅对通过 <GZRouterView> 渲染的页面级路由生效；弹层路由（meta.modal）内容不会提供 entry 上
 * 下文，调用这个函数不会有任何效果（这是当前版本的已知范围限制，弹层通常也不需要“离开确认”）。
 */
export function onBeforeRouteLeave(guard: NavigationGuard) {
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error('[gz-vue-router] onBeforeRouteLeave 必须在组件 setup() 内调用');
  }
  const router = inject(ROUTER_KEY);
  const entryId = inject(ENTRY_ID_KEY, null);
  if (!router || entryId == null) return;

  router._registerLeaveGuard(entryId, guard);
  onUnmounted(() => router._unregisterLeaveGuard(entryId, guard));
}

/**
 * 对齐 vue-router 的 onBeforeRouteUpdate：当同一个组件实例被复用、只是路由参数变化时触发
 * （对应 gz-vue-router 里 `router.replace()` 命中“目标组件和当前页组件相同”的原地更新场景）。
 */
export function onBeforeRouteUpdate(guard: NavigationGuard) {
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error('[gz-vue-router] onBeforeRouteUpdate 必须在组件 setup() 内调用');
  }
  const router = inject(ROUTER_KEY);
  const entryId = inject(ENTRY_ID_KEY, null);
  if (!router || entryId == null) return;

  router._registerUpdateGuard(entryId, guard);
  onUnmounted(() => router._unregisterUpdateGuard(entryId, guard));
}

/**
 * gz-vue-router 特有的钩子，vue-router 没有对应概念——因为 <GZRouterView> 为了做滑动过渡动画，
 * 会同时挂载“当前页”和“上一页”两层（<GZModalView> 更彻底，弹层栈里的每一层从打开到关闭全程
 * 都挂载着），页面离开当前焦点（触发 onBeforeRouteLeave）之后，组件实例往往并没有被销毁，
 * 只是被踢到了背景里。等用户再返回到这个页面时，因为组件实例本来就还活着，Vue 不会重新触发
 * `onMounted`——onBeforeRouteEnter 就是用来补上这个空档的：只在“这个组件实例本来就没被销毁，
 * 现在要重新变回当前页/当前弹层”时触发，纯粹首次挂载（第一次导航进入这个路由）不会触发，
 * 那种场景 `onMounted` 已经够用。
 *
 * 和 vue-router 真正的 `beforeRouteEnter`不是一回事：vue-router 那个是在组件实例还不存在时
 * 触发的导航守卫（每次进入这条路由都会触发，包括第一次），靠 `next(vm => {})` 拿到实例；
 * 这里反过来，触发时组件实例必然已经存在（从未被销毁过），语义更接近"重新激活"
 * （类似 `<KeepAlive>` 的 `onActivated`），只是复用了导航守卫的调用方式（可以返回 false/
 * 重定向取消这次导航），和 onBeforeRouteLeave/onBeforeRouteUpdate 保持同样的 API 形状。
 */
export function onBeforeRouteEnter(guard: NavigationGuard) {
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error('[gz-vue-router] onBeforeRouteEnter 必须在组件 setup() 内调用');
  }
  const router = inject(ROUTER_KEY);
  const entryId = inject(ENTRY_ID_KEY, null);
  if (!router || entryId == null) return;

  router._registerEnterGuard(entryId, guard);
  onUnmounted(() => router._unregisterEnterGuard(entryId, guard));
}

/**
 * gz-vue-router 特有的钩子：只要这个组件对应的 entry 变成 is-current（页面栈顶）或者
 * 弹层栈顶，就会触发——不区分是首次挂载（首屏加载、刷新、push/replace 新建）还是
 * onBeforeRouteEnter 覆盖的"重新变回当前层"（组件实例本来就没被销毁）。
 *
 * 和 onBeforeRouteEnter 的区别：onBeforeRouteEnter 只覆盖"重新激活"这一种场景，且是
 * 导航守卫（可以返回 false/重定向取消导航）；onRouteActivated 覆盖首次挂载 + 重新激活
 * 两种场景，但纯粹是"已确定会展示"之后的只读通知，不参与守卫链，回调返回值会被忽略。
 *
 * 内部靠两路信号合并实现，谁都不能单独覆盖全部场景：
 * 1. onMounted + 挂载那一刻校验"我是不是真的是栈顶"——因为多级 popstate 回退时，
 *    早就被销毁过的 entry 可能会被重新创建，但落地位置是 is-previous 而不是 is-current
 *    （比如深了 3 级后物理返回一次，首页被顺带带回可视窗口，但当前页其实是它前面那个），
 *    这种情况必须过滤掉，不能只要 onMounted 触发就当作"变成当前层"。
 * 2. 组件实例本来就没被销毁、只是被踢在背景里，现在被重新顶回当前层——这种不会重新触发
 *    onMounted，靠 router 内部在 mutate() 之后对比栈顶 id 的登记表来通知（和
 *    onBeforeRouteEnter 依赖的 enterGuardsMap 是分开的两张表，因为这个钩子不该有取消
 *    导航的副作用）。
 */
export function onRouteActivated(callback: (to: RouteLocationNormalized) => void) {
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error('[gz-vue-router] onRouteActivated 必须在组件 setup() 内调用');
  }
  const router = inject(ROUTER_KEY);
  const entryId = inject(ENTRY_ID_KEY, null);
  if (!router || entryId == null) return;

  onMounted(() => {
    const isTop = router.stack[router.stack.length - 1]?.id === entryId;
    const isTopModal = router.modalStack[router.modalStack.length - 1]?.id === entryId;
    if (isTop || isTopModal) callback(router.currentRoute);
  });

  const activatedCallback = (to: RouteLocationNormalized) => callback(to);
  router._registerActivatedCallback(entryId, activatedCallback);
  onUnmounted(() => router._unregisterActivatedCallback(entryId, activatedCallback));
}
