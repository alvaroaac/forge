import { app, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron';
import { join } from 'node:path';
import { registerAll } from './ipc/register';
import { resolveAppRoot } from './lib/app-root';

app.setName('Forge');

function installApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Forge',
      submenu: [
        { role: 'about', label: 'About Forge' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide Forge' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit Forge' },
      ],
    },
    {
      role: 'fileMenu',
    },
    {
      role: 'editMenu',
    },
    {
      role: 'viewMenu',
    },
    {
      role: 'windowMenu',
    },
    {
      role: 'help',
      submenu: [],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    title: 'Forge',
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
  installApplicationMenu();
  await registerAll(ipcMain, resolveAppRoot(app.getAppPath()));
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
}

app
  .whenReady()
  .then(start)
  .catch((error: unknown) => {
    console.error('Forge startup failed:', error);
    app.exit(1);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
