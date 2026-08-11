(function () {
  'use strict';

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

  async function loadFromSupabase() {
    if (!window.salonSupabase) {
      throw new Error('Supabase client is not available.');
    }

    var result = await window.salonSupabase
      .from('application_settings')
      .select('setting_key, setting_value')
      .eq('active', true);

    if (result.error) {
      throw result.error;
    }

    var settings = {};

    (result.data || []).forEach(function (row) {
      settings[row.setting_key] = parseValue(row.setting_value);
    });

    return normalizeSettings(settings);
  }

  window.applicationSettingsReady = (async function () {
    // Supabase is the source of truth. Built-in defaults are only a last
    // resort so the website can still render if the database is unavailable.
    var defaults = normalizeSettings({
      displayCurrency: 'USD',
      currencyOptions: {
        USD: { en: '$', ar: '$' },
        QAR: { en: 'QAR', ar: 'ريال' }
      },
      defaultLanguage: 'en'
    });

    try {
      var settings = await loadFromSupabase();
      console.info('[Application settings] Loaded from Supabase.');
      return settings;
    } catch (error) {
      console.warn(
        '[Application settings] Supabase unavailable; using built-in defaults.',
        error
      );
      return defaults;
    }
  })();

  window.getApplicationSettings = function () {
    return window.applicationSettingsReady;
  };
})();
