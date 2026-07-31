<?php

/**
 * Password-gated Adminer wrapper for browsing the Cookpanion SQLite database.
 *
 * Env contract (set by docker-compose in dev, by the addon entrypoint in HA):
 *   SQLITE_DB_PATH     absolute path of the SQLite database file
 *   DB_ADMIN_PASSWORD  master password; EMPTY = nobody can log in (disabled)
 *
 * Served on its own port (dev 8100, addon 8100) — never exposed through the
 * main app port or a public tunnel hostname.
 */

function adminer_object()
{
    class CookpanionAdminer extends Adminer\Adminer
    {
        public function name(): string
        {
            return 'Cookpanion DB';
        }

        /** Pin every connection to our one database file. */
        public function database(): string
        {
            return (string) getenv('SQLITE_DB_PATH');
        }

        /**
         * The SQLite driver refuses to connect when a password is supplied
         * (defense against passwordless setups). Hand it empty credentials;
         * the real password check happens in login() below.
         */
        public function credentials(): array
        {
            return ['', '', ''];
        }

        public function login($login, $password)
        {
            $expected = (string) getenv('DB_ADMIN_PASSWORD');
            if ('' === $expected || !hash_equals($expected, (string) $password)) {
                return false;
            }

            // SQLite "databases" are file paths — refuse anything but ours, so
            // a crafted URL can't open or create other files as www-data.
            $db = (string) ($_GET['db'] ?? '');

            return '' === $db || $db === $this->database();
        }

        /** Only a password field; driver/server/db are fixed hidden values. */
        public function loginForm(): void
        {
            $db = htmlspecialchars($this->database(), ENT_QUOTES);
            echo "<input type='hidden' name='auth[driver]' value='sqlite'>";
            echo "<input type='hidden' name='auth[server]' value=''>";
            echo "<input type='hidden' name='auth[username]' value=''>";
            echo "<input type='hidden' name='auth[db]' value='{$db}'>";
            echo "<table class='layout'>";
            echo "<tr><th>Password<td><input type='password' name='auth[password]' autofocus>";
            echo "</table>";
            echo "<p><input type='submit' value='Log in'>";
        }
    }

    return new CookpanionAdminer();
}

include __DIR__ . '/adminer.php';
