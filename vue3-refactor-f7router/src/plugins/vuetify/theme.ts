import type { ThemeDefinition } from 'vuetify';

// 目前直接沿用 Vuetify 的默认 Material 配色，作为可编辑的起点——
// 后续接入真实品牌色时，只需要改这里的 colors/variables，uno.config.ts 和
// <GZRouterView>/<GZModalView> 等消费 --v-* CSS 变量的地方不需要跟着改。


const dark: ThemeDefinition = {
	dark: true,
	colors: {
	// Vuetify 语义（组件默认使用）
	background: '#181B21',
	surface: '#21262E',
	primary: '#DE4444',
	secondary: '#3C424E',
	error: '#E04F5F',
	info: '#3A7BFF',
	success: '#34BE86',
	warning: '#E89B2F',
	icon: '#A8B3C2',

	// Backdrop System
	root: '#181B21',
	section: '#21262E',
	input: '#242933',
	card: '#2A2F3B',
	modal: '#2F3542',
	tooltip: '#383F4D',

	// Interaction & Overlay（rgba 含 alpha，移至 variables 避免 V3 剥离 alpha）

	// Typography System
	'text-primary': '#FFFFFF',
	'text-secondary': '#DCE3EC',
	'text-list-option': '#C9CDD3',
	'text-tertiary': '#8F98A6',
	'text-placeholder': '#8F98A6',
	'text-disabled': '#656D7A',
	'text-subtle': '#B7BEC7',

	// Brand & Asset Gold
	'brand-primary': '#DE4444',
	'brand-accent': '#F25555',
	promo: '#34BE86',
	gold: '#EAC070',
	'gold-soft': '#C29E63',
	'gold-text': '#F25555',
	'gold-fill': '#404345',
	'surface-muted': '#3C424E',
	/** 选中卡片背景（存款快捷金额、Providers 等） */
	'amount-selected': '#444b58',
	/** VIP 客服头像绿点外圈，与 customer-bg 卡片底色一致 */
	'vip-host-dot-ring': '#3b3d5e',

	/** Live Casino 二级分类选中态：背景 + 边框 */
	'casino-cat-selected': '#33242A',
	'casino-cat-selected-border': '#D64242',

	// Status & Badge（与 Vuetify error/success/warning/info 对齐，此处为设计 token）
	'badge-muted': '#535965',

	// 兼容旧 key（可逐步迁移后移除）
	'primary-darken-1': '#F25555',
	'secondary-darken-1': '#018786',
	'bg-overlay': '#2F3542',
	'bg-sub': '#3A4250',
	'bg-divider': '#2A303A',
		},
		variables: {
			// 'border-color': '#FFFFFF',
			// 'border-opacity': 0.12,
			// 'high-emphasis-opacity': 1,
			// 'medium-emphasis-opacity': 0.7,
			// 'disabled-opacity': 0.5,
			// 'idle-opacity': 0.1,
			// 'hover-opacity': 0.04,
			// 'focus-opacity': 0.12,
			// 'selected-opacity': 0.08,
			// 'activated-opacity': 0.12,
			// 'pressed-opacity': 0.16,
			// 'dragged-opacity': 0.08,
			// 'theme-kbd': '#424242',
			// 'theme-on-kbd': '#FFFFFF',
			// 'theme-code': '#343434',
			// 'theme-on-code': '#CCCCCC',
			// 'view-max-width': '600px',
		},
};

export const themes = {  dark };
