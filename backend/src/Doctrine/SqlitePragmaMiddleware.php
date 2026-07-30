<?php

namespace App\Doctrine;

use Doctrine\DBAL\Driver;
use Doctrine\DBAL\Driver\AbstractSQLiteDriver;
use Doctrine\DBAL\Driver\Connection;
use Doctrine\DBAL\Driver\Middleware;
use Doctrine\DBAL\Driver\Middleware\AbstractDriverMiddleware;
use SensitiveParameter;

/**
 * Applies per-connection SQLite pragmas. Several php-fpm workers share the one
 * database file, so WAL + a busy timeout are needed to avoid "database is
 * locked" errors, and foreign keys are off by default in SQLite.
 */
final class SqlitePragmaMiddleware implements Middleware
{
    public function wrap(Driver $driver): Driver
    {
        if (!$driver instanceof AbstractSQLiteDriver) {
            return $driver;
        }

        return new class($driver) extends AbstractDriverMiddleware {
            public function connect(
                #[SensitiveParameter]
                array $params,
            ): Connection {
                $connection = parent::connect($params);

                $connection->exec('PRAGMA journal_mode=WAL');
                $connection->exec('PRAGMA busy_timeout=5000');
                $connection->exec('PRAGMA foreign_keys=ON');

                return $connection;
            }
        };
    }
}
