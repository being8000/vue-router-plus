<script setup lang="ts">
import { useRouter } from '../injection';
import EntryProvider from './EntryProvider.vue';

/**
 * 渲染 router.modalStack 里维护的弹层历史——自己实现遮罩 + 卡片容器，不依赖 Vuetify 的
 * <v-dialog>。之所以不用 v-dialog：Vuetify 的 VOverlay 有一个默认开启的 closeOnBack 特性，
 * 它会自动探测 app 上是否挂了 `$router`，探测到就调用 `router.beforeEach()`/`afterEach()`
 * 注册自己的一套“物理返回关闭弹层”逻辑，这套逻辑和我们在 router.ts 的 popstate 里已经实现的
 * 物理返回处理会互相打架（两边都在响应同一次 popstate、又都尝试用 history API 去纠正对方），
 * 表现为守卫无限触发、页面卡死。详见 bugs/0002-vdialog-closeonback-conflict.md。
 *
 * 直接用 <TransitionGroup> 包一层 v-for，复用和 <GZRouterView> 一样的思路：
 * 新增/移除 router.modalStack 里的 entry 时，Vue 原生处理 enter/leave 过渡，不需要
 * 手动维护"关闭动画播完再真正卸载"这种两阶段状态机。
 */
const router = useRouter();

function onBackdropClick() {
  router.back();
}
</script>

<template>
  <TransitionGroup tag="div" class="gz-modal-view" name="gz-modal">
    <div v-for="entry in router.modalStack" :key="entry.id" class="gz-modal-view__backdrop" @click.self="onBackdropClick">
      <div class="gz-modal-view__dialog" :style="entry.matched.route.meta?.modalStyle">
        <EntryProvider :entry-id="entry.id" :chain="entry.matched.chain" :params="entry.matched.params">
          <component :is="entry.matched.chain[0].component" v-bind="entry.matched.params" />
        </EntryProvider>
      </div>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.gz-modal-view__backdrop {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 16px;
  box-sizing: border-box;
}
.gz-modal-view__dialog {
  width: 100%;
  max-width: 480px;
  max-height: calc(100vh - 32px);
  overflow: auto;
  border-radius: 4px;
}

.gz-modal-enter-active,
.gz-modal-leave-active {
  transition: opacity 200ms ease;
}
.gz-modal-enter-active .gz-modal-view__dialog,
.gz-modal-leave-active .gz-modal-view__dialog {
  transition: transform 200ms ease;
}
.gz-modal-enter-from,
.gz-modal-leave-to {
  opacity: 0;
}
.gz-modal-enter-from .gz-modal-view__dialog,
.gz-modal-leave-to .gz-modal-view__dialog {
  transform: scale(0.9);
}
</style>
