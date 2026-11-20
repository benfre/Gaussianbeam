// --- START OF FILE scripts/dist.js ---
// Wraps electron-builder so that download mirrors (for China) are configured
// before the build runs, regardless of shell/OS.

'use strict';

process.env.ELECTRON_MIRROR =
    process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
    process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/';

const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

// Resolve the electron-builder executable from the local node_modules/.bin folder.
const binName = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const builderBin = path.join(__dirname, '..', 'node_modules', '.bin', binName);

const result = spawnSync(builderBin, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
});

process.exit(result.status === null ? 1 : result.status);

// --- END OF FILE scripts/dist.js ---