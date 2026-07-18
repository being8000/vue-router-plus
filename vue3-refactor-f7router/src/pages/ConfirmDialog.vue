<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'gz-vue-router';

const router = useRouter();

// 证明弹层内容也能正常用 onBeforeRouteLeave——之前版本弹层不走 EntryProvider，这个调用不会生效
const hasUnsavedChanges = ref(false);
onBeforeRouteLeave(() => {
  if (!hasUnsavedChanges.value) return true;
  return window.confirm('这个二级弹层有未保存的更改，确定要关闭吗？');
});
</script>

<template>
  <v-card>
    <v-card-title>二级弹层</v-card-title>
    <v-card-text>
      这是从设置弹层里打开的第二层弹层。如果打开时用的是 <code>router.push()</code>，
      上一层设置弹层会保留在下面（关闭这层后能看到它）；如果用的是 <code>router.replace()</code>，
      上一层设置弹层在打开这层的同时就已经被销毁了。
      <v-checkbox
        v-model="hasUnsavedChanges"
        label="模拟这一层弹层有未保存的更改"
        hide-details
        density="compact"
        class="mt-2"
      />
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn color="primary" @click="router.back()">关闭</v-btn>
    </v-card-actions>
  </v-card>
</template>
