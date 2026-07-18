import type { RouteRecordRaw } from 'gz-vue-router';
import HomePage from '../pages/HomePage.vue';
import DetailPage from '../pages/DetailPage.vue';
import SettingsDialog from '../pages/SettingsDialog.vue';
import ConfirmDialog from '../pages/ConfirmDialog.vue';
import TestPage from '../pages/TestPage.vue';
import DashboardLayout from '../pages/DashboardLayout.vue';
import DashboardOverview from '../pages/DashboardOverview.vue';
import DashboardStats from '../pages/DashboardStats.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomePage, meta: { title: '首页' } },
  {
    path: '/detail/:id',
    name: 'detail',
    component: DetailPage,
    meta: { title: '订单详情' },
    // 路由独享守卫：只对 detail 这条路由生效。演示"拦截 + 重定向"——
    // id 超过 500 视为非法订单号，拦下并跳回首页，不进入 DetailPage。
    beforeEnter: (to) => {
      const id = Number(to.params.id);
      if (Number.isFinite(id) && id > 500) {
        console.warn(`[beforeEnter] 订单号 ${id} 不合法，重定向回首页`);
        return '/';
      }
      return true;
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsDialog,
    meta: { modal: true, title: '设置', modalStyle: { maxWidth: '480px' } },
  },
  {
    path: '/settings/confirm',
    name: 'confirm',
    component: ConfirmDialog,
    meta: { modal: true, title: '二级弹层', modalStyle: { maxWidth: '400px' } },
  },
  { path: '/test', name: 'test', component: TestPage, meta: { title: '深链接测试页' } },
  {
    // 嵌套路由演示：/dashboard 本身不独立可匹配（vue-router 语义，没有 path:'' 的默认子路由），
    // 父路由的 beforeEnter 会级联作用到 /dashboard/overview 和 /dashboard/stats 两条子路由上
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardLayout,
    meta: { title: '仪表盘' },
    beforeEnter: (to) => {
      console.info(`[beforeEnter] 进入 dashboard 分区：${to.fullPath}（父路由守卫，对所有子路由生效）`);
      return true;
    },
    children: [
      { path: 'overview', name: 'dashboard-overview', component: DashboardOverview },
      { path: 'stats', name: 'dashboard-stats', component: DashboardStats },
    ],
  },
];
