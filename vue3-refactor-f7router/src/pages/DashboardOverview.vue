<script setup lang="ts">
// 用一个只在 setup() 运行时生成一次的随机串验证:在两个子路由之间切换时,这个组件真的被
// 卸载重建了(和 DashboardLayout 不同,子路由组件预期就是应该跟着切换重新挂载的)
const instanceTag = Math.random().toString(36).slice(2, 8);
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>概览</v-card-title>
      <v-card-text>
        这是嵌套在 <code>DashboardLayout</code> 里的子路由页面 <code>/dashboard/overview</code>。
        <div class="mt-2">组件实例标记：<code>{{ instanceTag }}</code></div>
      </v-card-text>
    </v-card>
  </v-container>
</template>
