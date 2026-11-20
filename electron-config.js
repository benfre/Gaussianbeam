// --- START OF FILE electron-config.js ---
// Renderer-side bridge between the simulator state (window.GBSimulator) and the
// Electron main-process config persistence / import / export IPC API.
//
// This file is a no-op when opened in a plain web browser (no window.electronAPI).

(function () {
    'use strict';

    const SAVE_DEBOUNCE_MS = 300;
    let initialized = false;
    let suppressed = false; // true while we programmatically apply a loaded/imported config
    let saveTimer = null;

    function buildConfig() {
        const state = window.GBSimulator.getState();
        return { version: 1, ...state };
    }

    function scheduleSave() {
        if (suppressed) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            try {
                const cfg = buildConfig();
                await window.electronAPI.saveConfig(cfg);
            } catch (error) {
                console.error('Failed to auto-save config:', error);
            }
        }, SAVE_DEBOUNCE_MS);
    }

    async function loadConfig() {
        try {
            const cfg = await window.electronAPI.loadConfig();
            if (!cfg || typeof cfg !== 'object') {
                return false;
            }
            suppressed = true;
            try {
                window.GBSimulator.applyState(cfg);
            } finally {
                suppressed = false;
            }
            console.log('Configuration restored from disk.');
            return true;
        } catch (error) {
            console.error('Failed to load config:', error);
            return false;
        }
    }

    async function exportConfig() {
        try {
            const cfg = buildConfig();
            const res = await window.electronAPI.exportConfig(cfg);
            if (res && res.error) {
                console.error('Export error:', res.error);
                alert('导出配置失败：' + res.error);
            } else if (res && !res.canceled) {
                console.log('Configuration exported to', res.filePath);
            }
        } catch (error) {
            console.error('Failed to export config:', error);
            alert('导出配置失败：' + error.message);
        }
    }

    async function importConfig() {
        try {
            const res = await window.electronAPI.importConfig();
            if (!res || res.canceled) return;
            if (res.error) {
                console.error('Import error:', res.error);
                alert('导入配置失败：' + res.error);
                return;
            }
            if (!res.data || typeof res.data !== 'object') {
                alert('导入配置失败：文件内容无效。');
                return;
            }
            suppressed = true;
            try {
                window.GBSimulator.applyState(res.data);
            } finally {
                suppressed = false;
            }
            // Persist the freshly imported config immediately.
            await window.electronAPI.saveConfig(buildConfig());
            console.log('Configuration imported from', res.filePath);
        } catch (error) {
            console.error('Failed to import config:', error);
            alert('导入配置失败：' + error.message);
        }
    }

    function wireButtons() {
        const exportBtn = document.getElementById('exportConfigBtn');
        const importBtn = document.getElementById('importConfigBtn');
        if (exportBtn) exportBtn.addEventListener('click', exportConfig);
        if (importBtn) importBtn.addEventListener('click', importConfig);
    }

    function main() {
        if (initialized) return;
        initialized = true;

        if (!window.electronAPI || !window.GBSimulator) {
            console.warn('Electron config bridge unavailable; config persistence disabled.');
            return;
        }

        wireButtons();
        window.GBSimulator.subscribe(scheduleSave);
        loadConfig();
    }

    if (window.GBSimulatorReady) {
        main();
    } else {
        window.addEventListener('gbsimulator:ready', main, { once: true });
    }
})();

// --- END OF FILE electron-config.js ---