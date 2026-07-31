# Changelog

## 1.4.2

- Revert the Adminer ingress panel from 1.4.0: with ingress enabled, Home
  Assistant replaces the "Open Web UI" button with the ingress page, so the
  button no longer opened the app. The button now opens the app again;
  Adminer remains on port 8100.

## 1.4.1

- Much faster image builds: the frontend and composer build stages now run
  natively instead of under QEMU emulation. No functional changes.

## 1.4.0

- Adminer is now available as a Home Assistant sidebar panel ("Cookpanion DB")
  via ingress — enable "Show in sidebar" on the addon page. HA authentication
  (admin only) applies in front of the usual `db_admin_password` prompt. The
  direct port 8100 remains available and optional.

## 1.3.0

- When no Anthropic API key is configured, AI features are now hidden from the
  app entirely (nav entries, suggestion/import pages, AI buttons) instead of
  showing "not configured" errors. The rest of the app works as normal.

## 1.2.0

- New `allow_registration` option: turn off account creation (password
  registration and first-time Google sign-ins) once your household is set up —
  recommended before exposing the app to the internet.
- Bundled Adminer database browser on port 8100. Set `db_admin_password` to
  enable it; leave empty to keep it disabled. LAN use only.

## 1.1.0

- Add email/password sign-in alongside Google. Register directly in the app, or
  set a password under Settings → Password for a Google-created account. Works
  over plain HTTP — no Google/HTTPS setup required.

## 1.0.0

- Initial release: recipes, kitchen stock, meal planning, AI recipe import and
  suggestions, Google sign-in, multi-language (English/Danish).
