const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const desktopDir = path.resolve(__dirname, '..');
const outputDir = path.join(desktopDir, 'dist-legacy');
const appDir = path.join(outputDir, 'app');
const arch = process.argv[2] || 'x64';
if (!['x64', 'ia32'].includes(arch)) throw new Error('Use x64 or ia32 as the legacy architecture.');
const electronVersion = '22.3.27';

function run(command, args, cwd = appDir, shell = false) {
    const result = spawnSync(command, args, { cwd, shell, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

fs.mkdirSync(appDir, { recursive: true });
for (const file of ['main.cjs', 'preload.cjs', 'database.cjs']) {
    fs.copyFileSync(path.join(desktopDir, file), path.join(appDir, file));
}
for (const file of ['package.json', 'package-lock.json', 'legacy-main.cjs']) {
    fs.copyFileSync(path.join(desktopDir, 'legacy', file), path.join(appDir, file));
}
fs.cpSync(path.join(desktopDir, 'renderer'), path.join(appDir, 'renderer'), { recursive: true });
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], appDir, process.platform === 'win32');
// Fetch the addon for Electron's ABI, not the Node version running this build.
run(process.execPath, [path.join(appDir, 'node_modules/prebuild-install/bin.js'), '--runtime=electron', `--target=${electronVersion}`, '--platform=win32', `--arch=${arch}`], path.join(appDir, 'node_modules/better-sqlite3'));

const config = {
    appId: 'com.storepos.cashier.legacy',
    productName: 'Store POS Cashier Legacy',
    electronVersion,
    npmRebuild: false,
    directories: { output: path.join(outputDir, arch) },
    files: ['*.cjs', 'renderer/**/*', 'package.json'],
    asarUnpack: ['node_modules/better-sqlite3/**/*'],
    extraResources: [{ from: path.join(desktopDir, '../public/image/logo.ico'), to: 'logo.ico' }],
    win: { target: ['nsis'], icon: path.join(desktopDir, '../public/image/logo.ico') },
    artifactName: 'Store-POS-Cashier-Legacy-${version}-${arch}-Setup.${ext}',
};
const configPath = path.join(outputDir, 'builder.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

async function packageLegacy() {
    // Extract directly: this workspace blocks electron-builder's temporary-folder rename.
    const { downloadArtifact } = require('@electron/get');
    const extract = require('extract-zip');
    const unpacked = path.join(outputDir, arch, 'win-unpacked');
    if (!path.resolve(unpacked).startsWith(outputDir + path.sep)) throw new Error('Invalid output path');
    fs.rmSync(unpacked, { recursive: true, force: true });
    fs.mkdirSync(unpacked, { recursive: true });
    const archive = await downloadArtifact({ version: electronVersion, artifactName: 'electron', platform: 'win32', arch });
    await extract(archive, { dir: unpacked });
    // A separate process releases the archive handle before NSIS reads it.
    run(process.execPath, [path.join(desktopDir, 'node_modules/@electron/asar/bin/asar.js'), 'pack', appDir, path.join(unpacked, 'resources/app.asar'), '--unpack', '**/*.node'], desktopDir);
    fs.rmSync(path.join(unpacked, 'resources/default_app.asar'), { force: true });
    const executable = path.join(unpacked, 'Store POS Cashier Legacy.exe');
    fs.copyFileSync(path.join(unpacked, 'electron.exe'), executable);
    fs.rmSync(path.join(unpacked, 'electron.exe'));
    fs.copyFileSync(config.win.icon, path.join(unpacked, 'resources/logo.ico'));
    run(path.join(desktopDir, 'node_modules/electron-winstaller/vendor/rcedit.exe'), [executable, '--set-icon', config.win.icon], desktopDir);
    run(process.execPath, [path.join(desktopDir, 'node_modules/electron-builder/cli.js'), '--projectDir', appDir, '--config', configPath, '--win', `--${arch}`, '--prepackaged', unpacked], desktopDir);
}

packageLegacy().catch(error => { console.error(error); process.exitCode = 1; });
