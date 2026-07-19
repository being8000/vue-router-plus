<script setup lang="ts">
import { computed, inject, provide } from 'vue';
import { useRouter } from '../injection';
import { CHAIN_KEY, DEPTH_KEY } from '../injection-keys';
import EntryProvider from './EntryProvider.vue';

/**
 * 对齐 vue-router 的 <router-view>：同一个组件既能当根视图用（在 App.vue 里直接放一个，
 * 负责整条页面栈的滑动过渡动画），也能当嵌套视图用（放在某个布局组件自己的模板里，
 * 渲染路由记录链里更深一层的子路由）——靠有没有从祖先 inject 到 DEPTH_KEY 来区分自己是谁。
 *
 * 根视图（未 inject 到 DEPTH_KEY）：读 router.stack，用 TransitionGroup 做前进/后退滑动过渡，
 * 和之前完全一样；只是现在渲染的是 entry.matched.chain[0]（未嵌套时 chain 长度为 1，
 * chain[0] 就是原来唯一的那个组件，行为不变）。
 *
 * 嵌套视图（inject 到了 DEPTH_KEY）：不碰 router.stack、不做任何过渡动画，只是单纯根据注入的
 * chain + depth 渲染 chain[depth] 对应的组件——这一层的“动不动画”完全由外层布局组件自己决定
 * （比如布局想要内容区切换有动画，自己在模板里包一层 <Transition>）。
 */
const injectedDepth = inject(DEPTH_KEY, undefined);
const chainCtx = inject(CHAIN_KEY, undefined);
const isNested = injectedDepth != null;

if (isNested) {
  provide(DEPTH_KEY, (injectedDepth as number) + 1);
}

const nestedComponent = computed(() => {
  if (!isNested || !chainCtx) return undefined;
  return chainCtx.value.chain[injectedDepth as number]?.component;
});
const nestedParams = computed(() => {
  if (!isNested || !chainCtx) return {};
  return chainCtx.value.params;
});

const router = useRouter();

// 正常只需要同时挂载“当前页”和“上一页”两层，其余更早的页面对视觉上没有意义（已被完全遮住），
// 直接不渲染让 Vue 卸载即可。但标了 route.persistent 的页面例外：即使被挤出这两层可视窗口，
// 也要继续渲染（只是隐藏），保持组件实例不被销毁——见下面 renderedEntries 的合并逻辑。
const top = computed(() => router.stack[router.stack.length - 1]);
const previous = computed(() => router.stack[router.stack.length - 2]);

// 顺序：is-dormant 的常驻页面排前面，当前/上一页排后面（顺序不影响视觉——三种状态的层叠顺序
// 完全由各自 class 的 z-index 决定，这里只是让常驻页面在数组前面保持相对稳定）。
// 用同一个数组、只是给已有元素换 class 的方式，能让这几个 entry 从头到尾待在 TransitionGroup
// 同一份被追踪的子节点列表里——之后从 is-dormant 变成 is-previous/is-current 只是一次 class
// 切换，不会被 TransitionGroup 当成“新增”，不会触发 enter 过渡、更不会重新挂载组件。
const renderedEntries = computed(() => {
  const last2 = router.stack.slice(-2);
  const dormant = router.stack.filter((entry) => !last2.includes(entry) && entry.matched.route.persistent);
  return [...dormant, ...last2];
});

function entryClass(entry: (typeof renderedEntries.value)[number]) {
  if (entry === top.value) return 'is-current';
  if (entry === previous.value) return 'is-previous';
  return 'is-dormant';
}

// direction 是页面栈上“这次导航方向”的独立引用（不挂在具体某个 entry 上），
// 这样无论是应用内返回按钮还是物理/手势返回触发的 popstate，都能拿到正确的方向。
const groupName = computed(() => (router.direction.value === 'backward' ? 'gz-page-bwd' : 'gz-page-fwd'));
</script>

<template>
  <component :is="nestedComponent" v-if="isNested" v-bind="nestedParams" />
  <div v-else tag="div" class="gz-router-view" :name="groupName">
    <div
      v-for="entry in renderedEntries"
      :key="entry.id"
      class="gz-router-view__page"
      :class="entryClass(entry)"
    >
      <EntryProvider :entry-id="entry.id" :chain="entry.matched.chain" :params="entry.matched.params">
        <component :is="entry.matched.chain[0].component" v-bind="entry.matched.params" />
      </EntryProvider>
    </div>
  </div>
</template>

<style scoped>
.gz-router-view {
  position: relative;
  overflow: hidden;
  height: 100%;
  width: 100%;
}
.gz-router-view__page {
  position: absolute;
  inset: 0;
  overflow: auto;
  will-change: transform;
  transition: transform var(--gz-page-transition-duration, 400ms)
    var(--gz-page-transition-easing, cubic-bezier(0, 0.8, 0.3, 1));
}
.gz-router-view__page.is-current {
  transform: translate3d(0, 0, 0);
  z-index: 2;
}
.gz-router-view__page.is-previous {
  transform: translate3d(-24px, 0, 0);
  z-index: 1;
  /* 退居后一层的页面仅做视觉展示，不应再响应点击/聚焦 */
  pointer-events: none;
}
.gz-router-view__page.is-dormant {
  /* persistent 页面被挤出可视窗口时的状态：组件继续挂载（状态保留），但不可见、不可交互，
     也不参与层叠——visibility:hidden 顺带把它从 tab 顺序/无障碍树里摘掉，比 opacity:0 更彻底 */
  visibility: hidden;
  pointer-events: none;
  z-index: 0;
}
</style>
