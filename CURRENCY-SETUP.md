# Currency display

`assets/data/services.json` controls the currency shown on service buttons.

- `displayCurrency: "USD"` -> English displays `$25`.
- `displayCurrency: "QAR"` -> English displays `QAR 91`.
- In Arabic, QAR displays as `91 ريال`.

QAR prices can be entered directly per service under `prices.QAR`. If a QAR
price is null, the page temporarily calculates it from the USD price using
`currencyConversion.QAR` (currently 3.64). This rate is configurable and can
be removed once real QAR prices are entered.

The currency label is language-aware:
- English QAR: `QAR`
- Arabic QAR: `ريال`

No service duration has been added yet; `durationMinutes` remains null.
