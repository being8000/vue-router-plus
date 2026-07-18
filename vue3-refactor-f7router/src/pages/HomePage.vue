<script setup lang="ts">
import { onBeforeRouteLeave, onBeforeRouteEnter, onRouteActivated, useRoute, useRouter } from 'gz-vue-router';
import { onMounted, onUnmounted } from 'vue';

const router = useRouter();
const route = useRoute();
const items = [
  { id: '1', title: '订单 #1001', subtitle: '已发货' },
  { id: '2', title: '订单 #1002', subtitle: '待付款' },
  { id: '3', title: '订单 #1003', subtitle: '已完成' },
];

function openDetail(id: string) {
  router.push({ name: 'detail', params: { id } });
}
function openInvalidDetail() {
  // 演示路由独享守卫（beforeEnter）：id > 500 会被 routes.ts 里的 beforeEnter 拦下并重定向回首页
  router.push({ name: 'detail', params: { id: '999' } });
}
function openSettings() {
  router.push({ name: 'settings' });
}
function openDashboard() {
  router.push({ name: 'dashboard-overview' });
}

onMounted(() => {
  console.log('home mounted')
})

onUnmounted(() => {
  console.log('home unMounted')
})

onBeforeRouteLeave(() => {
  console.log( 'home onBeforeRouteLeave')
  return true
})

// 首页从"当前页"变成背景里的"上一页"时不会 unmounted（这就是上面 onUnmounted 不会在
// 普通前进导航时打印的原因）；等用户再返回首页时，这个还活着的实例不会重新触发 onMounted，
// onBeforeRouteEnter 专门补上这个"重新变回当前页"的时机
onBeforeRouteEnter((to) => {
  console.log('home onBeforeRouteEnter: leaving', route.fullPath, '-> re-entering home as', to.fullPath)
  return true
})

// 覆盖首屏加载/刷新 + onBeforeRouteEnter 之外的"重新变回当前页"，统一在一个钩子里通知
onRouteActivated((to) => {
  console.log('home onRouteActivated:', to.fullPath)
})
</script>

<template>
  <div class="page-shell">
    <v-toolbar color="primary" density="comfortable" flat>
      <v-toolbar-title>首页</v-toolbar-title>
      <template #append>
        <v-btn icon="mdi-cog" @click="openSettings" />
      </template>
    </v-toolbar>
    <div class="page-shell__content">
      <v-container>
        <v-alert type="info" variant="tonal" class="mb-4" density="compact">
          这是 gz-vue-router 的验证页面：点击列表项走"前进"过渡（新页从右侧滑入），
          右上角齿轮按钮以 URL 弹层方式打开设置。
        </v-alert>
        <v-list lines="two">
          <v-list-item
            v-for="item in items"
            :key="item.id"
            :title="item.title"
            :subtitle="item.subtitle"
            @click="openDetail(item.id)"
          >
            <template #prepend>
              <v-avatar color="primary" variant="tonal">{{ item.id }}</v-avatar>
            </template>
            <template #append>
              <v-icon icon="mdi-chevron-right" />
            </template>
          </v-list-item>
        </v-list>
        <v-btn class="mt-4" variant="outlined" block @click="openInvalidDetail">
          跳转到订单 #999（会被 beforeEnter 拦截并重定向回首页）
        </v-btn>
        <v-btn class="mt-2" variant="tonal" block @click="openDashboard">
          打开仪表盘（嵌套路由：布局 + 子路由 + 父路由守卫级联演示）
        </v-btn>
      </v-container>
    </div>
  </div>
</template>

<style scoped>
.page-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-background));
}
.page-shell__content {
  flex: 1 1 auto;
  overflow: auto;
}
</style>
