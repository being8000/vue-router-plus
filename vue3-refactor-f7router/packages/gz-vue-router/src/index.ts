export { createGZRouter } from './router';
export type { GZRouter } from './router';
export { useRouter, useRoute } from './injection';
export { onBeforeRouteLeave, onBeforeRouteUpdate } from './composables';
export { resolveUrl } from './matcher';
export { default as GZRouterView } from './components/GZRouterView.vue';
export { default as GZModalView } from './components/GZModalView.vue';

export type {
  RouteRecordRaw,
  RouteLocationRaw,
  RouteLocationNormalized,
  RouteMeta,
  NavigationGuard,
  NavigationGuardReturn,
  AfterHook,
  Direction,
  GZRouterOptions,
  StackEntry,
} from './types';
