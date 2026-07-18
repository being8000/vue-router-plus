import { match, compile } from 'path-to-regexp';
import type { MatchedRoute, RouteRecordRaw, RouteLocationRaw } from './types';

interface FlattenedRoute {
  /** 从根拼接到叶的完整路径模板 */
  fullPath: string;
  /** 从根到叶的完整路由记录链 */
  chain: RouteRecordRaw[];
}

function joinPaths(parentPath: string, childPath: string): string {
  if (childPath.startsWith('/')) return childPath; // 子路由自己写了绝对路径，不拼父路径
  const base = parentPath.endsWith('/') ? parentPath.slice(0, -1) : parentPath;
  if (childPath === '') return base || '/'; // 空字符串子路由：等价于父路由自己的路径（vue-router 的“默认子路由”写法）
  return `${base}/${childPath}`;
}

function flattenRoutes(routes: RouteRecordRaw[], parentPath = '', parentChain: RouteRecordRaw[] = []): FlattenedRoute[] {
  const result: FlattenedRoute[] = [];
  for (const route of routes) {
    const fullPath = joinPaths(parentPath, route.path);
    const chain = [...parentChain, route];
    if (route.children && route.children.length > 0) {
      // 有子路由的父路由本身不独立可匹配（和 vue-router 一致）：想让父路径本身也能命中，
      // 在 children 里加一条 path: '' 的“默认子路由”
      result.push(...flattenRoutes(route.children, fullPath, chain));
    } else {
      result.push({ fullPath, chain });
    }
  }
  return result;
}

// 路由表是静态配置，按 routes 数组的引用缓存展开结果，避免每次导航都重新递归展开
const flattenCache = new WeakMap<RouteRecordRaw[], FlattenedRoute[]>();
function getFlattened(routes: RouteRecordRaw[]): FlattenedRoute[] {
  let cached = flattenCache.get(routes);
  if (!cached) {
    cached = flattenRoutes(routes);
    flattenCache.set(routes, cached);
  }
  return cached;
}

export function findRouteByName(routes: RouteRecordRaw[], name: string): FlattenedRoute | undefined {
  return getFlattened(routes).find((flat) => flat.chain[flat.chain.length - 1].name === name);
}

export function matchByUrl(routes: RouteRecordRaw[], url: string): MatchedRoute | undefined {
  const path = url.split('?')[0];
  for (const { fullPath, chain } of getFlattened(routes)) {
    const matcher = match(fullPath, { decode: decodeURIComponent });
    const result = matcher(path);
    if (result) {
      return {
        route: chain[chain.length - 1],
        chain,
        params: result.params as Record<string, string>,
        path,
        url,
      };
    }
  }
  return undefined;
}

function parseQuery(url: string): Record<string, string> {
  const queryString = url.split('?')[1];
  if (!queryString) return {};
  return Object.fromEntries(new URLSearchParams(queryString));
}

/** 把字符串或命名路由目标统一编译成一个可导航的 URL 字符串 */
export function resolveUrl(routes: RouteRecordRaw[], to: RouteLocationRaw): string {
  if (typeof to === 'string') return to;
  const found = findRouteByName(routes, to.name);
  if (!found) throw new Error(`[gz-vue-router] route named "${to.name}" not found`);
  const toPath = compile(found.fullPath, { encode: encodeURIComponent });
  let url = toPath((to.params ?? {}) as Record<string, string>);
  if (to.query && Object.keys(to.query).length) {
    url += `?${new URLSearchParams(to.query).toString()}`;
  }
  return url;
}

export { parseQuery };
