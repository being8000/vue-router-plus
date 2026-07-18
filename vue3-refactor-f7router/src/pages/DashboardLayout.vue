<script setup lang="ts">
import { ref } from 'vue';
import { GZRouterView, useRouter, useRoute, onBeforeRouteUpdate } from 'gz-vue-router';

const router = useRouter();
const route = useRoute();

// 用来证明:两个子路由之间切换时,这个布局组件实例没有被重建(标记不变),
// 但确实感知到了子路由的变化(onBeforeRouteUpdate 触发次数增加)
const instanceTag = Math.random().toString(36).slice(2, 8);
const updateCount = ref(0);
onBeforeRouteUpdate(() => {
  updateCount.value += 1;
});
</script>

<template>
  <div class="page-shell">
    <v-toolbar color="secondary" density="comfortable" flat>
      <template #prepend>
        <v-btn icon="mdi-arrow-left" @click="router.back()" />
      </template>
      <v-toolbar-title>仪表盘（嵌套路由布局）</v-toolbar-title>
    </v-toolbar>
    <v-tabs :model-value="route.name" grow @update:model-value="(name) => router.replace({ name: String(name) })">
      <v-tab value="dashboard-overview">概览</v-tab>
      <v-tab value="dashboard-stats">统计</v-tab>
    </v-tabs>
    <v-alert type="info" variant="tonal" density="compact" class="ma-2">
      这个工具栏 + 标签页是 <code>DashboardLayout</code> 布局组件自己的内容，在两个子路由之间切换
      （<code>replace</code>）时不会重新挂载——切换只会替换下面 <code>&lt;GZRouterView /&gt;</code>
      渲染的子路由内容。<code>/dashboard</code> 这条父路由自带的 <code>beforeEnter</code> 守卫会对
      它和它的所有子路由生效（打开 devtools 控制台能看到日志）。
      <div class="mt-1">
        布局组件实例标记：<code>{{ instanceTag }}</code>（切换标签页前后应保持不变），
        onBeforeRouteUpdate 触发次数：<strong>{{ updateCount }}</strong>
      </div>
    </v-alert>
    <div class="page-shell__content">
      <GZRouterView />
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
