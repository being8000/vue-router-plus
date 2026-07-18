import { createGZRouter } from 'gz-vue-router';
import { routes } from './routes';

export const router = createGZRouter({
  routes,
  initialUrl: '/',
  syncBrowserHistory: true,
});

// 全局前置守卫：演示用途——只读地记录一次导航即将发生，不参与放行/取消判断
// （返回 false/地址会取消或重定向本次导航，这里什么都不返回等价于放行）。
// 注意：首屏落地不会触发 beforeEach（避免“被拦截后卡在空白页”这种没有兜底的场景），
// 只有后续的应用内导航 / 物理前进后退才会经过这里。
router.beforeEach((to, from) => {
  console.info(`[gz-vue-router] beforeEach: ${from.fullPath || '(initial)'} -> ${to.fullPath}`);
});

// 全局后置钩子：演示用途——根据目标路由的 meta.title 同步浏览器标签页标题。
// 这是纯副作用，不影响导航结果，所以放在 afterEach 里（而不是 beforeEach），
// 首屏落地也会触发一次，保证刚打开页面标题就是对的。
router.afterEach((to) => {
  if (typeof document !== 'undefined' && to.meta.title) {
    document.title = `${to.meta.title} · gz-vue-router demo`;
  }
});
