import {
  check,
  type DownloadEvent,
  type Update,
} from '@tauri-apps/plugin-updater';

export type AppUpdate = Update;
export type UpdateDownloadEvent = DownloadEvent;
export const updates = {
  check: () => check({ timeout: 15_000 }),
  install: (update: Update, onEvent: (event: DownloadEvent) => void) =>
    update.downloadAndInstall(onEvent, {
      timeout: 120_000,
      restartAfterInstall: true,
    }),
};
