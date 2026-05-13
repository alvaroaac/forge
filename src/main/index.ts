import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { registerAll } from './ipc/register';
import { resolveAppRoot } from './lib/app-root';

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1240,
    minHeight: 720,
    backgroundColor: '#0A0C12',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

async function start(): Promise<void> {
  await registerAll(ipcMain, resolveAppRoot(app.getAppPath()));
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
}

app.whenReady().then(start).catch((error: unknown) => {
  console.error('Forge startup failed:', error);
  app.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
