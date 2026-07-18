import type { ComputedRef, InjectionKey } from 'vue';
import type { GZRouter } from './router';
import type { RouteLocationNormalized, RouteRecordRaw } from './types';

export const ROUTER_KEY: InjectionKey<GZRouter> = Symbol('gz-router');
export const ROUTE_KEY: InjectionKey<RouteLocationNormalized> = Symbol('gz-route');
/** 当前渲染的这个页面组件所属的 stack/modalStack entry id，供 onBeforeRouteLeave/onBeforeRouteUpdate 定位 */
export const ENTRY_ID_KEY: InjectionKey<number> = Symbol('gz-router-entry-id');

/**
 * 嵌套路由用：某个 entry 匹配到的完整路由记录链 + 这次导航的 params。
 * 由渲染 entry 根组件的 EntryProvider 提供一次，同一个 entry 下所有嵌套的 <GZRouterView>
 * 都读同一份（chain 不会随嵌套深度变化，变的只是下面的 DEPTH_KEY）。
 *
 * 用 ComputedRef 包一层而不是提供纯对象：entry 复用同一个 id 原地更新时（onBeforeRouteUpdate
 * 场景），EntryProvider 组件实例不会重建，props.chain/props.params 会变但 setup() 不会重跑，
 * 纯对象快照会读到旧值；ComputedRef 能让嵌套的 <GZRouterView> 读到最新值。
 * 注意不能用 reactive() 包——chain 里的 RouteRecordRaw.component 是原始 Vue 组件定义对象，
 * reactive() 会深层代理它，重蹈 bugs/0002 的覆辙；ComputedRef 只包一层容器，不会深层代理返回值。
 */
export interface ChainContext {
  chain: RouteRecordRaw[];
  params: Record<string, string>;
}
export const CHAIN_KEY: InjectionKey<ComputedRef<ChainContext>> = Symbol('gz-router-chain');

/**
 * 嵌套路由用：当前这层 <GZRouterView> 该渲染 chain 里的第几个记录。
 * 根层级的 <GZRouterView>（在 App.vue 里直接使用的那个）没有被注入这个 key，
 * 靠“有没有 inject 到值”区分自己是根视图（走页面栈+过渡动画）还是嵌套视图（只是单纯渲染 chain[depth]）。
 */
export const DEPTH_KEY: InjectionKey<number> = Symbol('gz-router-depth');
