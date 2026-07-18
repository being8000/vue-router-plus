import { createGZRouter } from 'gz-vue-router';
import { routes } from './routes';

export const router = createGZRouter({
  routes,
  initialUrl: '/',
  syncBrowserHistory: true,
});

// 全局前置守卫：演示 vue-router 的旧写法 (to, from, next)——用 meta.auth 模拟登录态校验。
// 注意：首屏落地不会触发 beforeEach（避免“被拦截后卡在空白页”这种没有兜底的场景），
// 只有后续的应用内导航 / 物理前进后退才会经过这里。
//
// 用了 (to, from, next) 这种旧写法，就必须在每一条代码路径上都调用一次 next()——包括
// “直接放行”这种看起来什么都不用做的情况。next 在类型上是可选的（NavigationGuard 要同时
// 兼容 (to,from) 和 (to,from,next) 两种写法），但运行时的调度（guards.ts 的 runGuard）是
// 靠“这个函数是不是声明了 3 个形参”来判断走哪种调用方式的——只要声明了 next，运行时就只认
// “调用 next() 才算这次守卫有了结果”，不会去看函数的返回值。忘记在某条分支里调用 next()，
// 这次导航会永远卡住（Promise 不会 resolve），不会有任何报错提示——这也是真实 vue-router 3.x
// 里同样存在的经典坑，不是这个包特有的限制。
router.beforeEach((to, from, next) => {
  if (to.meta?.auth) {
    next?.('/login');
    return;
  }
  console.info(`[gz-vue-router] beforeEach: ${from.fullPath || '(initial)'} -> ${to.fullPath}`);
  next?.();
});
// 全局后置钩子：演示用途——根据目标路由的 meta.title 同步浏览器标签页标题。
// 这是纯副作用，不影响导航结果，所以放在 afterEach 里（而不是 beforeEach），
// 首屏落地也会触发一次，保证刚打开页面标题就是对的。
router.afterEach((to) => {
  if (typeof document !== 'undefined' && to.meta.title) {
    document.title = `${to.meta.title} · gz-vue-router demo`;
  }
});
