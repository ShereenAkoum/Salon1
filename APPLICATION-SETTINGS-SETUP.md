# Application Settings

The website now reads the display currency and default language from `public.application_settings`.

Run `APPLICATION-SETTINGS-SEED.sql` once in Supabase.

Expected settings:
- `display_currency` = `"USD"`
- `currency_options` = `{"USD":{"en":"$","ar":"$"},"QAR":{"en":"QAR","ar":"ريال"}}`
- `default_language` = `"en"`

The user's selected language remains in browser `localStorage` (`siteLang`). The database `default_language` is used only when the visitor has no saved language preference.
