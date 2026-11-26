<?php

declare(strict_types=1);

require_once __DIR__ . '/BgaStubs.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'Bga\\Games\\deductiobg\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . '/../modules/php/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($path)) {
        require_once $path;
    }
});
