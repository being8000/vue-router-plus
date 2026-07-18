import type { ThemeDefinition } from 'vuetify';

// 目前直接沿用 Vuetify 的默认 Material 配色，作为可编辑的起点——
// 后续接入真实品牌色时，只需要改这里的 colors/variables，uno.config.ts 和
// <GZRouterView>/<GZModalView> 等消费 --v-* CSS 变量的地方不需要跟着改。
const light: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-light': '#EEEEEE',
    'surface-variant': '#424242',
    'on-surface-variant': '#EEEEEE',
    primary: '#1867C0',
    'primary-darken-1': '#1F5592',
    secondary: '#48A9A6',
    'secondary-darken-1': '#018786',
    error: '#B00020',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FB8C00',
  },
  variables: {
    'border-color': '#000000',
    'border-opacity': 0.12,
    'high-emphasis-opacity': 0.87,
    'medium-emphasis-opacity': 0.6,
    'disabled-opacity': 0.38,
    'idle-opacity': 0.04,
    'hover-opacity': 0.04,
    'focus-opacity': 0.12,
    'selected-opacity': 0.08,
    'activated-opacity': 0.12,
    'pressed-opacity': 0.12,
    'dragged-opacity': 0.08,
    'theme-kbd': '#EEEEEE',
    'theme-on-kbd': '#000000',
    'theme-code': '#F5F5F5',
    'theme-on-code': '#000000',
    // 内容区最大宽度：Vuetify 会把 variables 里的每一项自动暴露成 --v-{key} CSS 变量，
    // uno.config.ts 的 tw-max-w-view shortcut 直接消费 --v-view-max-width。
    'view-max-width': '600px',
  },
};

const dark: ThemeDefinition = {
  dark: true,
  colors: {
    // background: '#121212',
    // surface: '#212121',
    // 'surface-bright': '#ccbfd6',
    // 'surface-light': '#424242',
    // 'surface-variant': '#c8c8c8',
    // 'on-surface-variant': '#000000',
    // primary: '#2196F3',
    // 'primary-darken-1': '#277CC1',
    // secondary: '#54B6B2',
    // 'secondary-darken-1': '#48A9A6',
    // error: '#CF6679',
    // info: '#2196F3',
    // success: '#4CAF50',
    // warning: '#FB8C00',
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

export const themes = { light, dark };
