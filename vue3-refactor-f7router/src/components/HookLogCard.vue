<script setup lang="ts">
import type { HookLogEntry } from '../composables/useHookLog';

defineProps<{
  title: string;
  entries: HookLogEntry[];
}>();
</script>

<template>
  <v-card class="hook-log-card" variant="tonal">
    <v-card-item>
      <v-card-title class="text-body-2">{{ title }}</v-card-title>
    </v-card-item>
    <v-card-text>
      <div v-if="entries.length === 0" class="hook-log-card__empty">还没有触发过任何钩子</div>
      <ul v-else class="hook-log-card__list">
        <li v-for="(entry, i) in entries" :key="i">
          <code>{{ entry.time }}</code>
          <strong>{{ entry.label }}</strong>
          <span>{{ entry.detail }}</span>
        </li>
      </ul>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.hook-log-card {
  margin-top: 12px;
}
.hook-log-card__empty {
  opacity: 0.6;
  font-size: 0.875rem;
}
.hook-log-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.8125rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hook-log-card__list li {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.hook-log-card__list code {
  opacity: 0.6;
}
</style>
