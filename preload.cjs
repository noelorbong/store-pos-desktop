const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cashier', {
    isDesktop: true,
    platform: process.platform,
    settings: () => ipcRenderer.invoke('session:settings'),
    setServerUrl: value => ipcRenderer.invoke('session:set-server-url', value),
    openOnlinePos: () => ipcRenderer.invoke('session:open-online-pos'),
    openOfflineCashier: () => ipcRenderer.invoke('session:open-offline-cashier'),
    login: input => ipcRenderer.invoke('session:login', input),
    localCatalog: () => ipcRenderer.invoke('catalog:local'),
    refreshCatalog: () => ipcRenderer.invoke('catalog:refresh'),
    saveSale: input => ipcRenderer.invoke('sale:save', input),
    sync: () => ipcRenderer.invoke('sync:run'),
    status: () => ipcRenderer.invoke('sync:status'),
    command: command => ipcRenderer.invoke('ui:command', command),
    printers: () => ipcRenderer.invoke('printer:list'),
    selectedPrinter: () => ipcRenderer.invoke('printer:selected'),
    printHtml: html => ipcRenderer.invoke('printer:print-html', html),
    onStatus: callback => ipcRenderer.on('sync-status', (_event, status) => callback(status)),
    onCommand: callback => ipcRenderer.on('ui:command', (_event, command) => callback(command)),
});

// Also support servers still serving the POS before its macOS visibility update.
if (process.platform === 'darwin') {
    const hideShortcutBars = () => {
        document.querySelectorAll('.shortcut-bar, [data-pos-shortcuts]').forEach(bar => {
            bar.style.setProperty('display', 'none', 'important');
        });
        document.querySelectorAll('p').forEach(heading => {
            if (heading.textContent.trim() !== 'Keyboard shortcuts') return;
            const bar = heading.parentElement?.parentElement;
            if (bar?.classList.contains('fixed') && bar.querySelector('kbd')) {
                bar.style.setProperty('display', 'none', 'important');
            }
        });
    };
    window.addEventListener('DOMContentLoaded', () => {
        hideShortcutBars();
        new MutationObserver(hideShortcutBars).observe(document.body, { childList: true, subtree: true });
    });
}
