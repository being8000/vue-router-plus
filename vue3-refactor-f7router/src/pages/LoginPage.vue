<script setup lang="ts">
import { useRouter } from 'gz-vue-router';

const router = useRouter();

function fakeLogin() {
  // 演示用：没有真实的登录态存储，这里直接 replace 回首页
  // （replace 而不是 push——不应该在历史里留下这条 /login 记录，"返回"不应该退回登录页）
  router.replace('/');
}
</script>

<template>
  <div class="page-shell">
    <v-toolbar color="secondary" density="comfortable" flat>
      <v-toolbar-title>登录</v-toolbar-title>
    </v-toolbar>
    <div class="page-shell__content">
      <v-container>
        <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
          这个页面是被全局 <code>beforeEach</code> 里的 <code>next('/login')</code> 重定向过来的——
          仪表盘那条路由标了 <code>meta: {{ '{' }} auth: true {{ '}' }}</code>，
          <code>beforeEach</code> 判断到未登录就用 vue-router 那种"旧写法"
          （<code>(to, from, next) => next('/login')</code>）拦下并转到这里，不是普通的
          <code>return '/login'</code> 写法。
        </v-alert>
        <v-card>
          <v-card-text>
            这里没有接真实的登录态，点击下面按钮模拟"登录成功"，会 <code>replace</code> 回首页
            （不留下这条 /login 的历史记录，返回键不会退回登录页）。
          </v-card-text>
          <v-card-actions>
            <v-btn color="primary" variant="tonal" @click="fakeLogin">模拟登录成功，返回首页</v-btn>
          </v-card-actions>
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
