<script setup lang="ts">
import { GZRouterView, GZModalView } from 'gz-vue-router';
import { useDisplay } from 'vuetify';
const isRightDrawerOpen = ref(true)
// 解构出当前分辨率的判断状态（已在 tailwind.config.js 中对齐）
const { mdAndUp, lgAndUp } = useDisplay()
</script>

<template>
	<v-app class="app-root app-viewport">
		<v-navigation-drawer app :rail="!lgAndUp" :permanent="mdAndUp">
      {{ mdAndUp }}
      {{ lgAndUp }}
			<!-- 菜单内容 -->
		</v-navigation-drawer>
		<v-main app>
      <GZRouterView />
		</v-main>
		<v-navigation-drawer
    app
		v-model="isRightDrawerOpen"
		location="right"
		:width="lgAndUp ? 400 : 320"
		:temporary="!lgAndUp"
	>
		<div class="pa-4 flex flex-col h-full justify-between">
			<!-- Top Action Items -->
			<div class="space-y-4">
				<h3 class="text-gray-900 font-medium">Element Properties</h3>
				<v-text-field label="Component ID" density="compact" hide-details class="mb-2"></v-text-field>
				<v-select :items="['Active', 'Disabled', 'Draft']" label="Status" density="compact" hide-details></v-select>
			</div>

			<!-- Sticky Footer Actions (PC Layout Standard) -->
			<div class="border-t border-gray-100 pt-4 bg-white flex justify-end space-x-2">
				<v-btn variant="outlined" color="secondary" size="small" @click="isRightDrawerOpen = false">Cancel</v-btn>
				<v-btn color="primary" size="small" elevation="0">Save Changes</v-btn>
			</div>
		</div>
	</v-navigation-drawer>
		<Teleport to="body">
			<GZModalView />
		</Teleport>
	</v-app>
</template>

<style>
.app-root .v-application__wrap {
	/* min-height: 100%;
	height: 100%; */
}

.app-root .page-shell__content>.v-container {}

.app-viewport {
	flex: 1 1 auto;
	min-height: 0;
	height: 100%;
}
</style>
