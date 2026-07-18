import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import { themes } from './theme';

// 组件按需引入靠 vite-plugin-vuetify 的 autoImport（见 vite.config.ts），这里不手动
// import * as components/directives，否则会失去 tree-shaking。
// 图标用默认的 'mdi' 字体图标集——页面里现有的 icon="mdi-xxx" 都是这种经典写法，
// 换成 unocss 的 i-mdi:xxx 命名需要同步改所有页面，暂不做这个迁移。
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes,
  },
});
