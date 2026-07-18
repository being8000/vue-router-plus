<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, onBeforeRouteEnter, onRouteActivated } from 'gz-vue-router';
import { useHookLog } from '../composables/useHookLog';
import HookLogCard from './HookLogCard.vue';

defineProps<{ id: string }>();

const { entries, log } = useHookLog();

// 这是 DOM 树里最深的一层（DetailPage -> NestedChildLevel1 -> NestedChildLevel2 -> 这里），
// 中间隔了两层普通组件，不是 EntryProvider 直接的子节点——用来验证 inject(ENTRY_ID_KEY) 能
// 正常沿着组件树往下穿透任意深度，四个钩子在这里注册和在页面根组件注册效果完全一样。
onMounted(() => console.log('nested-3 mounted'));
onUnmounted(() => console.log('nested-3 unMounted'));

onBeforeRouteLeave(() => {
  log('onBeforeRouteLeave', '(深度3)');
  console.log('nested-3 onBeforeRouteLeave');
  return true;
});
onBeforeRouteUpdate((to) => {
  log('onBeforeRouteUpdate', to.fullPath);
  console.log('nested-3 onBeforeRouteUpdate:', to.fullPath);
});
onBeforeRouteEnter((to) => {
  log('onBeforeRouteEnter', to.fullPath);
  console.log('nested-3 onBeforeRouteEnter:', to.fullPath);
  return true;
});
onRouteActivated((to) => {
  log('onRouteActivated', to.fullPath);
  console.log('nested-3 onRouteActivated:', to.fullPath);
});
</script>

<template>
  <HookLogCard :title="`第 3 层嵌套子组件（id=${id}，全部四个钩子）`" :entries="entries" />
</template>
