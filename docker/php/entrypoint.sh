#!/usr/bin/env bash
set -e

cd /var/www/html

if [ -f composer.json ]; then
    if [ ! -d vendor ]; then
        echo "[entrypoint] Installing composer dependencies..."
        composer install --no-interaction --prefer-dist
    fi

    # Generate JWT keypair if missing (lexik/jwt-authentication-bundle)
    if [ ! -f config/jwt/private.pem ]; then
        echo "[entrypoint] Generating JWT keypair..."
        php bin/console lexik:jwt:generate-keypair --skip-if-exists --no-interaction || true
    fi

    # Ensure the SQLite data directory exists, then bring the schema up to date.
    mkdir -p var/data
    echo "[entrypoint] Running database migrations..."
    php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

    # Load fixtures only when explicitly requested
    if [ "${LOAD_FIXTURES:-false}" = "true" ]; then
        echo "[entrypoint] Loading fixtures..."
        php bin/console doctrine:fixtures:load --no-interaction || true
    fi

    # The console commands above run as root, but php-fpm workers run as
    # www-data — open up var/ (SQLite db + WAL siblings, cache, logs) so the
    # workers can write. chmod instead of chown keeps the bind-mounted files
    # manageable from the host.
    chmod -R a+rwX var
fi

exec "$@"
