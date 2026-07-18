import { defineConfig, loadEnv, type ConfigEnv } from 'vite'
import checker from 'vite-plugin-checker'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import path from 'path'
import IconsResolver from 'unplugin-icons/resolver'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import { fileURLToPath } from 'url'
import vuetify from 'vite-plugin-vuetify'
import svgLoader from 'vite-svg-loader'
import { visualizer } from 'rollup-plugin-visualizer'
import { VuetifyResolver } from 'unplugin-vue-components/resolvers'
import UnoCSS from 'unocss/vite'
import fs from 'fs'
import vueDevTools from 'vite-plugin-vue-devtools'
import { createHtmlPlugin } from 'vite-plugin-html'

const packages = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
// UAT域名
// const proxyUrl = 'https://gzone.ph'
// const proxyUrl = 'https://gameplus-gamezone.uatext66gp.com'
// const proxyUrl = 'https://gameplus-gamezone03.uatext66gp.com'   //uat03
// https://vitejs.dev/config/
export default defineConfig(({ mode }: ConfigEnv) => {
  const { VITE_API_URL } = loadEnv(mode, process.cwd(), '')
  console.log('API URL:', VITE_API_URL)
  return {
    plugins: [
      vueDevTools(),
      createHtmlPlugin({}),
      vue(),
      UnoCSS(),
      checker({
        vueTsc: { tsconfigPath: 'tsconfig.app.json' },
        overlay: { initialIsOpen: false }, // dev 模式：浮层默认折叠，不遮挡页面
      }),

      // 只在 build-preview 模式下启用 visualizer
      ...(process.env.npm_lifecycle_event === 'build:preview'
        ? [
            visualizer({
              filename: 'dist/stats.html', // 输出文件的路径
              open: true, // 打包完成后自动打开浏览器
              gzipSize: true, // 显示 gzip 压缩后的大小
              brotliSize: true, // 显示 brotli 压缩后的大小
            }),
          ]
        : []),
      vuetify({
        autoImport: true,
      }),
      svgLoader({
        svgoConfig: {
          multipass: true,
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  // viewBox is required to resize SVGs with CSS.
                  // @see https://github.com/svg/svgo/issues/1128
                  removeViewBox: false,
                  cleanupIds: false,
                },
              },
            },
          ],
        },
      }),
      AutoImport({
        resolvers: [
          // IconsResolver({
          //   prefix: 'Icon',
          // }),
        ],
        imports: [
          'vue',
          'vue-router',
          '@vueuse/core',
        ],
        //配置后会自动扫描目录下的文件
        // dirs: ['src/composables/**', 'src/util/**', 'src/api/**'],
        eslintrc: {
          enabled: true, // Default `false`
          filepath: './eslintrc/.eslintrc-auto-import.json', // Default `./.eslintrc-auto-import.json`
          globalsPropValue: true, // Default `true`, (true | false | 'readonly' | 'readable' | 'writable' | 'writeable')
        },
        dts: './types/auto-imports.d.ts',
      }),
      // createSvgIconsPlugin({
      //   iconDirs: [path.resolve(process.cwd(), 'src/icons')],
      //   symbolId: 'icon-[dir]-[name]',
      // }),
      Components({
        dirs: [],
        extensions: ['vue'],
        deep: true,
        dts: './types/components.d.ts',
        types: [],
        resolvers: [
          VuetifyResolver(),
        ],
        // 修复vite-plugin-components组件命名相同 内部读取文件名
        directoryAsNamespace: true,
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      manifest: true,
      chunkSizeWarningLimit: 300,
      sourcemap: false,
      cssMinify: 'esbuild',
      // 图片等静态资源单独输出为文件，不内联为 base64（默认 4kb 以下会内联）
      assetsInlineLimit: 0,
      // 使用 terser 并保留导出/导入的方法和常量原名（不混淆变量名）
      // minify: 'terser',
      // terserOptions: {
      //   compress: { passes: 1 },
      //   mangle: false,
      // },
      rollupOptions: {
        treeshake: 'recommended' as any,
        output: {
          banner: '/** GameZone */',
          footer: '/** GameZone */',
          // 不压缩 chunk 内部的 export 名称，便于调试与按名引用
          minifyInternalExports: false,
          noConflict: true,
          experimentalMinChunkSize: 10 * 1024,
          // manualChunks  return 的模块会打成独立 chunk；不 return（undefined）的模块会内联到引用它的文件中
          manualChunks(id: string) {
            // 若希望某目录始终内联到 import 方，在此处优先 return undefined，例如：
            const svg = '/assets/images/svg/'
            // if (id.includes(svg)) {
            //   // return 'gamezone_svg'
            //   return 'svg_' + id.split(svg)[1].split('.')[0].split('/').join('_')
            // } else {
            const dependencies = packages.dependencies
            const packageNames = Object.keys(dependencies)

            const isNpmModules = packageNames.find((name) => id.includes(`/node_modules/${name}/`))
            if (isNpmModules) {
              return `pkg/${isNpmModules.replace(/[.|\/]/g, '-')}`
            }
          }
        },
      },
    },
    define: { 'process.env': {}, global: 'globalThis' },
    // 性能优化配置
    optimizeDeps: {
      include: ['@esotericsoftware/spine-player/dist/Player', 'fuse.js', 'jose', 'video.js'],
      exclude: ['vuetify'],
    },
    server: {
      host: '0.0.0.0',
      // port: 8080,
      https: fs.existsSync(path.resolve(__dirname, '.cert/key.pem'))
        ? {
            key: fs.readFileSync(path.resolve(__dirname, '.cert/key.pem')),
            cert: fs.readFileSync(path.resolve(__dirname, '.cert/cert.pem')),
          }
        : undefined,
      proxy: {
        '/_glaxy_c66_': {
          target: VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/_activity_api_': {
          target: VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/_front_api_': {
          target: VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/staticJs': {
          target: VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/externals': {
          target: VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/_push_api_': {
          target: VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/web_images_ok': {
          target: VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/_upg_c66_': {
          target: VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/shield-fp': {
          target: VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
