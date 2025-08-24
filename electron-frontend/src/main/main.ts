import { app, BrowserWindow, Menu, shell, ipcMain, dialog, session } from 'electron';
import * as path from 'path';

const isDev = process.env.NODE_ENV === 'development';

// Install React DevTools in development
let installExtension: ((extensions: string | string[]) => Promise<void>) | undefined;
let REACT_DEVELOPER_TOOLS: string | undefined;

if (isDev) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const devtools = require('electron-devtools-installer');
    installExtension = devtools.default;
    REACT_DEVELOPER_TOOLS = devtools.REACT_DEVELOPER_TOOLS;
  } catch (error) {
    console.warn('DevTools not available:', error);
  }
}

let mainWindow: BrowserWindow;

// Security: Set Content Security Policy
const setContentSecurityPolicy = () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* blob:; worker-src 'self' blob:; object-src 'none';"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:8080 http://localhost:8082 ws://localhost:8080; object-src 'none';",
        ],
      },
    });
  });
};

const createWindow = async (): Promise<void> => {
  // Create the browser window with enhanced security
  mainWindow = new BrowserWindow({
    height: 900,
    width: 1400,
    minHeight: 600,
    minWidth: 800,
    webPreferences: {
      nodeIntegration: true, // Temporarily enable for debugging
      contextIsolation: false, // Temporarily disable for debugging  
      sandbox: false, // Keep disabled for development
      webSecurity: false, // Disable for development localhost access
      // preload: path.join(__dirname, './preload.js'), // Temporarily remove preload
    },
    titleBarStyle: 'hiddenInset', // Native macOS title bar
    vibrancy: 'under-window', // Beautiful blur effect
    transparent: false,
    show: false, // Don't show until ready-to-show
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Load the app
  if (isDev) {
    // Try multiple ports in case of conflicts
    const tryPorts = ['3007', '3008', '3009', '3010'];
    const devPort = process.env.VITE_DEV_PORT || '3007';

    // First try the specified port, then fallback to common alternatives
    const portsToTry = [devPort, ...tryPorts.filter(p => p !== devPort)];

    let loaded = false;
    for (const port of portsToTry) {
      try {
        console.log(`[Main] Attempting to load from http://localhost:${port}`);
        await mainWindow.loadURL(`http://localhost:${port}`);
        console.log(`[Main] Successfully loaded from port ${port}`);
        loaded = true;
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`[Main] Failed to load from port ${port}:`, errorMessage);
        // Continue to next port
      }
    }

    if (!loaded) {
      console.error('[Main] Failed to load from any development port');
      // Show an error dialog
      dialog.showErrorBox(
        'Development Server Error',
        'Could not connect to the development server. Please ensure the Vite dev server is running.'
      );
    } else {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Animate window appearance
    mainWindow.setOpacity(0);
    const fadeIn = () => {
      const opacity = mainWindow.getOpacity();
      if (opacity < 1) {
        mainWindow.setOpacity(opacity + 0.05);
        setTimeout(fadeIn, 16); // ~60fps
      }
    };
    fadeIn();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    // Dereference the window object
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

// Create native macOS menu
const createMenu = (): void => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Universal AI Tools',
      submenu: [
        {
          label: 'About Universal AI Tools',
          role: 'about',
        },
        { type: 'separator' },
        {
          label: 'Services',
          accelerator: 'Cmd+Comma',
          click: () => {
            mainWindow.webContents.send('navigate-to', '/settings');
          },
        },
        { type: 'separator' },
        {
          label: 'Hide Universal AI Tools',
          accelerator: 'Cmd+H',
          role: 'hide',
        },
        {
          label: 'Hide Others',
          accelerator: 'Cmd+Alt+H',
          role: 'hideOthers',
        },
        {
          label: 'Show All',
          role: 'unhide',
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Cmd+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Chat',
          accelerator: 'Cmd+N',
          click: () => {
            mainWindow.webContents.send('new-chat');
          },
        },
        { type: 'separator' },
        {
          label: 'Import Data',
          accelerator: 'Cmd+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            });

            if (!result.canceled) {
              mainWindow.webContents.send('import-file', result.filePaths[0]);
            }
          },
        },
        {
          label: 'Export Data',
          accelerator: 'Cmd+S',
          click: () => {
            mainWindow.webContents.send('export-data');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'Cmd+1',
          click: () => {
            mainWindow.webContents.send('navigate-to', '/dashboard');
          },
        },
        {
          label: 'Chat',
          accelerator: 'Cmd+2',
          click: () => {
            mainWindow.webContents.send('navigate-to', '/chat');
          },
        },
        {
          label: 'Services',
          accelerator: 'Cmd+3',
          click: () => {
            mainWindow.webContents.send('navigate-to', '/services');
          },
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'Cmd+R',
          role: 'reload',
        },
        {
          label: 'Force Reload',
          accelerator: 'Cmd+Shift+R',
          role: 'forceReload',
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          role: 'toggleDevTools',
        },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'Cmd+0',
          role: 'resetZoom',
        },
        {
          label: 'Zoom In',
          accelerator: 'Cmd+Plus',
          role: 'zoomIn',
        },
        {
          label: 'Zoom Out',
          accelerator: 'Cmd+-',
          role: 'zoomOut',
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'Ctrl+Cmd+F',
          role: 'togglefullscreen',
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Cmd+M',
          role: 'minimize',
        },
        {
          label: 'Close',
          accelerator: 'Cmd+W',
          role: 'close',
        },
        { type: 'separator' },
        {
          label: 'Bring All to Front',
          role: 'front',
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// App event listeners
app.whenReady().then(async () => {
  // Set security policies
  setContentSecurityPolicy();

  // Install React DevTools in development
  if (isDev && installExtension && REACT_DEVELOPER_TOOLS) {
    try {
      if (isDev) console.warn('Installing React DevTools...');
      const name = await installExtension(REACT_DEVELOPER_TOOLS);
      if (isDev) console.warn(`Added Extension: ${name}`);
    } catch (error) {
      console.error('An error occurred installing React DevTools:', error);
    }
  }

  // Security: Prevent new window creation
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      // Prevent new window creation, open in default browser instead
      shell.openExternal(url);
      return { action: 'deny' };
    });
  });

  await createWindow();
  createMenu();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-message-box', async (_event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle('get-system-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
  };
});

ipcMain.handle('get-config', () => {
  // Return service configuration from environment variables or defaults
  return {
    VITE_GO_API_GATEWAY_URL: process.env.VITE_GO_API_GATEWAY_URL || 'http://localhost:8082',
    VITE_RUST_LLM_ROUTER_URL: process.env.VITE_RUST_LLM_ROUTER_URL || 'http://localhost:8001',
    VITE_VECTOR_DB_URL: process.env.VITE_VECTOR_DB_URL || 'http://localhost:6333',
    VITE_GO_WEBSOCKET_URL: process.env.VITE_GO_WEBSOCKET_URL || 'ws://localhost:8080',
    VITE_TYPESCRIPT_URL: process.env.VITE_TYPESCRIPT_URL || 'http://localhost:9999',
    VITE_LM_STUDIO_URL: process.env.VITE_LM_STUDIO_URL || 'http://localhost:1234',
    VITE_OLLAMA_URL: process.env.VITE_OLLAMA_URL || 'http://localhost:11434',
  };
});
