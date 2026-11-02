<?php
// 1. Force error reporting on
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$target = __DIR__ . '/../store-pos/storage/app/public'; 
$shortcut = __DIR__ . '/storage'; 

// 2. Check if target actually exists first
if (!file_exists($target)) {
    die("Error: Target directory does not exist at " . realpath($target));
}

if (symlink($target, $shortcut)) {
    echo "Symlink created successfully!";
} else {
    echo "Error creating symlink.";
}
?>