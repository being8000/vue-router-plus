import { getCurrentInstance, inject, onUnmounted } from 'vue';
import { ENTRY_ID_KEY, ROUTER_KEY } from './injection-keys';
import type { NavigationGuard } from './types';

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
