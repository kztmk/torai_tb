import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Autopost マニュアル',
  tagline: 'Threads / Bluesky 予約投稿・自動投稿ツール',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // 本番配信 URL / baseUrl は配信先に合わせて調整してください。
  url: 'https://example.com',
  baseUrl: '/',

  organizationName: 'kztmk',
  projectName: 'autopost-frontend',

  // 未整備リンクはビルドを止めず警告に留める（執筆途中でもビルド可能に）。
  onBrokenLinks: 'warn',

  // スクリーンショット未配置・リンク未整備でもビルドを止めない。
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
      onBrokenMarkdownImages: 'warn',
    },
  },

  // 日本語をデフォルト、英語を追加。右上の言語ドロップダウンで切替。
  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
    localeConfigs: {
      ja: { label: '日本語' },
      en: { label: 'English' },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // マニュアルをサイトのトップに配置（/docs 配下にしない）。
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Autopost マニュアル',
      logo: {
        alt: 'Autopost',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'manualSidebar',
          position: 'left',
          label: '目次',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'マニュアル',
          items: [
            { label: 'はじめに', to: '/' },
            { label: '初期セットアップ', to: '/getting-started' },
            { label: 'よくある質問', to: '/faq' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Autopost.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
