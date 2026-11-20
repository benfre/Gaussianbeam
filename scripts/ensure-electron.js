// --- START OF FILE scripts/ensure-electron.js ---
// Some Electron versions do not register a postinstall that downloads the binary
// (e.g. newer Electron 4x), which means `node_modules/electron/dist` is missing
// after `npm install`. This script downloads the binary explicitly (using the
// configured mirror) so both `npm start` and `electron-builder` (via electronDist)
// work out of the box.

'use strict';

process.env.ELECTRON_MIRROR =
    process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const exe = path.join(electronDir, 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');

if (fs.existsSync(exe)) {
    console.log('[ensure-electron] Electron binary already present.');
    process.exit(0);
}

const installScript = path.join(electronDir, 'install.js');
if (!fs.existsSync(installScript)) {
    console.error('[ensure-electron] Electron install.js not found at ' + installScript);
    process.exit(1);
}

console.log('[ensure-electron] Downloading Electron binary (mirror=' + process.env.ELECTRON_MIRROR + ')...');
const result = spawnSync(process.execPath, [installScript], {
    stdio: 'inherit',
    env: process.env,
    cwd: electronDir
});

process.exit(result.status === null ? 1 : result.status);

// --- END OF FILE scripts/ensure-electron.js ---