<script setup lang="ts">
import { computed, provide } from 'vue';
import { ENTRY_ID_KEY, CHAIN_KEY, DEPTH_KEY } from '../injection-keys';
import type { RouteRecordRaw } from '../types';

/**
 * 给每个渲染出来的页面/弹层单独建立一层 provide 上下文：
 * - ENTRY_ID_KEY：让 onBeforeRouteLeave/onBeforeRouteUpdate 能定位到“这是哪一个 stack/modalStack entry”。
 * - CHAIN_KEY + DEPTH_KEY：让嵌套在这个 entry 根组件内部的 <GZRouterView>（比如布局组件模板里的那个）
 *   知道该渲染路由记录链的第几层，从而支持“父路由是布局、子路由渲染在布局内部”的嵌套结构。
 *
 * <GZRouterView>/<GZModalView> 用 v-for 渲染多个 entry 时，同一个 setup() 没法为每次迭代 provide
 * 不同的值，所以需要这样一层每次迭代都各自实例化的包装组件。
 */
const props = defineProps<{ entryId: number; chain: RouteRecordRaw[]; params: Record<string, string> }>();
provide(ENTRY_ID_KEY, props.entryId);
provide(
  CHAIN_KEY,
  computed(() => ({ chain: props.chain, params: props.params })),
);
provide(DEPTH_KEY, 1);
</script>

<template>
  <slot />
</template>
