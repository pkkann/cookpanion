FROM php:8.4-fpm-alpine

# System deps + build deps for PHP extensions
RUN apk add --no-cache \
        git \
        unzip \
        bash \
        icu-dev \
        libzip-dev \
        oniguruma-dev \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && docker-php-ext-install -j"$(nproc)" \
        intl \
        zip \
        opcache \
    && apk del .build-deps

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

ENV COMPOSER_ALLOW_SUPERUSER=1

WORKDIR /var/www/html

# Entrypoint: install deps (if needed), generate JWT keys, run migrations, then start php-fpm
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm"]
