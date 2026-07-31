#!/bin/bash
set -e

OPTIONS=/data/options.json

# Home Assistant writes addon options to /data/options.json. When testing with
# plain `docker run`, options can be passed as -e env vars instead (env wins
# only when the option is absent/empty).
# NB: not `// empty` — jq's alternative operator would swallow a boolean
# `false` (e.g. allow_registration: false) as if the option were unset.
opt() { jq -r --arg k "$1" '.[$k] | select(. != null) | tostring' "$OPTIONS" 2>/dev/null; }
if [ -f "$OPTIONS" ]; then
    v="$(opt google_client_id)";    [ -n "$v" ] && export GOOGLE_CLIENT_ID="$v"
    v="$(opt anthropic_api_key)";   [ -n "$v" ] && export ANTHROPIC_API_KEY="$v"
    v="$(opt ai_model)";            [ -n "$v" ] && export AI_MODEL="$v"
    v="$(opt allow_registration)";  [ -n "$v" ] && export ALLOW_REGISTRATION="$v"
    v="$(opt db_admin_password)";   [ -n "$v" ] && export DB_ADMIN_PASSWORD="$v"
fi
export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
export AI_MODEL="${AI_MODEL:-claude-sonnet-4-5}"
export ALLOW_REGISTRATION="${ALLOW_REGISTRATION:-true}"
# Adminer (port 8081 → host 8100). Empty password = login disabled.
export DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:-}"
export SQLITE_DB_PATH=/data/app.db

# Secrets are generated once and persisted in /data so JWTs (and therefore
# sessions) survive addon restarts and updates.
[ -s /data/.app_secret ]     || php -r 'echo bin2hex(random_bytes(32));' > /data/.app_secret
[ -s /data/.jwt_passphrase ] || php -r 'echo bin2hex(random_bytes(32));' > /data/.jwt_passphrase
export APP_SECRET="$(cat /data/.app_secret)"
export JWT_PASSPHRASE="$(cat /data/.jwt_passphrase)"

export JWT_SECRET_KEY=/data/jwt/private.pem
export JWT_PUBLIC_KEY=/data/jwt/public.pem
export DATABASE_URL="sqlite:////data/app.db"

mkdir -p /data/jwt
cd /var/www/html

echo "[entrypoint] Ensuring JWT keypair..."
php bin/console lexik:jwt:generate-keypair --skip-if-exists --no-interaction

echo "[entrypoint] Running database migrations..."
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

echo "[entrypoint] Warming application cache..."
php bin/console cache:warmup

# php-fpm workers run as www-data; they need to write the Symfony cache/log
# and the SQLite file (plus its WAL/journal siblings, hence the directory).
chown -R www-data:www-data var /data

echo "[entrypoint] Starting php-fpm + nginx..."
exec supervisord -c /etc/supervisord.conf
