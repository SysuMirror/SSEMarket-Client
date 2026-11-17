import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import vueJsxPlugin from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import dnsPrefetchPlugin from './plugins/vite-plugin-dns-prefetch'
// https://vitejs.dev/config/
// VITE_BASE：测试环境按路径分流时用（例如 /zhangsan/）；不设就沿用主站的 /new/
const base = process.env.VITE_BASE || (process.env.CF_PAGES ? '/' : '/new/')
export default defineConfig({
  base,
  // dev-only：本地开发经代理直连生产后端（构建产物不受影响）。
  // agent=宿主网络 8100 稳定；Go 的 docker-proxy 回环发布已废（000），
  // 必须打桥接 IP，启动时以 VITE_GO_API_TARGET 注入（容器重建后 IP 会变，需重解析）
  server: {
    proxy: {
      '/api/v1/agent': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.VITE_GO_API_TARGET || 'http://172.18.0.7:8080',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    vue(),
    vueJsxPlugin(),
    UnoCSS(),
    // analyzer({
    //   analyzerMode: 'server', // 默认值，启动本地服务器
    //   openAnalyzer: true, // 自动打开浏览器
    //   analyzerPort: 8888, // 分析服务器端口
    // }),
    dnsPrefetchPlugin({
      maxLinks: 5,
      exclude: ['localhost', '127.0.0.1', 'vuejs.org'],
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }
          id = id.split('node_modules/')[1]

          if (id.includes('vue')) {
            return 'vue'
          }

          if (id.includes('markdown-it') || id.includes('dompurify') || id.includes('katex') || id.includes('@vscode/markdown-it-katex')) {
            return 'markdown'
          }

          // 不知道以后会不会换高亮包, 单独提出来吧
          if (id.includes('prismjs')) {
            return 'prismjs'
          }

          if (id.includes('crypto-js')) {
            return 'cryptoJs'
          }

          if (id.includes('pdfjs-dist')) {
            return 'pdfjs'
          }

          // emoji-mart（表情面板组件 + 全量表情数据，~500KB）：只在用户首次点开
          // 表情按钮时动态 import。必须返回 undefined 让 rollup 按动态 import 分包，
          // 若并入 vendor（静态 chunk，被入口引用）会把表情资源拖进首屏。
          if (id.includes('emoji-mart') || id.includes('@emoji-mart/data')) {
            return
          }

          return 'vendor'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
