import { defineConfig, presetAttributify } from 'unocss'
import presetWind4 from '@unocss/preset-wind4'
import { themes } from './src/plugins/vuetify/theme'

export default defineConfig({
  /**
   * 内容区：宽 100% + max 不超过 `--v-view-max-width`（与 theme `view-max-width` 一致）
   *
   * 注意：`presetWind4` 的 `prefix: 'tw-'` 只作用于预设规则，不会自动套在 `shortcuts` 的 key 上。
   * 若只写 `max-w-view`，只会匹配类名 `max-w-view`；模板里用 `tw-max-w-view` 时永远匹配不到，表现为「不生效」。
   * 因此 key 必须带 `tw-` 前缀，展开式里的原子类也要带 `tw-`。
   */
  shortcuts: {
    'tw-max-w-view': `tw-w-full tw-max-w-[var(--v-view-max-width)]`,
  },
  // 对齐历史 Tailwind 配置（tw- 前缀、主题色、动画/关键帧）
  // presetWind4 的 transform 依赖 CSS 变量，保留变量默认值
  // reset: true 时必须开启 outputToCssLayers，让 UnoCSS 输出进 uno-* 层，layers.css 中 vuetify-core 在 uno-base 之后，Vuetify 样式才能覆盖 UnoCSS reset
  preflights: [
    {
      getCSS: () => `*,::before,::after{
  --un-rotate: 0;
  --un-rotate-x: 0;
  --un-rotate-y: 0;
  --un-rotate-z: 0;
  --un-skew-x: 0;
  --un-skew-y: 0;
  --un-translate-x: 0;
  --un-translate-y: 0;
  --un-translate-z: 0;
  --un-scale-x: 1;
  --un-scale-y: 1;
  --un-scale-z: 1;
  --un-border-style: solid;
}`,
    },
  ],
  theme: {
    fontFamily: {},
    colors: themes.dark.colors,
    screens: {
      'sm': '600px',   // 对应 Vuetify 的 sm
      'md': '960px',   // 对应 Vuetify 的 md
      'lg': '1280px',  // 对应 Vuetify 的 lg
      'xl': '1920px',  // 对应 Vuetify 的 xl
      'xxl': '2560px', // 对应 Vuetify 的 xxl (替代默认的 2xl)
    },
  },
  presets: [
    presetAttributify(),
    presetWind4({
      preflights: {
        reset: true,
        property: { parent: false },
      },
      // 与 Vuetify 主题一致，dark: 使用 .v-theme--dark
      dark: {
        dark: '.v-theme--dark',
        light: '.v-theme--light',
      },
    }),
  ],
})
