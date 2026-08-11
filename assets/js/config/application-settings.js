(function () {
  'use strict';

  var FALLBACK_PATH = 'assets/data/applicationsetting.json';

  function parseValue(value) {
    if (value && typeof value === 'object') return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (e) { return value; }
    }
    return value;
  }

  function loadFallbackSettings() {
    return fetch(FALLBACK_PATH, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Could not load ' + FALLBACK_PATH);
        }
        return response.json();
      })
      .then(normalizeSettings);
  }

  function normalizeSettings(raw) {
    raw = raw || {};

    var currencyOptions =
      raw.currency_options ||
      raw.currencyOptions ||
      {};

    var displayCurrency =
      raw.display_currency ||
      raw.displayCurrency ||
      'USD';

    var defaultLanguage =
      raw.default_language ||
      raw.defaultLanguage ||
      'en';

    return {
      display_currency: String(displayCurrency).toUpperCase(),
      currency_options: currencyOptions,
      default_language: String(defaultLanguage).toLowerCase()
    };
  }

  async function loadFromSupabase(fallback) {
    if (!window.salonSupabase) {
      return fallback;
    }

    var result = await window.salonSupabase
      .from('application_settings')
      .select('setting_key, setting_value')
      .eq('active', true);

    if (result.error) {
      throw result.error;
    }

    // The JSON file remains the local baseline. Supabase values override it.
    var settings = Object.assign({}, fallback);

    (result.data || []).forEach(function (row) {
      settings[row.setting_key] = parseValue(row.setting_value);
    });

    return normalizeSettings(settings);
  }

  window.applicationSettingsReady = (async function () {
    var fallback;

    try {
      fallback = await loadFallbackSettings();
    } catch (fallbackError) {
      // Keep a last-resort in-memory default so a missing fallback file
      // does not prevent the website from loading.
      console.warn(
        '[Application settings] Could not load applicationsetting.json; using built-in defaults.',
        fallbackError
      );

      fallback = normalizeSettings({
        displayCurrency: 'USD',
        currencyOptions: {
          USD: { en: '$', ar: '$' },
          QAR: { en: 'QAR', ar: 'ريال' }
        },
        defaultLanguage: 'en'
      });
    }

    try {
      var settings = await loadFromSupabase(fallback);
      console.info('[Application settings] Loaded from Supabase.');
      return settings;
    } catch (error) {
      console.warn(
        '[Application settings] Supabase unavailable; using applicationsetting.json fallback.',
        error
      );
      return fallback;
    }
  })();

  window.getApplicationSettings = function () {
    return window.applicationSettingsReady;
  };
})();
