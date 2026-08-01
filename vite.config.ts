import path from 'path';
import react from '@vitejs/plugin-react-swc'; // swc版を利用しているようなので、そちらに合わせます

import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

import pkg from './package.json';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // package.json の version（`npm version minor/major` で更新）をアプリへ注入する。
  // チャンネル（preview / production）はビルド時の --mode から取得し、
  // フッターで「ver X.Y.Z (preview)」のように区別表示する。
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_CHANNEL__: JSON.stringify(mode),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  plugins: [react(), tsconfigPaths(), visualizer({ open: false })], // ビルド後にブラウザを自動で開かない（stats.html は生成される）
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        // console.log/info/debug のみ削除し、console.error/warn は残す
        // （本番でも React のレンダリング例外などを追えるようにする）
        drop_console: false,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        drop_debugger: true,
      },
    },
  },
}));
