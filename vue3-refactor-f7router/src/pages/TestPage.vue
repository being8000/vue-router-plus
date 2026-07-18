<script setup lang="ts">
import { useRouter } from 'gz-vue-router';

const router = useRouter();
</script>

<template>
  <div class="page-shell">
    <v-toolbar color="secondary" density="comfortable" flat>
      <template #prepend>
        <v-btn icon="mdi-arrow-left" @click="router.back()" />
      </template>
      <v-toolbar-title>/test 深链接页</v-toolbar-title>
    </v-toolbar>
    <div class="page-shell__content">
      <v-container>
        <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
          用来验证"直接在地址栏输入深层路径"这种场景：这个页面通常不是靠应用内点击到达的。
          点击左上角返回：如果这个浏览器 tab 里在它之前还有真实的历史记录，会正确返回上一页；
          如果这是这个 tab 里加载的第一个页面（没有可回退的历史），会自动跳转到首页。
        </v-alert>
        <v-card>
          <v-card-text>
            <code>router.canGoBack</code> 当前值：
            <strong>{{ router.canGoBack.value ? '存在可回退的历史' : '这是第一页，无历史可退' }}</strong>
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
