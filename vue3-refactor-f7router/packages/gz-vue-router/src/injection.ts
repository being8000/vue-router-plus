import { inject } from 'vue';
import { ROUTER_KEY, ROUTE_KEY } from './injection-keys';
import type { GZRouter } from './router';
import type { RouteLocationNormalized } from './types';

/** 对齐 vue-router 的 useRouter()：拿到路由实例，可调用 push/replace/back/go 等方法 */
export function useRouter(): GZRouter {
  const router = inject(ROUTER_KEY);
  if (!router) {
    throw new Error('[gz-vue-router] useRouter() 必须在 app.use(router) 安装之后、组件 setup() 内调用');
  }
  return router;
}

/** 对齐 vue-router 的 useRoute()：拿到响应式的当前路由对象，字段可直接访问（route.params.id），无需 .value */
export function useRoute(): RouteLocationNormalized {
  const route = inject(ROUTE_KEY);
  if (!route) {
    throw new Error('[gz-vue-router] useRoute() 必须在 app.use(router) 安装之后、组件 setup() 内调用');
  }
  return route;
}
