const { copyFileSync, cpSync, existsSync, mkdirSync, renameSync, rmSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const desktopDir = path.resolve(__dirname, '..');
const distDir = path.join(desktopDir, 'dist');
const unpackedDir = path.join(distDir, 'win-unpacked');
const temporaryDir = path.join(distDir, 'win-unpacked.tmp');
const stagingDir = path.join(distDir, 'app-staging');
const builderBin = path.join(
    desktopDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
);
const iconPath = path.resolve(desktopDir, '..', 'public', 'image', 'logo.ico');
const resourceEditor = path.join(desktopDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');

function runBuilder(args) {
    return spawnSync(builderBin, args, {
        cwd: desktopDir,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
}

function wait(milliseconds) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function removeGeneratedDirectory(directory) {
    if (existsSync(directory)) {
        rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    }
}

function prepareExtractedElectronApp() {
    const resourcesDir = path.join(unpackedDir, 'resources');
    const electronExecutable = path.join(unpackedDir, 'electron.exe');
    const productExecutable = path.join(unpackedDir, 'Store POS Cashier.exe');
    const appArchive = path.join(resourcesDir, 'app.asar');
    const defaultArchive = path.join(resourcesDir, 'default_app.asar');
    const asarCli = path.join(desktopDir, 'node_modules', '@electron', 'asar', 'bin', 'asar.js');

    removeGeneratedDirectory(stagingDir);
    mkdirSync(stagingDir, { recursive: true });

    for (const file of ['main.cjs', 'preload.cjs', 'database.cjs', 'package.json']) {
        copyFileSync(path.join(desktopDir, file), path.join(stagingDir, file));
    }
    cpSync(path.join(desktopDir, 'renderer'), path.join(stagingDir, 'renderer'), { recursive: true });

    rmSync(appArchive, { force: true });
    const asarResult = spawnSync(process.execPath, [asarCli, 'pack', stagingDir, appArchive], {
        cwd: desktopDir,
        stdio: 'inherit',
    });
    if (asarResult.status !== 0) process.exit(asarResult.status || 1);

    copyFileSync(electronExecutable, productExecutable);
    rmSync(defaultArchive, { force: true });
    removeGeneratedDirectory(stagingDir);
}

function applyExecutableIcon() {
    const executable = path.join(unpackedDir, 'Store POS Cashier.exe');
    if (!existsSync(executable)) throw new Error('Packaged Store POS executable was not found.');
    if (!existsSync(iconPath)) throw new Error(`Desktop icon was not found: ${iconPath}`);
    if (!existsSync(resourceEditor)) throw new Error(`Windows resource editor was not found: ${resourceEditor}`);

    const iconResult = spawnSync(resourceEditor, [executable, '--set-icon', iconPath], {
        cwd: desktopDir,
        stdio: 'inherit',
    });
    if (iconResult.status !== 0) process.exit(iconResult.status || 1);
}

removeGeneratedDirectory(unpackedDir);
removeGeneratedDirectory(temporaryDir);

const packageResult = runBuilder(['--win', '--dir']);

if (packageResult.status !== 0) {
    if (!existsSync(temporaryDir)) {
        process.exit(packageResult.status || 1);
    }

    console.log('\nWindows blocked Electron Builder\'s final folder rename. Applying the automatic packaging workaround...');

    let renamed = false;
    for (let attempt = 1; attempt <= 10 && !renamed; attempt += 1) {
        try {
            renameSync(temporaryDir, unpackedDir);
            renamed = true;
        } catch (error) {
            if (attempt === 10 && process.platform !== 'win32') throw error;
            wait(300);
        }
    }

    if (!renamed && process.platform === 'win32') {
        const moveResult = spawnSync(
            'powershell.exe',
            [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                'Move-Item -LiteralPath $env:STORE_POS_BUILD_SOURCE -Destination $env:STORE_POS_BUILD_DESTINATION',
            ],
            {
                cwd: desktopDir,
                stdio: 'inherit',
                env: {
                    ...process.env,
                    STORE_POS_BUILD_SOURCE: temporaryDir,
                    STORE_POS_BUILD_DESTINATION: unpackedDir,
                },
            },
        );

        if (moveResult.status !== 0) process.exit(moveResult.status || 1);
    }

    prepareExtractedElectronApp();
}

if (!existsSync(unpackedDir)) {
    throw new Error('Electron packaging did not produce dist/win-unpacked.');
}

applyExecutableIcon();

const installerResult = runBuilder(['--win', 'nsis', '--prepackaged', unpackedDir]);
process.exit(installerResult.status || 0);
