// --- START OF FILE main.js ---
// Electron main process for the Gaussian Beam Simulator standalone app.

'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow = null;

const APP_ID = 'com.visuphy.gaussianbeam';

// Smoke-test mode: use a throwaway profile so tests never touch the real config.
if (process.env.GB_SMOKE_TEST === '1') {
    app.setPath('userData', path.join(os.tmpdir(), 'gaussianbeam-smoke-' + Date.now()));
}

// ---------------------------------------------------------------------------
// Config storage (auto-persistence in the OS user-data directory)
// ---------------------------------------------------------------------------
function configFilePath() {
    return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
    try {
        const p = configFilePath();
        if (!fs.existsSync(p)) return null;
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.error('[config] Failed to read config:', error);
        return null;
    }
}

function writeConfig(data) {
    const p = configFilePath();
    const tmp = p + '.tmp';
    try {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tmp, p);
        return true;
    } catch (error) {
        console.error('[config] Failed to write config:', error);
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) { /* ignore */ }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        title: 'Gaussian Beam Simulator',
        backgroundColor: '#f4f4f4',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    // Open any external link (e.g. GitHub links in the header) in the default browser.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) {
            shell.openExternal(url).catch(() => { /* ignore */ });
        }
        return { action: 'deny' };
    });

    // Prevent in-app navigation to external pages.
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const current = mainWindow.webContents.getURL();
        if (url !== current && !url.startsWith('file://')) {
            event.preventDefault();
            if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => { /* ignore */ });
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'gaussianbeam.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
function registerIpcHandlers() {
    ipcMain.handle('config:load', () => readConfig());
    ipcMain.handle('config:save', (_event, data) => writeConfig(data));

    ipcMain.handle('config:export', async (_event, data) => {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Configuration',
            defaultPath: 'gaussian-beam-config.json',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (result.canceled || !result.filePath) {
            return { canceled: true };
        }
        try {
            fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
            return { canceled: false, filePath: result.filePath };
        } catch (error) {
            return { canceled: false, error: error.message };
        }
    });

    ipcMain.handle('config:import', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Configuration',
            properties: ['openFile'],
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return { canceled: true };
        }
        try {
            const raw = fs.readFileSync(result.filePaths[0], 'utf8');
            const data = JSON.parse(raw);
            return { canceled: false, filePath: result.filePaths[0], data };
        } catch (error) {
            return { canceled: false, error: error.message };
        }
    });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    if (process.env.GB_SMOKE_TEST === '1') {
        runSmokeTest();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ---------------------------------------------------------------------------
// Smoke test (run with GB_SMOKE_TEST=1). Verifies the renderer bootstraps,
// third-party assets load, the state API works, and config save/load round-trip.
// ---------------------------------------------------------------------------
async function runSmokeTest() {
    try {
        const win = mainWindow;
        if (!win) throw new Error('No main window created');

        await new Promise((resolve, reject) => {
            if (win.webContents.isLoading()) {
                win.webContents.once('did-finish-load', resolve);
                win.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error('did-fail-load: ' + desc)));
            } else {
                resolve();
            }
        });

        const ready = await win.webContents.executeJavaScript(
            `new Promise((resolve) => {
                if (window.GBSimulator && window.GBSimulatorReady) return resolve(true);
                window.addEventListener('gbsimulator:ready', () => resolve(true), { once: true });
                setTimeout(() => resolve(false), 5000);
            })`
        );
        const plotlyType = await win.webContents.executeJavaScript('typeof Plotly');
        const state = await win.webContents.executeJavaScript(
            'window.GBSimulator ? window.GBSimulator.getState() : null'
        );

        const saveRes = await win.webContents.executeJavaScript(
            `(async () => await window.electronAPI.saveConfig(window.GBSimulator.getState()))()`
        );
        const loadRes = await win.webContents.executeJavaScript(
            `(async () => await window.electronAPI.loadConfig())()`
        );

        console.log('[smoke] ready=' + !!ready);
        console.log('[smoke] typeof Plotly=' + plotlyType);
        console.log('[smoke] hasState=' + !!state);
        console.log('[smoke] beamParams=' + JSON.stringify(state && state.beamParams));
        console.log('[smoke] elements=' + (state ? state.opticalElements.length : -1));
        console.log('[smoke] saveRes=' + saveRes + ' loadHasData=' + !!(loadRes && loadRes.beamParams));

        const ok = !!ready && plotlyType === 'object' && !!state &&
            saveRes === true && !!(loadRes && loadRes.beamParams);
        app.exit(ok ? 0 : 1);
    } catch (error) {
        console.error('[smoke] FAILED:', error);
        app.exit(1);
    }
}

// --- END OF FILE main.js ---