# Recipe AI 🍳🤖

A multi-user kitchen app: track your **ingredients**, keep an inventory of **what's in your kitchen**,
store **recipes** built from those ingredients, and let **Claude** suggest recipes from what you have
(optionally allowing a few extra items to buy).

- **Backend:** Symfony 7.4 (PHP 8.4) REST API — JWT auth, Doctrine ORM, [Symfony AI Bundle](https://symfony.com/doc/current/ai/bundles/ai-bundle.html) → Anthropic Claude
- **Frontend:** React + TypeScript + Vite + MUI single-page app
- **Database:** MariaDB 11.4
- **Everything runs in Docker.**

Data is scoped to a **household/team**: everyone in a household shares the same ingredients,
kitchen stock and recipes.

---

## Quick start

```bash
# 1. Configure environment
cp .env.example .env
#    (optional) edit .env — you can add your Claude key now or later

# 2. (First run only) seed demo data
#    set LOAD_FIXTURES=true in .env, then start; set it back to false afterwards

# 3. Build & run
docker compose up -d --build
```

Then open:

| Service        | URL                          |
|----------------|------------------------------|
| **Frontend**   | http://localhost:5173        |
| **Backend API**| http://localhost:8000/api    |
| MariaDB        | localhost:3307 (user `recipe` / `recipe`) |

The PHP container automatically installs Composer dependencies, generates the JWT keypair,
and syncs the database schema on startup.

### Demo login (if you seeded fixtures)

- **Email:** `demo@recipe.ai`
- **Password:** `demo1234`
- Household "Demo Kitchen" with sample ingredients, kitchen stock, and recipes.

Otherwise just **Register** a new account — it creates your user and a new household.

---

## Adding your Claude API key (do this whenever you're ready)

The app runs fine **without** a key — the AI Suggestions page simply shows a friendly
"AI not configured" message (the API returns HTTP 503).

To enable AI recipe generation:

1. Put your key in `.env`:
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
docker compose down                 # stop (keeps the DB volume)
docker compose down -v              # stop + wipe the database

# Re-seed demo data (WARNING: purges current data)
LOAD_FIXTURES=true docker compose up -d --force-recreate backend
# then set LOAD_FIXTURES back to false

# Run a Symfony console command
docker compose exec backend php bin/console <command>
```

---

## Project layout

```
recipe_ai/
├── backend/            # Symfony 7.4 API (entities, controllers, AI service, fixtures)
├── frontend/           # React + Vite + MUI SPA
├── docker/
│   ├── php/            # PHP 8.4-FPM image + entrypoint (install/keygen/schema)
│   └── nginx/          # serves the Symfony public/ dir on :8000
├── docker-compose.yml
├── .env.example        # copy to .env
└── API_CONTRACT.md     # the shared HTTP contract between backend & frontend
```

See `API_CONTRACT.md` for the full endpoint reference.

---

## Notes

- The `symfony/ai-*` packages are `0.10.x` (experimental). Config is pinned to that version.
- JWT keys are generated inside the container using `JWT_PASSPHRASE` from `.env` — they are not
  committed and are regenerated if missing.
- Database schema is applied via `doctrine:schema:update` on boot (no migration files yet).
  For production, generate migrations with `doctrine:migrations:diff`.
