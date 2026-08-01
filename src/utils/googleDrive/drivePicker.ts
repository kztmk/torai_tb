/**
 * Google Picker（Drive から既存画像を選択）のラッパー（Phase 9・虎威流用）。
 * index.html で picker API をロード済み（window.google.picker）。
 * 必要: OAuth トークン（Drive スコープ） / VITE_G_OAUTH_CLIENT_ID（appId） / VITE_GOOGLE_API_KEY（developerKey）。
 */
export interface PickedDriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export const isPickerReady = (): boolean =>
  Boolean((window as any).google?.picker) || Boolean((window as any).googlePickerLoaded);

export interface OpenDrivePickerOptions {
  token: string;
  appId: string;
  developerKey: string;
  onPicked: (files: PickedDriveFile[]) => void;
}

export function openDrivePicker({ token, appId, developerKey, onPicked }: OpenDrivePickerOptions): void {
  const g = (window as any).google;
  if (!g?.picker) {
    throw new Error('Google Picker API is not loaded yet.');
  }

  const view = new g.picker.View(g.picker.ViewId.DOCS);
  view.setMimeTypes('image/png,image/jpeg,image/jpg,image/gif,image/webp');

  const picker = new g.picker.PickerBuilder()
    .enableFeature(g.picker.Feature.NAV_HIDDEN)
    .setAppId(appId)
    .setOAuthToken(token)
    .addView(view)
    .setDeveloperKey(developerKey)
    .setCallback((data: any) => {
      if (data.action === g.picker.Action.PICKED) {
        const docs: any[] = Array.isArray(data.docs) ? data.docs : [];
        onPicked(
          docs
            .filter((d) => d?.id)
            .map((d) => ({ id: d.id, name: d.name || d.id, mimeType: d.mimeType || '' }))
        );
      }
    })
    .build();
  picker.setVisible(true);
}
