# Currency display

The website reads display currency and currency labels from
`public.application_settings`.

The local fallback file is:
`assets/data/applicationsetting.json`

Expected values:

- `displayCurrency: "USD"` -> English displays `$25`.
- `displayCurrency: "QAR"` -> English displays `QAR` and Arabic displays `ريال`.

Currency labels are language-aware:
- English USD: `$`
- English QAR: `QAR`
- Arabic QAR: `ريال`

The public service catalogue is read from Supabase:
`service_categories` + `services`.

`services.json` is retained as the service-catalogue fallback. Currency defaults and labels are owned by `assets/data/applicationsetting.json` and Supabase `application_settings`; `services.json` does not contain application-level currency settings.
