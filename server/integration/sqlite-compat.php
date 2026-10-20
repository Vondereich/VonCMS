<?php

// Test-only PDO base: use the driver-specific API on PHP 8.4+ without losing 8.2/8.3.
if (class_exists(\Pdo\Sqlite::class)) {
  class_alias(\Pdo\Sqlite::class, 'VonCmsFixtureSqlitePDO');
} else {
  class VonCmsFixtureSqlitePDO extends PDO
  {
    public function createFunction(
      string $functionName,
      callable $callback,
      int $numArgs = -1,
      int $flags = 0,
    ): bool {
      return $this->sqliteCreateFunction($functionName, $callback, $numArgs, $flags);
    }
  }
}
