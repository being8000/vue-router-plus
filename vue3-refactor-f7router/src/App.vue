<script setup lang="ts"></script>

<template>
  <Teleport to="body">
    <GZModalView />
  </Teleport>
</template>

<style>
.app-root .v-application__wrap {
  /* min-height: 100%;
	height: 100%; */
}

.app-root .page-shell__content > .v-container {
}

.app-viewport {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
</style>
