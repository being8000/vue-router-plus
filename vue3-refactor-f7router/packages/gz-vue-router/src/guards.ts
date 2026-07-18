import type { NavigationGuard, NavigationGuardReturn, RouteLocationNormalized, RouteLocationRaw } from './types';

/**
 * 执行单个守卫，兼容 vue-router 的两种写法：
 * - 现代写法：`(to, from) => 返回值`，支持返回 Promise
 * - 兼容写法：`(to, from, next) => void`，通过函数声明的形参个数（arity）识别，
 *   调用 next() 放行、next(false) 取消、next('/path') 重定向
 */
function runGuard(
  guard: NavigationGuard,
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): Promise<NavigationGuardReturn> {
  // guard.length 反映的是“实际传入的函数”声明了几个形参（JS 运行时特性），
  // 和类型签名里 next 是否标了可选无关，因此这里仍然可以用它来识别调用方式
  if (guard.length >= 3) {
    return new Promise((resolve) => {
      guard(to, from, (result) => resolve(result));
    });
  }
  const result = guard(to, from);
  return Promise.resolve(result);
}

export interface GuardOutcome {
  /** true = 放行；false = 取消；string/对象 = 需要重定向 */
  allowed: boolean;
  redirect?: RouteLocationRaw;
}

/** 依次执行一组守卫，遇到第一个“非放行”结果就短路返回 */
export async function runGuardSequence(
  guards: NavigationGuard[],
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): Promise<GuardOutcome> {
  for (const guard of guards) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runGuard(guard, to, from);
    if (result === false) return { allowed: false };
    if (typeof result === 'string' || (result && typeof result === 'object')) {
      return { allowed: false, redirect: result };
    }
  }
  return { allowed: true };
}
