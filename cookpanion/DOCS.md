# Cookpanion

Plan meals, track your kitchen stock, and let AI suggest recipes with what you
already have.

## Installation

1. Add this repository under **Settings → Add-ons → Add-on store → ⋮ → Repositories**.
2. Install **Cookpanion** and start it.
3. Open `http://<your-home-assistant-host>:8099`.

## Options

| Option | Required | Description |
|---|---|---|
| `google_client_id` | for sign-in | Google OAuth **Web** client ID used by "Sign in with Google". Public value, no secret. Empty = sign-in disabled. |
| `anthropic_api_key` | for AI features | Anthropic API key. Empty = AI endpoints return 503; the rest of the app keeps working. |
| `ai_model` | no | Anthropic model ID (default `claude-sonnet-4-5`). |

## Setting up Google Sign-In

Sign-in is Google-only, so this is required to actually use the app:

1. Create an OAuth **Web application** client in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add the exact origin you use to open the app (e.g.
   `https://cookpanion.example.duckdns.org`) under **Authorized JavaScript origins**.
3. Paste the client ID into the `google_client_id` option and restart the addon.

> **HTTPS is effectively required.** Google Identity Services rejects plain
> `http://` origins other than `localhost`, and PWA installation (service
> workers) also needs a secure context. Put the addon behind HTTPS — for
> example with the Nginx Proxy Manager addon, a reverse proxy, or a DuckDNS +
> Let's Encrypt setup — and use that HTTPS origin in Google Console.

## Data & backups

Everything lives in the addon's `/data` volume and is included in normal Home
Assistant backups:

- `app.db` — the SQLite database (all recipes, stock, meal plans).
- `jwt/` and the generated secrets — keeping these means users stay signed in
  across addon restarts and updates.

## Port

The web UI listens on host port **8099** by default (configurable on the
addon's Configuration tab). There is no ingress; the app is designed to be
used directly (including as a PWA on your phone).
