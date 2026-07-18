<script setup lang="ts">
const instanceTag = Math.random().toString(36).slice(2, 8);
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>统计</v-card-title>
      <v-card-text>
        这是嵌套在 <code>DashboardLayout</code> 里的子路由页面 <code>/dashboard/stats</code>。
        <div class="mt-2">组件实例标记：<code>{{ instanceTag }}</code></div>
      </v-card-text>
    </v-card>
  </v-container>
</template>
