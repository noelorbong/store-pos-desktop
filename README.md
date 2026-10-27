# Store POS Cashier

Electron cashier client with a local SQLite database and transactional sale outbox.

## Run locally

1. Migrate and run Laravel:
   `php artisan migrate` and `php artisan serve`
2. In this directory run:
   `npm install`
3. Start the cashier:
   `npm run dev`
4. Enter the Laravel URL and an existing employee/user login.

The first desktop launch asks for a one-time connection and login so it can download
the offline catalog and register the device. Later launches open the normal online
POS when the server is reachable and automatically fall back to the local cashier
when it is not. A checkout writes the
sale and its sync state in one SQLite transaction. Pending sales are retried every
15 seconds and the Laravel endpoint is idempotent by sale UUID.

Build the Windows installer with `npm run build`. The local database is stored in
Electron's per-user application data directory, not in the installation directory.

## macOS build

On a Mac, run `npm ci` and `npm run build:mac` in `desktop`.
The DMG and ZIP are written to `dist`. The app uses `public/image/logo.png`
for its packaged macOS icon and Dock icon.
Quit the old app and replace it in Applications with the newly built app.

## Windows 8.1 legacy build

On a modern Windows build machine, run `npm run build:legacy` in `desktop`.
This creates `dist-legacy/x64/Store-POS-Cashier-Legacy-0.1.2-x64-Setup.exe`.
For 32-bit Windows, run `npm run build:legacy -- ia32`; its output goes into
`dist-legacy/ia32`. The regular `npm run build` still uses Electron 37.

The legacy build pins Electron 22.3.27, with better-sqlite3 8.7.0 for SQLite and
node-fetch 2.7.0 for main-process requests. Dependencies have a separate lockfile;
the SQLite binary is downloaded for the target Electron ABI and architecture.
Its separate app ID and name allow installation alongside the regular app and
use a separate user data directory. Configure the connection again on first launch.

Electron 22 is end-of-life and receives no security updates. Validate login,
online checkout, and receipt printing on the actual Windows 8.1 machine before use.
Reference: https://releases.electronjs.org/release/v22.3.27

To check the packaged 64-bit runtime in PowerShell:

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& './dist-legacy/x64/win-unpacked/Store POS Cashier Legacy.exe' './scripts/test-legacy.cjs' './dist-legacy/x64/win-unpacked/resources/app.asar'
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

Card details must never be entered into or stored by this app. Store only the safe
reference returned by a compliant payment terminal.
