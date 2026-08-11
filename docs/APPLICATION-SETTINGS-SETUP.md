# Application Settings

The website now reads the display currency and default language from `public.application_settings`.

Run `supabase/sql/APPLICATION-SETTINGS-SEED.sql` once in Supabase.

Expected settings:
- `display_currency` = `"USD"`
- `currency_options` = `{"USD":{"en":"$","ar":"$"},"QAR":{"en":"QAR","ar":"ريال"}}`
- `default_language` = `"en"`

The user's selected language remains in browser `localStorage` (`siteLang`). The database `default_language` is used only when the visitor has no saved language preference.


## CRM access / RLS

The CRM saves settings through the authenticated Supabase client, so `application_settings`
must allow authenticated administrators to insert/update settings. Run
`supabase/sql/application-settings-rls.sql` if the CRM shows:

`new row violates row-level security policy for table "application_settings"`.

The public website still has read-only access to active settings.

## Project structure

- `assets/js/config/application-settings.js` — public website application-settings loader.
- `assets/js/crm/admin-crm.js` — CRM application logic.
- `assets/css/admin-crm.css` — CRM styles, including Application Settings.
- `supabase/sql/` — SQL setup, seed and RLS scripts.
- `docs/` — project/setup notes.


## Local fallback

The public website also includes:

- `assets/data/applicationsetting.json` — local fallback for display currency, currency labels and default language.
- `assets/js/config/application-settings.js` — loads the JSON baseline first, then overlays active Supabase settings. If Supabase is unavailable, the JSON file is returned automatically.

Services and durations are read from the Supabase `service_categories` and `services` tables first. If Supabase is unavailable, the website falls back to `assets/data/services.json`.
