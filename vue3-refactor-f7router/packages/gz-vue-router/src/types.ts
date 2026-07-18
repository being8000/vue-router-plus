import type { Component } from 'vue';

export type Direction = 'forward' | 'backward' | 'none';

export interface RouteMeta {
  /** URL 可寻址的弹层：命中该路由时不入栈显示为整页，而是叠加在背景页/其它弹层之上打开 */
  modal?: boolean;
  /** <GZModalView> 渲染这条弹层路由时，附加在弹层卡片外层容器上的行内样式（比如 maxWidth） */
  modalStyle?: Record<string, string | number>;
  title?: string;
  [key: string]: unknown;
}

/** 导航目标：路径字符串，或者命名路由 + params/query（对齐 vue-router 的 RouteLocationRaw） */
export type RouteLocationRaw =
  | string
  | {
      name: string;
      params?: Record<string, string | number>;
      query?: Record<string, string>;
    };

/** 路由配置项，字段命名对齐 vue-router 的 RouteRecordRaw */
export interface RouteRecordRaw {
  path: string;
  name: string;
  component: Component;
  meta?: RouteMeta;
  /**
   * 路由独享守卫：在“进入”这条路由、或“进入这条路由的任意子孙路由”时都会触发
   * （子孙路由被匹配到时，守卫按祖先→子孙的顺序依次收集，父路由的守卫先跑）。
   */
  beforeEnter?: NavigationGuard | NavigationGuard[];
  /**
   * 子路由：path 默认相对父路由拼接（比如父 `/dashboard` + 子 `stats` = `/dashboard/stats`），
   * 以 `/` 开头则视为绝对路径。父路由通常也要提供 `component` 作为整体布局，
   * 布局组件自己的模板里放一个嵌套的 <GZRouterView> 来渲染匹配到的子路由。
   */
  children?: RouteRecordRaw[];
  /**
   * 标记这条路由对应的页面栈 entry 为"持久化"：正常情况下 <GZRouterView> 只同时挂载页面栈
   * 最后两条（当前页 + 上一页），更早的会被真正卸载；标了 persistent 的页面即使被挤出这两层
   * 可视窗口，组件实例也不会被销毁（只是隐藏），之后不管跳出去多少层再返回，都是"重新变回
   * 当前页"而不是重新创建——onBeforeRouteEnter/onRouteActivated 会按重新激活来触发，不会
   * 触发 onMounted。只在页面栈叶子路由上检查（不像 beforeEnter 那样沿 chain 级联），
   * 弹层路由（meta.modal）不需要这个——modalStack 本来就整体常驻挂载。
   */
  persistent?: boolean;
}

/** 归一化后的当前路由信息，对齐 vue-router 的 RouteLocationNormalized（裁剪掉本项目用不到的字段） */
export interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  name: string;
  params: Record<string, string>;
  query: Record<string, string>;
  meta: RouteMeta;
}

export type NavigationGuardReturn = void | boolean | string | RouteLocationRaw;

/**
 * 导航守卫。支持两种调用方式（和 vue-router 一致），用单一函数签名（而不是两个函数类型的
 * union）声明，是为了让 TS 能对传进来的箭头函数做正确的上下文类型推导（union 类型会导致
 * `to`/`from` 参数被推成 any，见 CLAUDE.md 设计决策 8）：
 * - 现代写法：只声明 `(to, from)`，返回值决定放行/取消/重定向，支持返回 Promise
 * - 兼容写法：声明第三个 `next` 参数，通过运行时判断函数的形参个数（arity）来识别并调用
 *   `next()`/`next(false)`/`next('/path')`
 *
 * `next` 在类型上是可选的——这是必须的，因为同一个类型既要兼容"只声明 2 个参数"的现代写法，
 * 也要兼容"声明 3 个参数"的兼容写法（一个要求 3 个参数都必填的重载签名会让两种写法互不兼容，
 * 实测会报"Expected 3 or more, but got 2"）。代价是写兼容写法时，TS 会认为 `next` 可能是
 * `undefined`，需要用 `next?.(...)` 调用，而不是 `next(...)`——这不是疏漏，运行时
 * （`guards.ts` 的 `runGuard`）保证只要声明了第三个形参就一定会传入真正的 `next` 函数，
 * `next?.(...)` 在这里永远会成功调用，只是满足 TS 的判空要求。
 */
export type NavigationGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next?: (result?: NavigationGuardReturn) => void,
) => NavigationGuardReturn | Promise<NavigationGuardReturn> | void;

export type AfterHook = (to: RouteLocationNormalized, from: RouteLocationNormalized) => void;

/** 内部使用：一次路由匹配的结果 */
export interface MatchedRoute {
  /** 叶子路由记录（未嵌套时就是唯一匹配到的那条），大多数地方（modal/component/beforeEnter 单独取用时）只关心它 */
  route: RouteRecordRaw;
  /** 从根到叶的完整路由记录链，未嵌套时长度为 1 且等于 [route]；用于渲染嵌套布局、级联收集祖先的 beforeEnter */
  chain: RouteRecordRaw[];
  params: Record<string, string>;
  path: string;
  url: string;
}

export interface StackEntry {
  id: number;
  seq: number;
  matched: MatchedRoute;
}

export interface GZRouterOptions {
  routes: RouteRecordRaw[];
  /** 应用默认路由（找不到上一页历史时的兜底目标），默认 '/' */
  initialUrl?: string;
  /** 是否把内部页面栈同步到浏览器地址栏/前进后退按钮 */
  syncBrowserHistory?: boolean;
}
