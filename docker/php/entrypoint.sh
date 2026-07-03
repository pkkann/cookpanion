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

    # Ensure DB + schema. Prefer migrations if any exist, otherwise sync schema directly.
    php bin/console doctrine:database:create --if-not-exists --no-interaction || true
    if ls migrations/Version*.php >/dev/null 2>&1; then
        echo "[entrypoint] Running database migrations..."
        php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration || true
    else
        echo "[entrypoint] No migrations found; syncing schema from entities..."
        php bin/console doctrine:schema:update --force --complete --no-interaction || true
    fi

    # Load fixtures only when explicitly requested
    if [ "${LOAD_FIXTURES:-false}" = "true" ]; then
        echo "[entrypoint] Loading fixtures..."
        php bin/console doctrine:fixtures:load --no-interaction || true
    fi
fi

exec "$@"
