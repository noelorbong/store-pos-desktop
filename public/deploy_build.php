<?php

declare(strict_types=1);

/*
 * Copies and replaces all files from store-pos/public/build
 * into public_html/build.
 *
 * Works in both CLI and web execution.
 */

try {
    $context = resolvePaths();

    runGitPull($context['projectRoot']);
    runArtisanMigrate($context['projectRoot']);
    copyDirectory($context['sourceDir'], $context['targetDir']);

    output("Build deployed successfully.");
    output('From: ' . $context['sourceDir']);
    output('To:   ' . $context['targetDir']);
} catch (Throwable $e) {
    if (!isCli()) {
        http_response_code(500);
    }

    output('Deployment failed: ' . $e->getMessage());
    exit(1);
}

/**
 * @return array{projectRoot:string,sourceDir:string,targetDir:string}
 */
function resolvePaths(): array
{
    $base = __DIR__;

    // Case 1: script inside store-pos project root.
    $caseOneProjectRoot = $base;
    $caseOneSource = $base . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'build';
    $caseOneTarget = dirname($base) . DIRECTORY_SEPARATOR . 'public_html' . DIRECTORY_SEPARATOR . 'build';
    if (is_dir($caseOneSource)) {
        return [
            'projectRoot' => $caseOneProjectRoot,
            'sourceDir' => $caseOneSource,
            'targetDir' => $caseOneTarget,
        ];
    }

    // Case 2: script placed in public_html and project is sibling folder store-pos.
    $caseTwoProjectRoot = dirname($base) . DIRECTORY_SEPARATOR . 'store-pos';
    $caseTwoSource = $caseTwoProjectRoot . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'build';
    $caseTwoTarget = $base . DIRECTORY_SEPARATOR . 'build';
    if (is_dir($caseTwoSource)) {
        return [
            'projectRoot' => $caseTwoProjectRoot,
            'sourceDir' => $caseTwoSource,
            'targetDir' => $caseTwoTarget,
        ];
    }

    throw new RuntimeException(
        'Unable to locate source build directory. Checked: ' . $caseOneSource . ' and ' . $caseTwoSource
    );
}

function runGitPull(string $projectRoot): void
{
    if (!is_dir($projectRoot)) {
        throw new RuntimeException('Project root not found: ' . $projectRoot);
    }

    if (!is_dir($projectRoot . DIRECTORY_SEPARATOR . '.git')) {
        throw new RuntimeException('Not a git repository: ' . $projectRoot);
    }

    if (!function_exists('exec')) {
        throw new RuntimeException('PHP exec() is disabled; cannot run git pull.');
    }

    $command = 'git -C ' . escapeshellarg($projectRoot) . ' pull 2>&1';
    $output = [];
    $exitCode = 1;

    exec($command, $output, $exitCode);

    output('Running: git pull in ' . $projectRoot);
    foreach ($output as $line) {
        output($line);
    }

    if ($exitCode !== 0) {
        throw new RuntimeException('git pull failed with exit code ' . $exitCode . '.');
    }
}

function runArtisanMigrate(string $projectRoot): void
{
    $artisan = $projectRoot . DIRECTORY_SEPARATOR . 'artisan';
    if (!file_exists($artisan)) {
        throw new RuntimeException('artisan file not found in project root: ' . $projectRoot);
    }
    if (!function_exists('exec')) {
        throw new RuntimeException('PHP exec() is disabled; cannot run artisan migrate.');
    }
    $command = 'php ' . escapeshellarg($artisan) . ' migrate --force 2>&1';
    $output = [];
    $exitCode = 1;
    exec($command, $output, $exitCode);
    output('Running: php artisan migrate in ' . $projectRoot);
    foreach ($output as $line) {
        output($line);
    }
    if ($exitCode !== 0) {
        throw new RuntimeException('php artisan migrate failed with exit code ' . $exitCode . '.');
    }
}

function isCli(): bool
{
    return PHP_SAPI === 'cli' || PHP_SAPI === 'phpdbg';
}

function output(string $message): void
{
    if (isCli()) {
        echo $message . PHP_EOL;
        return;
    }

    echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . "<br>\n";
}

function copyDirectory(string $source, string $target): void
{
    if (!is_dir($target) && !mkdir($target, 0755, true) && !is_dir($target)) {
        throw new RuntimeException("Unable to create target directory: {$target}");
    }

    $items = scandir($source);
    if ($items === false) {
        throw new RuntimeException("Unable to read source directory: {$source}");
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $sourcePath = $source . DIRECTORY_SEPARATOR . $item;
        $targetPath = $target . DIRECTORY_SEPARATOR . $item;

        if (is_dir($sourcePath)) {
            copyDirectory($sourcePath, $targetPath);
            continue;
        }

        if (!copy($sourcePath, $targetPath)) {
            throw new RuntimeException("Failed to copy file: {$sourcePath} -> {$targetPath}");
        }
    }
}