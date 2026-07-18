<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'gz-vue-router';

const props = defineProps<{ id: string }>();
const router = useRouter();

// 用一个只在 setup() 运行时生成一次的随机串证明"组件实例是否被重建"——
// 如果 replace() 触发的是原地更新（onBeforeRouteUpdate），这个值应该在 id 变化前后保持不变；
// 如果是 push()/普通替换导致的重新挂载，这个值会变。
const instanceTag = Math.random().toString(36).slice(2, 8);

const hasUnsavedChanges = ref(false);
const updateCount = ref(0);

// 离开确认：只在 hasUnsavedChanges 打开时拦截，返回 false 会取消这次导航（应用内返回、
// 前进到别的页、物理返回/前进都会经过这里）
onBeforeRouteLeave(() => {
  if (!hasUnsavedChanges.value) return true;
  return window.confirm('这个订单详情页有未保存的更改，确定要离开吗？');
});

// 原地更新：router.replace() 命中"目标组件和当前页组件相同"时触发，组件实例不会被销毁重建
onBeforeRouteUpdate((to) => {
  updateCount.value += 1;
  console.info(`[onBeforeRouteUpdate] id: ${props.id} -> ${to.params.id}`);
});

function goDeeper() {
  const nextId = String(Number(props.id) + 100);
  router.push({ name: 'detail', params: { id: nextId } });
}
function replaceInPlace() {
  const nextId = String(Number(props.id) + 1);
  router.replace({ name: 'detail', params: { id: nextId } });
}
function goBack() {
  router.back();
}
</script>

<template>
  <div class="page-shell">
    <v-toolbar color="primary" density="comfortable" flat>
      <template #prepend>
        <v-btn icon="mdi-arrow-left" @click="goBack" />
      </template>
      <v-toolbar-title>订单详情 #{{ id }}</v-toolbar-title>
    </v-toolbar>
    <div class="page-shell__content">
      <v-container>
        <v-card>
          <v-card-item>
            <v-card-title>订单 #{{ id }}</v-card-title>
            <v-card-subtitle>点击"继续深入"验证多级前进/后退动画</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            当前处于第 {{ id }} 号详情页。返回按钮会触发"后退"过渡动画（当前页滑出淡出，
            上一页从 -24px 处滑回原位）。
          </v-card-text>
          <v-card-actions>
            <v-btn color="primary" variant="tonal" @click="goDeeper">继续深入下一级（push，新开一层）</v-btn>
            <v-btn variant="text" @click="goBack">返回上一页</v-btn>
          </v-card-actions>
        </v-card>

        <v-card class="mt-4">
          <v-card-item>
            <v-card-title class="text-body-1">onBeforeRouteUpdate 演示</v-card-title>
          </v-card-item>
          <v-card-text>
            <div>组件实例标记：<code>{{ instanceTag }}</code>（原地更新前后应保持不变）</div>
            <div>onBeforeRouteUpdate 触发次数：<strong>{{ updateCount }}</strong></div>
          </v-card-text>
          <v-card-actions>
            <v-btn color="secondary" variant="tonal" @click="replaceInPlace">
              replace 为订单 #{{ Number(id) + 1 }}（原地更新，不产生新的历史层级）
            </v-btn>
          </v-card-actions>
        </v-card>

        <v-card class="mt-4">
          <v-card-item>
            <v-card-title class="text-body-1">onBeforeRouteLeave 演示</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-checkbox v-model="hasUnsavedChanges" label="模拟这个页面有未保存的更改" hide-details density="compact" />
          </v-card-text>
        </v-card>
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
