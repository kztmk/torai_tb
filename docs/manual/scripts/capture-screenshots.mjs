/**
 * ログイン済みの Chrome（リモートデバッグ有効）に接続して、アプリの各画面を
 * static/img/screenshots/*.png として撮影するスクリプト。
 *
 * 使い方（詳細は docs/manual/scripts/README.md）:
 *   1. Chrome をリモートデバッグ付きで起動し、アプリにログインしておく。
 *      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *        --remote-debugging-port=9222 --user-data-dir="/tmp/autopost-capture"
 *   2. アプリを開きログイン + GAS 連携済みの状態にする（アカウント/投稿も数件あると良い）。
 *   3. このスクリプトを実行:
 *      node scripts/capture-screenshots.mjs --base http://localhost:5173
 *
 * オプション:
 *   --base <url>   アプリのベース URL（既定: http://localhost:5173）
 *   --port <n>     Chrome リモートデバッグポート（既定: 9222）
 *   --only <a,b>   指定した name だけ撮影（カンマ区切り）
 *
 * モーダル/外部画面（composer, *-register, distribute, discord-setup, gas-menu など）は
 * 自動化が難しいため、手動撮影の対象です（README の一覧を参照）。
 */
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'static', 'img', 'screenshots');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg('--base', 'http://localhost:5173').replace(/\/$/, '');
const PORT = arg('--port', '9222');
const ONLY = (arg('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
// --paths "name=/path,name2=/path2" で任意の name/path を追加（投稿一覧など）。
const EXTRA_PATHS = (arg('--paths', '') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((pair) => {
    const [name, ...rest] = pair.split('=');
    return { name: name.trim(), path: rest.join('=').trim(), fullPage: true };
  });

// name  = 出力ファイル名（.png を除く）
// path  = ベース URL からの相対パス
// clicks = 撮影前に「表示テキストで要素をクリック」する順序（タブ切替など）
// fullPage = ページ全体を撮る（既定はビューポート）
const TARGETS = [
  { name: 'signin', path: '/auth/signin' },
  { name: 'activity', path: '/dashboard' },
  { name: 'sns-tree', path: '/dashboard' }, // 左メニューのツリーが写るよう /dashboard を使用
  // /profile は既定でサブスクリプションタブ。API 設定は「APIキー」タブ。
  // 機密（APIキー・GAS URL・Webhook）が写るため redactInputs で入力欄をぼかす。
  { name: 'api-settings', path: '/profile', clicks: ['APIキー'], fullPage: true, redactInputs: true },
  { name: 'gas-setup', path: '/profile', clicks: ['APIキー'], fullPage: false, redactInputs: true },
  {
    name: 'discord-setup',
    path: '/profile',
    clicks: ['APIキー', 'Discordにポスト結果を送信'],
    fullPage: true,
    redactInputs: true,
  },
  // 投稿一覧は URL に :platform/:accountId を含むため、--paths で個別に指定して撮る。
  // 例: node scripts/capture-screenshots.mjs --base <URL> \
  //       --paths "post-list=/dashboard/posts/threads/<accountId>"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 表示テキストに一致する clickable 要素をクリック（タブ/ボタン切替用）。
async function clickByText(page, text) {
  const clicked = await page.evaluate((t) => {
    const els = Array.from(
      document.querySelectorAll(
        'button, [role="tab"], a, [role="button"], .mantine-Tabs-tab, label, .mantine-Switch-root'
      )
    );
    const el = els.find((e) => (e.textContent || '').trim().includes(t));
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, text);
  return clicked;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Chrome の /json エンドポイントは Host が IP だと 404 になるため localhost を使う。
  const browserURL = `http://localhost:${PORT}`;
  console.log(`Connecting to Chrome at ${browserURL} ...`);
  const browser = await puppeteer.connect({ browserURL, defaultViewport: null });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const all = [...TARGETS, ...EXTRA_PATHS];
  const targets = ONLY.length ? all.filter((t) => ONLY.includes(t.name)) : all;
  if (targets.length === 0) {
    console.log('No targets to capture (check --only / --paths names).');
  }

  for (const t of targets) {
    const url = `${BASE}${t.path}`;
    try {
      console.log(`→ ${t.name}: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(2500); // データ同期・描画待ち（同期トースト消化も兼ねる）
      for (const text of t.clicks || []) {
        const ok = await clickByText(page, text);
        console.log(`   click "${text}": ${ok ? 'ok' : 'not found'}`);
        await sleep(1200);
      }
      // 撮影前に通知トースト（データ同期中など）を隠してクリーンな画面にする。
      await page.evaluate(() => {
        document
          .querySelectorAll('.mantine-Notifications-root, [class*="Notifications-root"]')
          .forEach((el) => {
            el.style.display = 'none';
          });
      });
      if (t.redactInputs) {
        // 機密の値が写らないよう、入力欄・テキストエリアの中身をぼかす。
        await page.evaluate(() => {
          document
            .querySelectorAll('input, textarea')
            .forEach((el) => {
              el.style.filter = 'blur(6px)';
            });
        });
        await sleep(300);
      }
      const out = join(OUT_DIR, `${t.name}.png`);
      await page.screenshot({ path: out, fullPage: Boolean(t.fullPage) });
      console.log(`   saved ${out}`);
    } catch (e) {
      console.warn(`   FAILED ${t.name}: ${e.message}`);
    }
  }

  await page.close();
  browser.disconnect();
  console.log('Done. Review PNGs in static/img/screenshots/.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
