const { app, BrowserWindow, globalShortcut, ipcMain, Menu } = require('electron');
const path = require('node:path');
const os = require('node:os');
const LocalDatabase = require('./database.cjs');

let window;
let database;
let syncing = false;
let probing = false;
let offlineLoading = false;
let online = false;
let posUrl = null;
const OFFLINE_POS_ENABLED = false;

function desktopIconPath() {
    const iconName = process.platform === 'darwin' ? 'logo.png' : 'logo.ico';
    return app.isPackaged
        ? path.join(process.resourcesPath, iconName)
        : path.join(__dirname, '..', 'public', 'image', iconName);
}

async function printReceipt(payload) {
    const html = String(payload?.html || payload || '').trim();
    if (!html) throw new Error('There is no receipt content to print.');
    const baseUrl = String(payload?.baseUrl || '').replace(/"/g, '&quot;');
    const styles = String(payload?.styles || '');
    const printWindow = new BrowserWindow({
        show: false,
        webPreferences: { contextIsolation: true, backgroundThrottling: false },
    });
    const deviceName = database.getSetting('printer_device_name') || undefined;
    try {
        const documentHtml = `<!doctype html><html><head><meta charset="utf-8">${baseUrl ? `<base href="${baseUrl}/">` : ''}${styles}<style>html,body{margin:0!important;padding:0!important;background:#fff!important}table{border-collapse:collapse}@page{margin:0}</style></head><body>${html}</body></html>`;
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(documentHtml)}`);
        await printWindow.webContents.executeJavaScript(`Promise.all([document.fonts?.ready, ...Array.from(document.images).map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = image.onerror = resolve; }))])`, true);
        return await new Promise((resolve, reject) => {
            printWindow.webContents.print({ silent: true, deviceName, printBackground: true }, (success, reason) => {
                if (success) resolve(true);
                else reject(new Error(reason || 'Printing failed.'));
            });
        });
    } finally {
        if (!printWindow.isDestroyed()) printWindow.close();
    }
}

async function installApplicationMenu() {
    if (!window || window.isDestroyed()) return;
    const printers = await window.webContents.getPrintersAsync().catch(() => []);
    const selectedPrinter = database.getSetting('printer_device_name') || '';
    const printerItems = [
        {
            label: 'Use System Default',
            type: 'radio',
            checked: !selectedPrinter,
            click: () => { database.setSetting('printer_device_name', ''); installApplicationMenu(); },
        },
        { type: 'separator' },
        ...printers.map(printer => ({
            label: printer.displayName || printer.name,
            sublabel: printer.description || undefined,
            type: 'radio',
            checked: selectedPrinter === printer.name,
            click: () => { database.setSetting('printer_device_name', printer.name); installApplicationMenu(); },
        })),
        ...(printers.length ? [] : [{ label: 'No printers found', enabled: false }]),
        { type: 'separator' },
        { label: 'Refresh Printer List', click: () => installApplicationMenu() },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate([
        { label: 'File', submenu: [{ role: 'quit' }] },
        { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
        { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
        { label: 'Printer', submenu: printerItems },
        { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
        { label: 'Help', submenu: [{ label: 'Store POS Cashier', enabled: false }] },
    ]));
}

function offlineCashierPath() {
    return path.join(__dirname, 'renderer', 'index.html');
}

function hasOfflineSession() {
    return Boolean(database.getSetting('api_token'));
}

async function openOfflineCashier() {
    if (!OFFLINE_POS_ENABLED) {
        throw new Error('Offline POS is temporarily disabled. Connect to the server to continue.');
    }
    if (!window || window.isDestroyed() || offlineLoading) return;
    const currentUrl = window.webContents.getURL();
    if (currentUrl.startsWith('file:') && currentUrl.endsWith('/renderer/index.html')) return;

    offlineLoading = true;
    online = false;
    try {
        await window.loadFile(offlineCashierPath());
    } finally {
        offlineLoading = false;
    }
}

async function openOnlinePos() {
    if (!window || window.isDestroyed()) return;
    posUrl = getPosUrl();
    await window.loadURL(posUrl);
}

function apiUrl(endpoint) {
    const base = (database.getSetting('server_url') || '').replace(/\/+$/, '');
    return `${base}/api/desktop/v1${endpoint}`;
}

async function apiRequest(endpoint, options = {}) {
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-POS-Device': database.getSetting('device_uuid'),
        ...options.headers,
    };
    const token = database.getSetting('api_token');
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(apiUrl(endpoint), { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const validation = body.errors ? Object.values(body.errors).flat().join(' ') : '';
        throw new Error(validation || body.message || `Server returned ${response.status}`);
    }
    online = true;
    return body;
}

function getPosUrl() {
    const base = (database.getSetting('server_url') || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    return `${base}/admin/pos`;
}

function normalizeServerUrl(value) {
    const input = String(value || '').trim();
    if (!input) throw new Error('Enter an IP address or domain.');

    const hasProtocol = /^https?:\/\//i.test(input);
    const host = input.split('/')[0];
    const isLocalAddress = /^(localhost|127\.0\.0\.1|\d{1,3}(\.\d{1,3}){3})(:\d+)?$/i.test(host);
    const candidate = hasProtocol ? input : `${isLocalAddress ? 'http' : 'https'}://${input}`;
    const parsed = new URL(candidate);

    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
        throw new Error('Use a valid HTTP or HTTPS server address.');
    }

    return parsed.toString().replace(/\/$/, '');
}

async function sendCommandToPage(command) {
    if (!window || window.isDestroyed()) return;

    if (window.webContents.getURL().startsWith('file:')) {
        window.webContents.send('ui:command', command);
        return;
    }

    const scripts = {
        'focus-search': `
            (() => {
                document.querySelector('[data-pos-item-search-trigger]')?.click?.();
                let attempts = 0;
                const timer = setInterval(() => {
                    const searchToggle = document.querySelector('[data-pos-search-toggle]');
                    if (searchToggle) {
                        searchToggle.click();
                        clearInterval(timer);
                        setTimeout(() => {
                            const input = document.querySelector('[data-pos-search-input]');
                            input?.focus?.();
                            input?.select?.();
                        }, 50);
                        return;
                    }
                    attempts += 1;
                    if (attempts >= 20) {
                        clearInterval(timer);
                    }
                }, 50);
            })();
        `,
        'focus-barcode': `
            (() => {
                const input = document.querySelector('input[placeholder*="barcode"], input[placeholder*="Barcode"], input[placeholder*="Scan barcode"]');
                if (input) { input.focus(); input.select?.(); }
            })();
        `,
        'clear-cart': `
            (() => {
                document.querySelector('[data-pos-clear-cart], #clear-cart')?.click?.();
            })();
        `,
        'close-modal': `
            (() => {
                const visibleAlertPopup = document.querySelector('.swal2-popup.swal2-show');
                const visibleAlert = visibleAlertPopup?.closest('.swal2-container') || null;
                if (visibleAlert) {
                    const alertButton = visibleAlert.querySelector('.swal2-cancel:not([style*="display: none"])')
                        || visibleAlert.querySelector('.swal2-confirm');
                    alertButton?.click?.();
                    return;
                }
                const customerCloseButton = document.querySelector('[data-pos-customer-modal-close]');
                if (customerCloseButton) {
                    customerCloseButton.click();
                    return;
                }
                const badOrderModal = document.querySelector('[data-bad-order-modal]');
                if (badOrderModal) {
                    [...badOrderModal.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Cancel')?.click?.();
                    return;
                }
                const closeButton = document.querySelector('[data-pos-adjustment-close]')
                    || document.querySelector('[data-pos-reservation-form-close]')
                    || document.querySelector('[data-pos-reservations-close]')
                    || document.querySelector('[data-pos-payment-modal-close]')
                    || document.querySelector('[data-pos-order-item-modal-close]')
                    || document.querySelector('[data-pos-modal-close]');
                closeButton?.click?.();
            })();
        `,
        'edit-latest-quantity': `
            (() => {
                const latestItem = document.querySelector('[data-pos-latest-cart-item]');
                if (!latestItem) return;
                latestItem.click();

                let attempts = 0;
                const timer = setInterval(() => {
                    const input = document.querySelector('[data-pos-cart-quantity-input]');
                    if (input) {
                        clearInterval(timer);
                        input.focus();
                        input.select();
                        return;
                    }
                    attempts += 1;
                    if (attempts >= 20) clearInterval(timer);
                }, 50);
            })();
        `,
        'highlight-previous-item': `window.dispatchEvent(new CustomEvent('pos:navigate-cart', { detail: { direction: 'previous' } }));`,
        'highlight-next-item': `window.dispatchEvent(new CustomEvent('pos:navigate-cart', { detail: { direction: 'next' } }));`,
        'focus-discount': `
            (() => {
                const badOrderField = document.querySelector('[data-bad-order-modal] [data-bad-order-refund-amount]');
                if (badOrderField) {
                    badOrderField.focus();
                    badOrderField.select?.();
                    return;
                }
                const itemDiscountType = document.querySelector('[data-pos-item-discount-type-toggle]');
                if (itemDiscountType) {
                    itemDiscountType.value = itemDiscountType.value === 'percent' ? 'fixed' : 'percent';
                    itemDiscountType.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }
                const adjustmentTypes = [...document.querySelectorAll('[data-pos-adjustment-modal] [data-pos-adjustment-type]')];
                if (adjustmentTypes.length) {
                    const selectedIndex = Math.max(0, adjustmentTypes.findIndex(option => option.hasAttribute('data-pos-adjustment-type-selected')));
                    adjustmentTypes[(selectedIndex + 1) % adjustmentTypes.length]?.click?.();
                    return;
                }
                const paymentOptions = [...document.querySelectorAll('[data-pos-payment-method-option]')];
                if (paymentOptions.length) {
                    const selectedIndex = Math.max(0, paymentOptions.findIndex(option => option.hasAttribute('data-pos-payment-method-selected')));
                    paymentOptions[(selectedIndex + 1) % paymentOptions.length]?.click?.();
                    return;
                }
                document.querySelector('[data-pos-discount-trigger], [data-pos-discount-input]')?.click?.();
            })();
        `,
        'focus-tax': `
            (() => {
                const badOrderField = document.querySelector('[data-bad-order-modal] [data-bad-order-details]');
                if (badOrderField) {
                    badOrderField.focus();
                    badOrderField.select?.();
                    return;
                }
                const itemDiscountInput = document.querySelector('[data-pos-item-discount-input]');
                if (itemDiscountInput) {
                    itemDiscountInput.focus();
                    itemDiscountInput.select?.();
                    return;
                }
                document.querySelector('[data-pos-tax-trigger], #tax')?.click?.();
            })();
        `,
        'focus-item-quantity': `
            (() => {
                const input = document.querySelector('[data-pos-cart-quantity-input]');
                input?.focus?.();
                input?.select?.();
            })();
        `,
        'void-order': `
            (() => {
                const badOrderModal = document.querySelector('[data-bad-order-modal]');
                if (badOrderModal) {
                    const badOrderField = badOrderModal.querySelector('[data-bad-order-refund-method]');
                    badOrderField?.focus?.();
                    badOrderField?.select?.();
                    return;
                }
                document.querySelector('[data-pos-void-order]')?.click?.();
            })();
        `,
        'focus-customer-search': `
            (() => {
                if (document.querySelector('[data-bad-order-modal]')) {
                    window.dispatchEvent(new CustomEvent('pos:toggle-bad-order-reload'));
                    return;
                }
                const removeButton = document.querySelector('[data-pos-remove-customer-trigger]');
                if (removeButton) {
                    removeButton.click();
                    return;
                }
                const input = document.querySelector('[data-pos-customer-search]:not(:disabled)');
                input?.focus?.();
                input?.select?.();
                input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            })();
        `,
        'create-customer': `
            (() => {
                const badOrderField = document.querySelector('[data-bad-order-modal] [data-bad-order-reason]');
                if (badOrderField) {
                    badOrderField.focus();
                    return;
                }
                const trigger = document.querySelector('[data-pos-create-customer-trigger]');
                if (trigger) trigger.click();
                else window.dispatchEvent(new CustomEvent('pos:create-customer'));

                let attempts = 0;
                const timer = setInterval(() => {
                    const input = document.querySelector('[data-pos-customer-first-name]');
                    if (input) {
                        clearInterval(timer);
                        input.focus();
                        input.select();
                        return;
                    }
                    attempts += 1;
                    if (attempts >= 20) clearInterval(timer);
                }, 50);
            })();
        `,
        'reserve': `
            (() => {
                const badOrderModal = document.querySelector('[data-bad-order-modal]');
                if (badOrderModal) {
                    const badOrderField = badOrderModal.querySelector('[data-bad-order-reference]');
                    badOrderField?.focus?.();
                    badOrderField?.select?.();
                    return;
                }
                document.querySelector('[data-pos-reserve]')?.click?.();
            })();
        `,
        'retrieve-reservation': `
            (() => {
                document.querySelector('[data-pos-reservations-trigger]')?.click?.();
            })();
        `,
        'pay-later': `
            (() => {
                if (document.querySelector('.swal2-popup.swal2-show')) return;
                const payLater = document.querySelector('[data-pos-pay-later]');
                if (payLater) {
                    payLater.click?.();
                    return;
                }
                const priceModes = [...document.querySelectorAll('[data-pos-price-mode]')];
                if (!priceModes.length) return;
                const selectedIndex = Math.max(0, priceModes.findIndex(option => option.hasAttribute('data-pos-price-mode-selected')));
                priceModes[(selectedIndex + 1) % priceModes.length]?.click?.();
            })();
        `,
        'checkout': `
            (() => {
                const itemModalPay = document.querySelector('[data-pos-item-modal-pay]');
                if (itemModalPay) {
                    itemModalPay.click?.();
                    return;
                }
                const button = [...document.querySelectorAll('button')].find((el) => /confirm order|pay|checkout/i.test(el.textContent || ''));
                button?.click?.();
            })();
        `,
        'reprint-order': `window.dispatchEvent(new CustomEvent('pos:reprint-order'));`,
        'focus-login': `(() => { document.querySelector('input[type="email"], input[name="email"]')?.focus?.(); })();`,
    };

    const script = scripts[command];
    if (!script) return;
    await window.webContents.executeJavaScript(script, true);
}

async function showConnectionIndicator() {
    if (!window || window.isDestroyed() || window.webContents.getURL().startsWith('file:')) return;

    if (!OFFLINE_POS_ENABLED) {
        await window.webContents.executeJavaScript(`document.querySelector('#desktop-connection-indicator')?.remove?.();`, true).catch(() => {});
        return;
    }

    const status = JSON.stringify({ online, offlineEnabled: OFFLINE_POS_ENABLED });
    await window.webContents.executeJavaScript(`
        (() => {
            const status = ${status};
            let indicator = document.querySelector('#desktop-connection-indicator');
            if (!indicator) {
                indicator = document.createElement('button');
                indicator.id = 'desktop-connection-indicator';
                indicator.type = 'button';
                indicator.style.cssText = 'position:fixed;left:14px;bottom:54px;z-index:2147483647;border:1px solid transparent;border-radius:999px;padding:8px 13px;font:700 12px/1.2 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(15,23,42,.2);cursor:default';
                indicator.addEventListener('click', () => {
                    if (indicator.dataset.online !== 'true' && indicator.dataset.offlineEnabled === 'true') window.cashier?.openOfflineCashier?.();
                });
                document.body.appendChild(indicator);
            }
            indicator.dataset.online = String(status.online);
            indicator.dataset.offlineEnabled = String(status.offlineEnabled);
            indicator.textContent = status.online ? '● ONLINE' : (status.offlineEnabled ? '● OFFLINE — Switch to offline cashier' : '● SERVER UNAVAILABLE');
            indicator.style.background = status.online ? '#ecfdf5' : '#fff1f2';
            indicator.style.borderColor = status.online ? '#a7f3d0' : '#fecdd3';
            indicator.style.color = status.online ? '#047857' : '#be123c';
            indicator.style.cursor = !status.online && status.offlineEnabled ? 'pointer' : 'default';
            indicator.title = status.online ? 'The POS server is reachable.' : (status.offlineEnabled ? 'The server cannot be reached. Click to use the offline cashier.' : 'The server cannot be reached. Offline POS is temporarily disabled.');
        })();
    `, true).catch(() => {});
}

function broadcastStatus() {
    if (!window || window.isDestroyed()) return;
    window.webContents.send('sync-status', { ...database.status(), online });
    showConnectionIndicator().catch(() => {});
}

async function probeConnection() {
    if (probing || !database.getSetting('api_token')) return;
    probing = true;
    try {
        await apiRequest('/status', { signal: AbortSignal.timeout(5000) });
        online = true;
    } catch (_error) {
        online = false;
    } finally {
        probing = false;
        broadcastStatus();
    }
}

async function syncPending() {
    if (syncing || !database.getSetting('api_token')) return;
    syncing = true;
    try {
        for (const sale of database.pendingSales()) {
            database.markSyncing(sale.uuid);
            try {
                const result = await apiRequest('/sales', {
                    method: 'POST',
                    body: sale.payload,
                });
                database.markSynced(sale.uuid, result);
            } catch (error) {
                online = false;
                database.markFailed(sale.uuid, error.message);
                break;
            }
        }
    } finally {
        syncing = false;
        broadcastStatus();
    }
}

function registerIpc() {
    ipcMain.handle('session:login', async (_event, input) => {
        database.setSetting('server_url', input.server_url);
        const result = await apiRequest('/login', {
            method: 'POST',
            body: JSON.stringify({
                email: input.email,
                password: input.password,
                device_uuid: database.getSetting('device_uuid'),
                device_name: input.device_name || os.hostname(),
            }),
        });
        database.setSetting('api_token', result.token);
        database.setSetting('user_name', result.user.name);
        await refreshCatalog();
        return { user: result.user, catalog: database.catalog(), pos_url: getPosUrl() };
    });
    ipcMain.handle('session:settings', () => ({
        server_url: database.getSetting('server_url') || 'http://127.0.0.1:8000',
        device_name: os.hostname(),
        user_name: database.getSetting('user_name'),
        authenticated: Boolean(database.getSetting('api_token')),
    }));
    ipcMain.handle('session:set-server-url', (_event, value) => {
        const serverUrl = normalizeServerUrl(value);
        database.setSetting('server_url', serverUrl);
        return {
            server_url: serverUrl,
            pos_url: `${serverUrl}/admin/pos`,
        };
    });
    ipcMain.handle('session:open-online-pos', openOnlinePos);
    ipcMain.handle('session:open-offline-cashier', () => {
        if (!OFFLINE_POS_ENABLED) {
            throw new Error('Offline POS is temporarily disabled. Connect to the server to continue.');
        }
        if (!hasOfflineSession()) {
            throw new Error('Connect and sign in once before using the offline cashier.');
        }
        return openOfflineCashier();
    });
    ipcMain.handle('catalog:local', () => database.catalog());
    ipcMain.handle('catalog:refresh', refreshCatalog);
    ipcMain.handle('sale:save', async (_event, input) => {
        const sale = database.saveSale(input);
        syncPending();
        return sale;
    });
    ipcMain.handle('sync:run', syncPending);
    ipcMain.handle('sync:status', () => ({ ...database.status(), online }));
    ipcMain.handle('ui:command', async (_event, command) => {
        await sendCommandToPage(command);
        return true;
    });
    ipcMain.handle('printer:list', () => window?.webContents.getPrintersAsync() ?? []);
    ipcMain.handle('printer:selected', () => database.getSetting('printer_device_name') || '');
    ipcMain.handle('printer:print-html', (_event, payload) => printReceipt(payload));
}

async function refreshCatalog() {
    const catalog = await apiRequest('/catalog');
    database.replaceCatalog(catalog);
    return database.catalog();
}

app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock.setIcon(desktopIconPath());
    database = new LocalDatabase(path.join(app.getPath('userData'), 'cashier.sqlite'));
    registerIpc();
    window = new BrowserWindow({
        width: 1360,
        height: 850,
        minWidth: 1000,
        minHeight: 650,
        icon: desktopIconPath(),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    window.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedUrl, isMainFrame) => {
        if (!isMainFrame || errorCode === -3 || window.isDestroyed()) return;
        if (OFFLINE_POS_ENABLED && hasOfflineSession()) {
            openOfflineCashier().catch(() => {});
        } else {
            window.loadFile(path.join(__dirname, 'renderer', 'connection.html'));
        }
    });
    posUrl = getPosUrl();
    if (OFFLINE_POS_ENABLED && hasOfflineSession()) {
        // did-fail-load owns the fallback. Calling it here too can race two
        // loadFile navigations when the server is unavailable at startup.
        openOnlinePos().catch(() => {});
    } else {
        window.loadFile(path.join(__dirname, 'renderer', 'connection.html'));
    }
    setInterval(syncPending, 15000);
    setInterval(probeConnection, 10000);
    syncPending();
    probeConnection();

    const register = (accelerator, command) => {
        globalShortcut.register(accelerator, () => {
            if (window && !window.isDestroyed()) {
                window.show();
                window.focus();
                sendCommandToPage(command).catch(() => {});
            }
        });
    };

    register('F11', 'focus-search');
    register('Insert', 'focus-barcode');
    register('Home', 'clear-cart');
    register('F3', 'focus-discount');
    register('F4', 'focus-tax');
    register('F5', 'void-order');
    register('F10', 'edit-latest-quantity');
    register('F1', 'focus-customer-search');
    register('F2', 'create-customer');
    register('F6', 'reserve');
    register('F7', 'retrieve-reservation');
    register('F8', 'reprint-order');
    register('F12', 'checkout');
    register('numadd', 'checkout');
    register('F9', 'pay-later');
    register('Esc', 'close-modal');
    register('Ctrl+L', 'focus-login');

    window.webContents.on('did-finish-load', () => {
        broadcastStatus();
        installApplicationMenu().catch(() => {});
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
