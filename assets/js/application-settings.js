(function () {
  'use strict';

  var fallback = {
    display_currency: 'USD',
    currency_options: {
      USD: { en: '$', ar: '$' },
      QAR: { en: 'QAR', ar: 'ريال' }
    },
    default_language: 'en'
  };

  function parseValue(value) {
    if (value && typeof value === 'object') return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (e) { return value; }
    }
    return value;
  }

  window.applicationSettingsReady = (async function () {
    if (!window.salonSupabase) return fallback;

    var result = await window.salonSupabase
      .from('application_settings')
      .select('setting_key, setting_value')
      .eq('active', true);

    if (result.error) throw result.error;

    var settings = Object.assign({}, fallback);
    (result.data || []).forEach(function (row) {
      settings[row.setting_key] = parseValue(row.setting_value);
    });

    settings.display_currency = String(
      settings.display_currency || settings.displayCurrency || 'USD'
    ).toUpperCase();

    settings.currency_options =
      settings.currency_options || settings.currencyOptions || fallback.currency_options;

    settings.default_language =
      String(settings.default_language || settings.defaultLanguage || 'en').toLowerCase();

    return settings;
  })().catch(function (error) {
    console.warn('[Application settings] Supabase settings unavailable; using safe defaults.', error);
    return fallback;
  });

  window.getApplicationSettings = function () {
    return window.applicationSettingsReady;
  };
})();
