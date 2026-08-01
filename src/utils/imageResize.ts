/**
 * クライアント側画像リサイズ（Phase 9）。
 * Bluesky は 1MB 上限のため、アップロード前に長辺・JPEG 品質を落として上限内に収める。
 * Threads も同じ画像を使う（1MB 以内なら両対応）。GIF はアニメ保持のためリサイズしない。
 */

const DEFAULT_MAX_DIMENSION = 2000;
const DEFAULT_TARGET_MAX_BYTES = 950_000; // 1MB 未満に安全マージン

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      quality
    );
  });

const drawScaled = (img: HTMLImageElement, width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D コンテキストを取得できませんでした。');
  // JPEG は透過非対応のため白背景で塗る
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
};

/**
 * 画像を targetMaxBytes 以内に収めた JPEG File を返す。
 * GIF・非画像はそのまま返す。
 */
export async function resizeImageToLimit(
  file: File,
  targetMaxBytes: number = DEFAULT_TARGET_MAX_BYTES,
  maxDimension: number = DEFAULT_MAX_DIMENSION
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  const img = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  let width = Math.max(1, Math.round(img.width * scale));
  let height = Math.max(1, Math.round(img.height * scale));

  let canvas = drawScaled(img, width, height);
  let quality = 0.92;
  let blob = await canvasToBlob(canvas, quality);

  // まず品質を段階的に下げる
  while (blob.size > targetMaxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  // それでも超える場合は解像度を段階的に縮小
  while (blob.size > targetMaxBytes && Math.max(width, height) > 400) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    canvas = drawScaled(img, width, height);
    blob = await canvasToBlob(canvas, 0.8);
  }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
