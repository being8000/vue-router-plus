<script setup lang="ts">
import { GZRouterView, GZModalView } from 'gz-vue-router';
</script>

<template>
  <v-app class="app-root">
    <div class="app-viewport">
      <GZRouterView />
    </div>

    <GZModalView />
  </v-app>
</template>

<style>
.app-root .v-application__wrap {
  min-height: 100%;
  height: 100%;
}
.app-viewport {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
</style>
