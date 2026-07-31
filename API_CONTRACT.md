# Cookpanion — API Contract

Shared contract between the Symfony backend (`backend/`) and the React SPA (`frontend/`).
**Both sides MUST conform to this. Do not change it unilaterally.**

- Base URL (from browser): `/api` (the SPA and API are served on one origin behind nginx).
- All requests/responses are JSON (`Content-Type: application/json`).
- Auth: JWT Bearer. Send `Authorization: Bearer <token>` on every endpoint except `GET /config`, `POST /register`, `POST /login`, `POST /auth/google`, and `POST /token/refresh`.
- The access `token` is short-lived (~1h). Auth responses also return a long-lived `refresh_token` (~30d); when a request returns `401`, exchange the refresh token at `POST /token/refresh` for a new pair and replay the request.
- Errors use standard HTTP status codes with body: `{ "error": "message", "details"?: {...} }`.
- All domain data is scoped to the authenticated user's **household**. A user only ever sees their household's recipes and meal plan.

## Data model (conceptual)

- **User**: id, email, name, household (belongs to one household)
- **Household**: id, name, language (`"en"` | `"da"`, default `"en"` — the content language for AI-generated/imported recipes & ingredients), members[]
- **Ingredient**: id, name, defaultUnit (e.g. "g", "ml", "pcs") — household-scoped **internal vocabulary** for recipe lines; created implicitly, never managed directly
- **Recipe**: id, title, description, instructions (markdown/plain text), servings (int), prepTimeMinutes (int|null), cookTimeMinutes (int|null), author (User), createdAt — scoped to household
- **RecipeIngredient**: ingredientId, quantity (float), unit — embedded in a Recipe

## Runtime config

### GET /config
Public (no auth). Returns per-installation settings the prebuilt SPA cannot know at
build time: `{ "googleClientId": string, "allowRegistration": boolean, "aiEnabled": boolean }`.
`googleClientId` is empty when Google sign-in is not configured (the frontend hides
the button); `allowRegistration: false` hides the register UI; `aiEnabled: false`
(no `ANTHROPIC_API_KEY` on the server) hides all AI features — nav entries, the
`/suggestions` and `/import` pages, and AI buttons. The AI endpoints themselves
return `503` regardless.

## Auth

Two sign-in methods share the same accounts, linked by email:
- **Google** — `POST /auth/google` signs in and signs up (a verified Google email that
  matches an account logs into it; a new email creates a user + household).
- **Email + password** — `POST /register` creates an account, `POST /login` signs in.
  Google-created accounts have no usable password until one is set via `POST /me/password`.

### POST /register
Body: `{ "name": string, "email": string, "password": string }` (password ≥ 6 chars).
Creates a user plus an **unnamed** household (the frontend routes new users through the
onboarding step to name it — same as the Google flow). Returns `201` with
`{ "token": string, "refresh_token": string, "user": User }`.
- `400 { "error": "Validation failed", "details": {field: message} }` on invalid input.
- `403 { "error": "Registration is disabled." }` when the installation has closed
  registration (`ALLOW_REGISTRATION=false`). The same applies to a **first-time**
  Google sign-in on `POST /auth/google` (existing accounts still sign in).
- `409 { "error": "Email already registered" }` if the email exists (sign in instead —
  via password, or Google for Google-created accounts).

### POST /login
Body: `{ "email": string, "password": string }`.
Returns `200` with the same body as `/register`.
- `401 { "error": "Invalid credentials" }` — wrong email/password, including
  Google-created accounts that never set a password.

### POST /me/password
Authenticated. Body: `{ "password": string }` (≥ 6 chars). Sets or replaces the current
user's password (no current-password check — the JWT already proves identity, and
Google-created accounts couldn't provide one). Returns `204`.
- `400 { "error": "Validation failed", "details": { "password": message } }` if too short.

### POST /auth/google
Body: `{ "credential": string }` — the Google Identity Services ID token obtained by the
"Sign in with Google" button in the browser.
Verifies the token with Google (audience must match the server's `GOOGLE_CLIENT_ID`, email must be
verified), then signs in. A verified email matching an existing account logs into it (link by email,
`200`); a new email creates a user + household (`201`). Response body is the same as `/login`.
- `401 { "error": "Invalid Google credential" }` if the token is missing/invalid/unverified.
- `503 { "error": "Google sign-in is not configured." }` if `GOOGLE_CLIENT_ID` is unset.

### POST /token/refresh
Body: `{ "refresh_token": string }` — no `Authorization` header.
Returns `200`: `{ "token": string, "refresh_token": string }` (a new access token and a rotated
refresh token; the old refresh token is single-use and immediately invalidated).
- `401` if the refresh token is missing, expired, or already used/revoked.

### POST /logout
Body: `{ "refresh_token": string }`. Revokes the refresh token server-side. Idempotent — always
returns `204`, even for an unknown token. The access token is left to expire on its own.

### GET /me
Returns the current user: `{ "id", "email", "name", "household": { "id", "name", "inviteCode", "language" } }`

### PATCH /household
Updates the current user's household. Body may include `"name"` (non-empty) and/or `"language"` (`"en"` | `"da"`). `language` is the household **content language** — the language the AI writes generated and imported recipes/ingredients in. Returns `200` with the updated `User`. Unknown language → `400`.

## Ingredients  `/api/ingredients`

Ingredients exist **only** as the household's recipe-line vocabulary: the recipe
form's autocomplete lists them and creates missing ones on save (the AI flows do
the same). There is no ingredient-management UI, so only two endpoints exist.
Rows no longer referenced by any recipe are harmless and simply accumulate.

- `GET /ingredients` → `Ingredient[]`
- `POST /ingredients` body `{ "name", "defaultUnit"? }` → `201 Ingredient`

`Ingredient` shape: `{ "id": int, "name": string, "defaultUnit": string|null }`

## Recipes  `/api/recipes`

- `GET /recipes` → `Recipe[]`
- `POST /recipes` → `201 Recipe`
- `GET /recipes/{id}` → `Recipe`
- `PUT /recipes/{id}` → `Recipe`
- `DELETE /recipes/{id}` → `204`

Recipe request body:
```json
{
  "title": "string",
  "description": "string",
  "instructions": ["step one", "step two"],
  "servings": 4,
  "prepTimeMinutes": 15,                 // optional; int minutes or null to clear
  "cookTimeMinutes": 30,                 // optional; int minutes or null to clear
  "ingredients": [
    { "ingredientId": 1, "quantity": 200, "unit": "g" }
  ]
}
```

`prepTimeMinutes` / `cookTimeMinutes` are optional on write: omit to leave unchanged, send `null` (or `""`) to clear, any value is coerced to a non-negative integer.

`Recipe` response shape:
```json
{
  "id": 1,
  "title": "string",
  "description": "string",
  "instructions": ["step one", "step two"],
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "author": { "id": 1, "name": "string" },
  "createdAt": "2026-07-02T12:00:00+00:00",
  "ingredients": [
    { "ingredient": { "id": 1, "name": "Flour", "defaultUnit": "g" }, "quantity": 200, "unit": "g" }
  ]
}
```

## Meal plan  `/api/planned-meals`

A **PlannedMeal** assigns a recipe to a date with a servings count. There is no "plan" resource —
the collection of a household's planned meals *is* the plan.

- `GET /planned-meals` → `PlannedMeal[]` (ascending by date). Each embeds the **full** recipe so the
  SPA can aggregate a shopping list client-side.
- `POST /planned-meals` body `{ "recipeId": int, "date": "YYYY-MM-DD", "servings"?: int }` → `201 PlannedMeal`
  - `servings` defaults to the recipe's own servings when omitted; coerced to `>= 1`.
  - `date` must be a strict `YYYY-MM-DD` (else `400`); `recipeId` must resolve to a household recipe
    (else `404`).
- `PUT /planned-meals/{id}` body `{ "date"?: "YYYY-MM-DD", "servings"?: int }` → `PlannedMeal`
  (move a meal to another day / change its servings).
- `DELETE /planned-meals/{id}` → `204`

`PlannedMeal` shape:
```json
{
  "id": 1,
  "date": "2026-07-06",
  "servings": 6,
  "recipe": { "id": 1, "title": "…", "…": "full Recipe shape (incl. ingredients)" },
  "createdAt": "2026-07-03T12:00:00+00:00"
}
```

## AI recipe suggestions  `/api/ai/suggest-recipes`

`POST /ai/suggest-recipes`
Body (all optional):
```json
{
  "count": 3,                           // how many recipes to generate; clamped 1–8, default 3
  "servings": 2,                        // target servings each recipe is sized for; clamped 1–20, default 2
  "maxTimeMinutes": 30,                 // cap on prep + cook time per recipe; clamped 0–600, 0 = no limit
  "preferences": "vegetarian, quick"    // optional free text
}
```

Suggestions are driven by the given preferences plus **taste context**: the titles of the
household's most recent saved recipes (max 50) are sent to the model, which is instructed to
match their style without duplicating them. Works fine with zero saved recipes.

Response `200`:
```json
{
  "suggestions": [
    {
      "title": "string",
      "description": "string",
      "servings": 2,
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 30,
      "instructions": ["step one", "step two"],
      "ingredients": [ { "name": "Eggs", "quantity": 3, "unit": "pcs" } ]
    }
  ]
}
```

If `ANTHROPIC_API_KEY` is not configured, return `503` with
`{ "error": "AI is not configured. Add ANTHROPIC_API_KEY." }`
so the frontend can show a friendly message.

The frontend offers a "Save as recipe" action that POSTs a suggestion to `/api/recipes`
(mapping suggestion `ingredients` to existing ingredients by name and creating missing ones
first — backend `POST /recipes` accepts `ingredients` by `ingredientId`).

## AI recipe import  `/api/ai/import-recipe`

`POST /ai/import-recipe`
Body: `{ "url"?: string, "text"?: string, "image"?: string }` — provide one. Precedence when several are present: `text`, then `image`, then `url`.
- With `url`, the backend fetches the page (http/https only; localhost and private/reserved IPs are refused) and reduces it to text before extraction.
- With `image` (a base64 data URL, e.g. `data:image/jpeg;base64,…` — jpeg/png/webp/gif, ~7 MB max), the photo is sent to the vision model, which reads printed or handwritten text.
- The extracted recipe is written in the **household's content language** (`household.language`) — a source in another language is translated into it.

Response `200`:
```json
{
  "recipe": {
    "title": "string",
    "description": "string",
    "servings": 4,
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 30,
    "instructions": ["step one", "step two"],
    "ingredients": [ { "name": "Flour", "quantity": 200, "unit": "g" } ]
  }
}
```

`ingredients` are name-based (not ids); the frontend pre-fills the recipe form for review, matching names to existing ingredients and creating any missing ones on save.

Errors: `400` when no field is given, the URL is invalid/disallowed, or the image isn't a valid base64 image data URL; `503` when `ANTHROPIC_API_KEY` is unset; `502` when the URL can't be fetched or the AI call fails; `422` when no recipe could be extracted from the content.

## Conventions

- Backend port `8000` (nginx), frontend dev port `5173` (Vite).
- CORS: backend allows origin `http://localhost:5173` (see `CORS_ALLOW_ORIGIN`).
- Dates are ISO-8601 strings.
- IDs are integers.
