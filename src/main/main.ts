import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import { BinanceService } from './services/binance';

let tray: Tray | null = null;
let window: BrowserWindow | null = null;
const binanceService = new BinanceService();

function createWindow() {
  // 判断是否为开发模式
  // 使用 app.isPackaged 是最可靠的判断方法
  const isDev = !app.isPackaged;

  window = new BrowserWindow({
    width: 400,
    height: 600,
    show: isDev, // 开发模式下默认显示窗口
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  console.log('isDev:', isDev);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('app.isPackaged:', app.isPackaged);

  if (isDev) {
    window.loadURL('http://localhost:3000');
    // 开发模式下打开 DevTools
    window.webContents.openDevTools({ mode: 'detach' });

    // 开发模式下，窗口加载完成后显示
    window.webContents.on('did-finish-load', () => {
      window?.show();
    });
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 开发模式下不自动隐藏窗口，方便调试
  if (!isDev) {
    window.on('blur', () => {
      if (window && !window.webContents.isDevToolsOpened()) {
        window.hide();
      }
    });
  }
}

function createTray() {
  // 创建一个简单的图标（可以后续替换为实际图标）
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFJSURBVDiNpdM9S8NAGAfwX5pqW7Sg4KR0cHBycnRxcBIXQRBBBEEQBD+Ai+Dg4OYgODk5OOgi+AHcRBcHQRDBVxQUi1J8qbZp0+RyuVwuuYuTD5S73P+55+45gP8sNptNwrZtTw4A0+k0Go0GKpUKarUaqtUqNE1Dp9OB4ziYz+dIp9NYLFZ4X/3w+/1otVqoVCooFAqQZRn5fB7JZBKxWAzhcBiKoqDZbELTNBiGAdu28S1YFMVP4XQ6jVAohGg0ilgshkQigXQ6jWQyCUmSEAwGoaoqFovFB3hnwGw2w3a7xWazwXq9xmq1wmq1wnK5hGEYWC6X7/d+g90J/H4/AoEAJElCMBiEKIoQBAGCIEAURQiCAFEU3/d+g90JdF2HrutYLpfQdR2maf4IbNuGZVkwDAO6rn+A3Qk0TYNlWTBNE5Zl/Qg+/h9/AtBHj+r3pKPrAAAAAElFTkSuQmCC'
  );

  tray = new Tray(icon);
  tray.setToolTip('Binance Positions');

  tray.on('click', () => {
    if (window) {
      if (window.isVisible()) {
        window.hide();
      } else {
        const bounds = tray!.getBounds();
        const x = Math.round(bounds.x + bounds.width / 2 - 200);
        const y = Math.round(bounds.y + bounds.height);
        window.setPosition(x, y);
        window.show();
      }
    }
  });

  const contextMenu = Menu.buildFromTemplate([
    { label: '刷新', click: () => window?.webContents.send('refresh-data') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createTray();
  createWindow();
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});

// IPC handlers
ipcMain.handle('save-api-keys', async (_, apiKey: string, apiSecret: string) => {
  binanceService.setCredentials(apiKey, apiSecret);
  return { success: true };
});

ipcMain.handle('get-spot-positions', async () => {
  try {
    return await binanceService.getSpotBalances();
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('get-futures-positions', async () => {
  try {
    return await binanceService.getFuturesPositions();
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('has-credentials', async () => {
  return binanceService.hasCredentials();
});
