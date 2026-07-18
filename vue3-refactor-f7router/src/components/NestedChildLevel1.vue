<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { onBeforeRouteLeave, onRouteActivated } from 'gz-vue-router';
import { useHookLog } from '../composables/useHookLog';
import HookLogCard from './HookLogCard.vue';
import NestedChildLevel2 from './NestedChildLevel2.vue';

defineProps<{ id: string }>();

const { entries, log } = useHookLog();

onMounted(() => console.log('nested-1 mounted'));
onUnmounted(() => console.log('nested-1 unMounted'));

onBeforeRouteLeave(() => {
  log('onBeforeRouteLeave', '(深度1)');
  console.log('nested-1 onBeforeRouteLeave');
  return true;
});
onRouteActivated((to) => {
  log('onRouteActivated', to.fullPath);
  console.log('nested-1 onRouteActivated:', to.fullPath);
});
</script>

<template>
  <HookLogCard :title="`第 1 层嵌套子组件（id=${id}，onRouteActivated + onBeforeRouteLeave）`" :entries="entries" />
  <NestedChildLevel2 :id="id" />
</template>
