# Production image for the Cookpanion Home Assistant addon.
# Build context is the REPO ROOT:  docker build -f docker/addon/Dockerfile .

# --- Stage 1: build the SPA ---------------------------------------------------
# --platform=$BUILDPLATFORM: runs natively on the build host even when the
# target is another arch — the JS bundle is architecture-independent, and
# emulated npm/vite is 10x slower.
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: install backend dependencies ------------------------------------
# Native for the same reason: composer only writes PHP source files.
FROM --platform=$BUILDPLATFORM php:8.4-fpm-alpine AS backend
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1 APP_ENV=prod
WORKDIR /srv
COPY backend/ ./
# --no-scripts: Flex's cache:clear needs runtime env vars that only exist in the
# final container; the entrypoint warms the cache instead.
RUN composer install --no-dev --classmap-authoritative --no-scripts --no-interaction \
    && rm -rf var

# --- Stage 3: runtime (php-fpm + nginx under supervisord) ----------------------
FROM php:8.4-fpm-alpine
RUN apk add --no-cache nginx supervisor jq bash icu-dev libzip-dev \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && docker-php-ext-install -j"$(nproc)" intl zip opcache \
    && apk del .build-deps \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

# AI recipe import posts ~7 MB base64 images as JSON.
RUN { \
        echo 'post_max_size = 16M'; \
        echo 'upload_max_filesize = 16M'; \
        echo 'opcache.enable = 1'; \
        echo 'opcache.validate_timestamps = 0'; \
        echo 'opcache.memory_consumption = 128'; \
    } > "$PHP_INI_DIR/conf.d/zz-cookpanion.ini"

COPY --from=backend /srv /var/www/html
COPY --from=frontend /app/dist /var/www/spa
COPY docker/adminer /var/www/adminer
COPY docker/addon/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/addon/supervisord.conf /etc/supervisord.conf
COPY docker/addon/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /var/www/html/var

ENV APP_ENV=prod APP_DEBUG=0
WORKDIR /var/www/html
EXPOSE 80 8081
ENTRYPOINT ["/entrypoint.sh"]
