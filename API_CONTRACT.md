# Cookpanion — API Contract

Shared contract between the Symfony backend (`backend/`) and the React SPA (`frontend/`).
**Both sides MUST conform to this. Do not change it unilaterally.**

- Base URL (from browser): `http://localhost:8000/api`
- All requests/responses are JSON (`Content-Type: application/json`).
- Auth: JWT Bearer. Send `Authorization: Bearer <token>` on every endpoint except `POST /register` and `POST /login`.
- Errors use standard HTTP status codes with body: `{ "error": "message", "details"?: {...} }`.
- All domain data is scoped to the authenticated user's **household**. A user only ever sees their household's ingredients, stock, and recipes.

## Data model (conceptual)

- **User**: id, email, name, locale (`"en"` | `"da"`, default `"en"`), household (belongs to one household)
- **Household**: id, name, members[]
- **Ingredient**: id, name, category (nullable), defaultUnit (e.g. "g", "ml", "pcs") — scoped to household
- **StockItem** (what's in the kitchen): id, ingredient, quantity (float), unit — scoped to household; one row per ingredient
- **Recipe**: id, title, description, instructions (markdown/plain text), servings (int), author (User), createdAt — scoped to household
- **RecipeIngredient**: ingredientId, quantity (float), unit — embedded in a Recipe

## Auth

### POST /register
Body: `{ "email": string, "password": string, "name": string, "householdName": string }`
Creates a user + a new household they own. Returns `201`:
`{ "token": string, "user": User }`

### POST /login
Body: `{ "email": string, "password": string }`
Returns `200`: `{ "token": string, "user": User }`
(Backend may implement login via `json_login`; response includes token + user.)

### GET /me
Returns the current user: `{ "id", "email", "name", "locale", "household": { "id", "name" } }`

### PATCH /me
Updates the authenticated user's preferences. Body: `{ "locale": "en" | "da" }`
Returns `200` with the updated `User`. An unsupported locale returns `400`
`{ "error": "Unsupported locale", "details": { "locale": "..." } }`.

## Ingredients  `/api/ingredients`

- `GET /ingredients` → `Ingredient[]`
- `POST /ingredients` body `{ "name", "category"?, "defaultUnit"? }` → `201 Ingredient`
  - When `category` is omitted or blank, it is assigned automatically by AI from the name (falls back to `null` when AI is unavailable).
- `GET /ingredients/{id}` → `Ingredient`
- `PUT /ingredients/{id}` body `{ "name", "category"?, "defaultUnit"? }` → `Ingredient`
- `DELETE /ingredients/{id}` → `204`

`Ingredient` shape: `{ "id": int, "name": string, "category": string|null, "defaultUnit": string|null }`

## Kitchen stock  `/api/stock`

- `GET /stock` → `StockItem[]`
- `POST /stock` body `{ "ingredientId": int, "quantity": float, "unit": string }` → `201 StockItem`
- `PUT /stock/{id}` body `{ "quantity": float, "unit": string }` → `StockItem`
- `DELETE /stock/{id}` → `204`

`StockItem` shape: `{ "id": int, "ingredient": Ingredient, "quantity": float, "unit": string }`

## Recipes  `/api/recipes`

- `GET /recipes` → `Recipe[]`
- `POST /recipes` → `201 Recipe`
- `GET /recipes/{id}` → `Recipe`
- `PUT /recipes/{id}` → `Recipe`
- `DELETE /recipes/{id}` → `204`
- `POST /recipes/{id}/cook` body `{ "items": [ { "ingredientId": int, "quantity": number } ] }` → `StockItem[]` (updated stock)
  - Deducts each amount from the household's matching stock row in one transaction. Quantities are floored at 0 (never negative); rows that reach 0 are kept. Ingredients with no stock row are skipped. Returns the full updated stock list.

Recipe request body:
```json
{
  "title": "string",
  "description": "string",
  "instructions": ["step one", "step two"],
  "servings": 4,
  "ingredients": [
    { "ingredientId": 1, "quantity": 200, "unit": "g" }
  ]
}
```

`Recipe` response shape:
```json
{
  "id": 1,
  "title": "string",
  "description": "string",
  "instructions": ["step one", "step two"],
  "servings": 4,
  "author": { "id": 1, "name": "string" },
  "createdAt": "2026-07-02T12:00:00+00:00",
  "ingredients": [
    { "ingredient": { "id": 1, "name": "Flour", "category": null, "defaultUnit": "g" }, "quantity": 200, "unit": "g" }
  ]
}
```

## AI recipe suggestions  `/api/ai/suggest-recipes`

`POST /ai/suggest-recipes`
Body:
```json
{
  "mode": "kitchen" | "all" | "surprise", // "kitchen" = only current stock; "all" = all household ingredients; "surprise" = ignore the kitchen, propose from scratch
  "count": 3,                           // how many recipes to generate; clamped 1–8, default 3
  "maxToBuy": 3,                        // (kitchen/all) max extra ingredients allowed to buy (0 = strict)
  "numIngredients": 6,                  // (surprise) target ingredients per recipe; clamped 2–20, default 6
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
      "instructions": "string",
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

## Conventions

- Backend port `8000` (nginx), frontend dev port `5173` (Vite).
- CORS: backend allows origin `http://localhost:5173` (see `CORS_ALLOW_ORIGIN`).
- Dates are ISO-8601 strings.
- IDs are integers.
