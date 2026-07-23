# Cookpanion — API Contract

Shared contract between the Symfony backend (`backend/`) and the React SPA (`frontend/`).
**Both sides MUST conform to this. Do not change it unilaterally.**

- Base URL (from browser): `/api` (the SPA and API are served on one origin behind nginx).
- All requests/responses are JSON (`Content-Type: application/json`).
- Auth: JWT Bearer. Send `Authorization: Bearer <token>` on every endpoint except `POST /register`, `POST /login`, `POST /auth/google`, and `POST /token/refresh`.
- The access `token` is short-lived (~1h). Auth responses also return a long-lived `refresh_token` (~30d); when a request returns `401`, exchange the refresh token at `POST /token/refresh` for a new pair and replay the request.
- Errors use standard HTTP status codes with body: `{ "error": "message", "details"?: {...} }`.
- All domain data is scoped to the authenticated user's **household**. A user only ever sees their household's ingredients, stock, and recipes.

## Data model (conceptual)

- **User**: id, email, name, household (belongs to one household)
- **Household**: id, name, language (`"en"` | `"da"`, default `"en"` — the content language for AI-generated/imported recipes & ingredients), members[]
- **Ingredient**: id, name, defaultUnit (e.g. "g", "ml", "pcs") — scoped to household
- **StockItem** (what's in the kitchen): id, ingredient, quantity (float), unit — scoped to household; one row per ingredient
- **Recipe**: id, title, description, instructions (markdown/plain text), servings (int), prepTimeMinutes (int|null), cookTimeMinutes (int|null), author (User), createdAt — scoped to household
- **RecipeIngredient**: ingredientId, quantity (float), unit — embedded in a Recipe

## Auth

Sign-in is **Google-only**. `POST /auth/google` is the single entry point for both
signing in and signing up (a verified Google email that matches an account logs in;
a new email creates a user + household). There are no email/password endpoints.

### POST /auth/google
Body: `{ "credential": string }` — the Google Identity Services ID token obtained by the
"Sign in with Google" button in the browser.
Verifies the token with Google (audience must match the server's `GOOGLE_CLIENT_ID`, email must be
verified), then signs in. A verified email matching an existing account logs into it (link by email,
`200`); a new email creates a user + household (`201`). Response body is the same as login/register:
`{ "token": string, "refresh_token": string, "user": User }`.
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

- `GET /ingredients` → `Ingredient[]`
- `POST /ingredients` body `{ "name", "defaultUnit"? }` → `201 Ingredient`
- `GET /ingredients/{id}` → `Ingredient`
- `PUT /ingredients/{id}` body `{ "name", "defaultUnit"? }` → `Ingredient`
- `DELETE /ingredients/{id}` → `204`

`Ingredient` shape: `{ "id": int, "name": string, "defaultUnit": string|null }`

## Kitchen stock  `/api/stock`

- `GET /stock` → `StockItem[]`
- `POST /stock` body `{ "ingredientId": int, "quantity": float, "unit": string }` → `201 StockItem`
- `PUT /stock/{id}` body `{ "quantity": float, "unit": string }` → `StockItem`, or `204` if the update leaves quantity ≤ 0 (the row is deleted — a stock row is never kept at zero).
- `DELETE /stock/{id}` → `204`

`StockItem` shape: `{ "id": int, "ingredient": Ingredient, "quantity": float, "unit": string }`

## Recipes  `/api/recipes`

- `GET /recipes` → `Recipe[]`
- `POST /recipes` → `201 Recipe`
- `GET /recipes/{id}` → `Recipe`
- `PUT /recipes/{id}` → `Recipe`
- `DELETE /recipes/{id}` → `204`
- `POST /recipes/{id}/cook` body `{ "items": [ { "ingredientId": int, "quantity": number } ] }` → `StockItem[]` (updated stock)
  - Deducts each amount from the household's matching stock row in one transaction. A row depleted to 0 (or below) is removed from the kitchen. Ingredients with no stock row are skipped. Returns the full updated stock list.
  - Side effect: also removes the recipe's **next upcoming** planned meal (soonest date ≥ today) from the plan, if any. Only that one occurrence is removed; other planned days for the recipe are kept.

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

The "what to buy for the plan" shopping list is computed **client-side** from planned meals (from
today onward) minus current stock — there is no server-side aggregation endpoint.

## AI recipe suggestions  `/api/ai/suggest-recipes`

`POST /ai/suggest-recipes`
Body:
```json
{
  "mode": "kitchen" | "all" | "surprise", // "kitchen" = only current stock; "all" = all household ingredients; "surprise" = ignore the kitchen, propose from scratch
  "count": 3,                           // how many recipes to generate; clamped 1–8, default 3
  "maxToBuy": 3,                        // (kitchen/all) max extra ingredients allowed to buy (0 = strict)
  "numIngredients": 6,                  // (surprise) target ingredients per recipe; clamped 2–20, default 6
  "servings": 2,                        // target servings each recipe is sized for; clamped 1–20, default 2
  "maxTimeMinutes": 30,                 // cap on prep + cook time per recipe; clamped 0–600, 0 = no limit
  "preferences": "vegetarian, quick"   // optional free text
}
```

In `surprise` mode the kitchen is ignored and there is no empty-result short-circuit; every ingredient a recipe needs is returned in `usesIngredients` and `toBuy` is empty.

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
      "usesIngredients": [ { "name": "Eggs", "quantity": 3, "unit": "pcs" } ],
      "toBuy": [ { "name": "Milk", "quantity": 200, "unit": "ml" } ]
    }
  ]
}
```

If `ANTHROPIC_API_KEY` is not configured, return `503` with
`{ "error": "AI is not configured. Add ANTHROPIC_API_KEY." }`
so the frontend can show a friendly message.

The frontend offers a "Save as recipe" action that POSTs a suggestion to `/api/recipes`
(mapping suggestion `usesIngredients` to existing ingredients by name, creating missing ones first is a frontend/back convenience — backend `POST /recipes` accepts `ingredients` by `ingredientId`).

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
