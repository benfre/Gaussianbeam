// --- START OF FILE scripts/vendor.js ---
// Copies third-party front-end assets (Plotly, Font Awesome) out of node_modules
// into the local vendor/ directory so the packaged app is fully offline.
// Runs automatically via the "postinstall" npm hook.

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function copyFile(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const s = path.join(srcDir, entry.name);
        const d = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDir(s, d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

function main() {
    // --- Plotly ---
    const plotlySrc = path.join(root, 'node_modules', 'plotly.js-dist-min', 'plotly.min.js');
    const plotlyDest = path.join(root, 'vendor', 'plotly.min.js');
    if (fs.existsSync(plotlySrc)) {
        copyFile(plotlySrc, plotlyDest);
        console.log('[vendor] OK: plotly.min.js');
    } else {
        console.warn('[vendor] MISSING: ' + plotlySrc);
    }

    // --- Font Awesome ---
    const faCss = path.join(root, 'node_modules', '@fortawesome', 'fontawesome-free', 'css', 'all.min.css');
    const faWebfonts = path.join(root, 'node_modules', '@fortawesome', 'fontawesome-free', 'webfonts');
    if (fs.existsSync(faCss) && fs.existsSync(faWebfonts)) {
        copyFile(faCss, path.join(root, 'vendor', 'fontawesome', 'css', 'all.min.css'));
        copyDir(faWebfonts, path.join(root, 'vendor', 'fontawesome', 'webfonts'));
        console.log('[vendor] OK: fontawesome');
    } else {
        console.warn('[vendor] MISSING: Font Awesome assets');
    }
}

main();

// --- END OF FILE scripts/vendor.js ---