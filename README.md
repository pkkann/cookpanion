# Cookpanion 🍳🤖

A multi-user kitchen app: track your **ingredients**, keep an inventory of **what's in your kitchen**,
store **recipes** built from those ingredients, and let **Claude** suggest recipes from what you have
(optionally allowing a few extra items to buy).

- **Backend:** Symfony 7.4 (PHP 8.4) REST API — JWT auth, Doctrine ORM, [Symfony AI Bundle](https://symfony.com/doc/current/ai/bundles/ai-bundle.html) → Anthropic Claude
- **Frontend:** React + TypeScript + Vite + MUI single-page app
- **Database:** SQLite (a single file — no database server)
- **Runs in Docker** for development, and ships as a **Home Assistant addon** for "production".

Data is scoped to a **household/team**: everyone in a household shares the same ingredients,
kitchen stock and recipes.

---

## Development quick start

```bash
# 1. Configure environment
cp .env.example .env
#    (optional) edit .env — Claude key and Google client id can be added later

# 2. (First run only) seed demo data
#    set LOAD_FIXTURES=true in .env, then start; set it back to false afterwards

# 3. Build & run
docker compose up -d --build
```

Then open **http://localhost:5173** (nginx serves the SPA with hot reload and
proxies `/api` to the backend — one origin, no CORS in practice).

The PHP container automatically installs Composer dependencies, generates the JWT keypair,
and runs database migrations on startup. The SQLite database lives at
`backend/var/data/app.db` on your machine, so it survives rebuilds and
`docker compose down`; delete the file for a fresh start.

To browse the database (Adminer, phpMyAdmin-style): set `DB_ADMIN_PASSWORD` in
`.env`, `docker compose up -d`, then open http://localhost:8100 and log in with
that password. Empty password = Adminer disabled.

Sign in with **email + password** (register in the app; demo fixtures create
`demo@recipe.ai` / `demo1234`) or with **Google**: set `GOOGLE_CLIENT_ID` in
`.env` (a Google OAuth *Web* client id with `http://localhost:5173` as an
authorized JavaScript origin). The SPA fetches it at runtime from
`GET /api/config` — nothing is baked into the build. Both methods share the
same account, linked by email; Google-created accounts can set a password
under **Settings → Password**.

---

## Home Assistant addon

The repo doubles as a Home Assistant addon repository (`repository.yaml` +
`cookpanion/`). The addon is a single container: nginx serves the prebuilt SPA
and proxies `/api` to php-fpm; all state (SQLite db, JWT keys, generated
secrets) lives on the addon's `/data` volume, so it's covered by HA backups
and survives restarts/updates.

**Install:**

1. Push this repo to GitHub (it must be **public** — HA clones addon
   repositories anonymously). The GitHub username is wired into
   `repository.yaml` and `cookpanion/config.yaml` (`image:` + `url:`).
2. Publish the image: tag a release (`git tag v1.0.0 && git push --tags`) — the
   `addon-image.yml` workflow builds a multi-arch image to
   `ghcr.io/pkkann/cookpanion`. Make that GHCR package **public** once
   (GitHub → Packages → cookpanion → settings).
3. In HA: **Settings → Add-ons → Add-on store → ⋮ → Repositories** → add the
   GitHub repo URL → install **Cookpanion** → set options (Google client id,
   Anthropic key) → start.
4. Open `http://<ha-host>:8099`.

**Releasing an update:** bump `version:` in `cookpanion/config.yaml`, commit,
tag `v<same version>`, push — HA offers the update once the image is built.

See `cookpanion/DOCS.md` for addon options and the Google/HTTPS setup notes
(Google sign-in and PWA install require an HTTPS origin).

**Test the addon image locally without HA:**

```bash
docker build -f docker/addon/Dockerfile -t cookpanion-addon .
docker run --rm -p 8099:80 -v /some/data-dir:/data \
  -e GOOGLE_CLIENT_ID=... -e ANTHROPIC_API_KEY=... cookpanion-addon
```

---

## Adding your Claude API key (do this whenever you're ready)

The app runs fine **without** a key — the AI Suggestions page simply shows a friendly
"AI not configured" message (the API returns HTTP 503).

To enable AI recipe generation:

1. Put your key in `.env` (dev) or the addon's `anthropic_api_key` option (HA):
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   # optional — any model in the Anthropic bridge catalog:
   AI_MODEL=claude-sonnet-4-5   # or claude-haiku-4-5, claude-opus-4-8, ...
   ```
2. Recreate the backend so it picks up the env var:
   ```bash
   docker compose up -d backend
   ```
3. Go to **AI Suggestions** in the app and generate recipes.

No code changes are needed — the key is wired through `config/packages/ai.yaml`
(`api_key: '%env(ANTHROPIC_API_KEY)%'`).

---

## How the AI feature works

On the **AI Suggestions** page you choose:
- **Mode** — use *only what's in your kitchen* (`kitchen`) or *all your ingredients* (`all`)
- **Max to buy** — how many extra ingredients Claude may add to a shopping list
- **Preferences** — free text (e.g. "vegetarian, quick, kid-friendly")

The backend builds a prompt from your household's ingredient/stock list and asks the `recipe`
agent (Claude) to return structured suggestions. Each suggestion shows what it **uses**, what to
**buy**, and can be **saved as a real recipe** with one click.

---

## Common commands

```bash
docker compose up -d --build        # build + start everything
docker compose logs -f backend      # backend logs
docker compose logs -f frontend     # Vite dev server logs
docker compose down                 # stop (SQLite file stays on disk)
rm backend/var/data/app.db*         # wipe the database

# Re-seed demo data (WARNING: purges current data)
LOAD_FIXTURES=true docker compose up -d --force-recreate backend
# then set LOAD_FIXTURES back to false

# Run a Symfony console command
docker compose exec backend php bin/console <command>

# After changing entities: generate + apply a migration
docker compose exec backend php bin/console doctrine:migrations:diff
docker compose exec backend php bin/console doctrine:migrations:migrate
```

---

## Project layout

```
recipe_ai/
├── backend/            # Symfony 7.4 API (entities, controllers, AI service, fixtures)
│   └── migrations/     # Doctrine migrations (SQLite-flavored)
├── frontend/           # React + Vite + MUI SPA
├── docker/
│   ├── php/            # dev PHP 8.4-FPM image + entrypoint (install/keygen/migrate)
│   ├── nginx/          # dev front door: SPA (Vite HMR) + /api on :5173
│   └── addon/          # production image for the HA addon (nginx + php-fpm + supervisord)
├── cookpanion/         # Home Assistant addon metadata (config.yaml, DOCS.md)
├── repository.yaml     # makes this repo installable as an HA addon repository
├── docker-compose.yml  # dev stack
├── .env.example        # copy to .env
└── API_CONTRACT.md     # the shared HTTP contract between backend & frontend
```

See `API_CONTRACT.md` for the full endpoint reference.

---

## Notes

- The `symfony/ai-*` packages are `0.10.x` (experimental). Config is pinned to that version.
- JWT keys are generated inside the container using `JWT_PASSPHRASE` from `.env` — they are not
  committed and are regenerated if missing. The addon persists them (plus generated
  `APP_SECRET`/`JWT_PASSPHRASE`) in `/data`, so sessions survive restarts.
- Schema changes go through Doctrine migrations (`doctrine:migrations:diff`);
  the entrypoints run `doctrine:migrations:migrate` on boot.
- SQLite runs with WAL + busy-timeout + foreign keys via
  `backend/src/Doctrine/SqlitePragmaMiddleware.php`.
