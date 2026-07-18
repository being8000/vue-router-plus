<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { onBeforeRouteUpdate, onBeforeRouteEnter } from 'gz-vue-router';
import { useHookLog } from '../composables/useHookLog';
import HookLogCard from './HookLogCard.vue';
import NestedChildLevel3 from './NestedChildLevel3.vue';

defineProps<{ id: string }>();

const { entries, log } = useHookLog();

onMounted(() => console.log('nested-2 mounted'));
onUnmounted(() => console.log('nested-2 unMounted'));

onBeforeRouteUpdate((to) => {
  log('onBeforeRouteUpdate', to.fullPath);
  console.log('nested-2 onBeforeRouteUpdate:', to.fullPath);
});
onBeforeRouteEnter((to) => {
  log('onBeforeRouteEnter', to.fullPath);
  console.log('nested-2 onBeforeRouteEnter:', to.fullPath);
  return true;
});
</script>

<template>
  <HookLogCard :title="`第 2 层嵌套子组件（id=${id}，onBeforeRouteUpdate + onBeforeRouteEnter）`" :entries="entries" />
  <NestedChildLevel3 :id="id" />
</template>
