<script setup lang="ts">
import { useRouter } from 'gz-vue-router';

const router = useRouter();

function pushConfirm() {
  // push：这一层设置弹层保留挂载，二级弹层叠在它上面
  router.push({ name: 'confirm' });
}
function replaceConfirm() {
  // replace：这一层设置弹层被销毁，只剩二级弹层
  router.replace({ name: 'confirm' });
}
</script>

<template>
  <v-card class="tw-max-w-100" style="max-width: 500px;margin-bottom: 200px;">
    <v-card-title>设置</v-card-title>
    <v-card-text>
      这是一个"URL 可寻址"的弹层路由（对应文档里 F7 modal.js 的设计模式）：
      通过 <code>route.meta.modal</code> 声明为弹层，挂载在 <code>&lt;GZModalView /&gt;</code>
      自带的遮罩+卡片容器里（不依赖 Vuetify 的 v-dialog）。无论点击下面按钮还是点击遮罩关闭，
      都会调用 <code>router.back()</code>，保持 URL/历史栈与实际显示状态一致。
    </v-card-text>
    <v-card-actions class="flex-wrap">
      <v-btn variant="tonal" @click="pushConfirm">push 打开二级弹层（保留这一层）</v-btn>
      <v-btn variant="tonal" @click="replaceConfirm">replace 打开二级弹层（销毁这一层）</v-btn>
      <v-spacer />
      <v-btn color="primary" @click="router.back()">关闭</v-btn>
    </v-card-actions>
  </v-card>
</template>
