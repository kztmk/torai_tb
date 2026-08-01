/// <reference types="vite/client" />

// vite.config.ts の define で注入されるビルド時定数。
// __APP_VERSION__: package.json の version（`npm version minor/major` で更新）
// __APP_CHANNEL__: ビルド時の --mode（'preview' | 'production' | 'development'）
declare const __APP_VERSION__: string;
declare const __APP_CHANNEL__: string;
