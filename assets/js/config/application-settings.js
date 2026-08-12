(function () {
  'use strict';

  function parseValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch (error) { return value; }
  }

  function requireImage(value, key) {
    var result = parseValue(value);
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Supabase application setting "' + key + '" is missing or invalid.');
    }
    if (!result.url || typeof result.url !== 'string') {
      throw new Error('Supabase application setting "' + key + '" has no image URL.');
    }
    if (!result.width || !result.height) {
      throw new Error('Supabase application setting "' + key + '" is missing image dimensions.');
    }
    return {
      path: String(result.path || ''),
      url: String(result.url),
      width: String(result.width),
      height: String(result.height)
    };
  }

  function optionalImage(value) {
    if (!value) return null;
    var result = parseValue(value);
    if (!result || typeof result !== 'object' || Array.isArray(result) || !result.url) return null;
    return {path:String(result.path || ''), url:String(result.url), width:String(result.width || '32px'), height:String(result.height || '32px')};
  }

  function normalizeSettings(raw) {
    raw = raw || {};
    var currencyOptions = raw.currency_options || raw.currencyOptions;
    var displayCurrency = raw.display_currency || raw.displayCurrency;
    var defaultLanguage = raw.default_language || raw.defaultLanguage;
    var websiteName = raw.website_name || raw.websiteName;
    var contactPhone = raw.contact_phone || raw.contactPhone;

    if (!currencyOptions || typeof currencyOptions !== 'object') {
      throw new Error('Supabase application setting "currency_options" is missing or invalid.');
    }
    if (!displayCurrency) throw new Error('Supabase application setting "display_currency" is missing.');
    if (!defaultLanguage) throw new Error('Supabase application setting "default_language" is missing.');
    if (!websiteName || typeof websiteName !== 'string' || !websiteName.trim()) throw new Error('Supabase application setting "website_name" is missing.');
    if (!contactPhone) throw new Error('Supabase application setting "contact_phone" is missing.');

    return {
      display_currency: String(displayCurrency).toUpperCase(),
      currency_options: currencyOptions,
      default_language: String(defaultLanguage).toLowerCase(),
      website_name: String(websiteName).trim(),
      contact_phone: String(contactPhone).trim(),
      header_image: requireImage(raw.header_image || raw.headerImage, 'header_image'),
      banner_image: requireImage(raw.banner_image || raw.bannerImage, 'banner_image'),
      favicon_image: optionalImage(raw.favicon_image || raw.faviconImage)
    };
  }

  async function loadFromSupabase() {
    if (!window.salonSupabase) throw new Error('Supabase client is not available.');
    var result = await window.salonSupabase
      .from('application_settings')
      .select('setting_key, setting_value')
      .eq('active', true);
    if (result.error) throw result.error;

    var settings = {};
    (result.data || []).forEach(function (row) {
      settings[row.setting_key] = parseValue(row.setting_value);
    });
    return normalizeSettings(settings);
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clearBranding() {
    document.querySelectorAll('.brand-desktop img, .rd-navbar-brand img').forEach(function (img) {
      img.removeAttribute('src');
      img.hidden = true;
    });
    document.querySelectorAll('.page-title').forEach(function (banner) {
      banner.style.backgroundImage = 'none';
    });
    var oldFavicon = document.querySelector('link[data-supabase-favicon]');
    if (oldFavicon) oldFavicon.remove();
  }

  function applyBranding(settings) {
    document.title = settings.website_name;
    var favicon = settings.favicon_image;
    var oldFavicon = document.querySelector('link[data-supabase-favicon]');
    if (oldFavicon) oldFavicon.remove();
    if (favicon && favicon.url) {
      var link = document.createElement('link');
      link.rel = 'icon';
      link.href = favicon.url;
      link.dataset.supabaseFavicon = 'true';
      document.head.appendChild(link);
    }
    document.querySelectorAll('[data-website-name]').forEach(function (el) { el.innerHTML = '<span class="logo-glow">' + escapeHtml(settings.website_name) + '</span>'; });
    var header = settings.header_image;
    var bannerImage = settings.banner_image;

    document.querySelectorAll('.brand-desktop img, .rd-navbar-brand img').forEach(function (img) {
      img.src = header.url;
      img.width = parseInt(header.width, 10) || 0;
      img.height = parseInt(header.height, 10) || 0;
      img.style.width = header.width;
      img.style.height = header.height;
      img.style.objectFit = 'contain';
      img.hidden = false;
    });

    document.querySelectorAll('.page-title').forEach(function (banner) {
      banner.style.backgroundImage = 'url("' + bannerImage.url.replace(/"/g, '\\"') + '")';
      banner.style.width = bannerImage.width;
      banner.style.minHeight = bannerImage.height;
    });
  }

  window.applyApplicationBranding = applyBranding;

  window.applicationSettingsReady = (async function () {
    clearBranding();
    try {
      var settings = await loadFromSupabase();
      applyBranding(settings);
      document.dispatchEvent(new CustomEvent('applicationSettingsLoaded', { detail: settings }));
      console.info('[Application settings] Loaded from Supabase.', settings.website_name, settings.header_image.url, settings.banner_image.url);
      return settings;
    } catch (error) {
      clearBranding();
      document.dispatchEvent(new CustomEvent('applicationSettingsError', { detail: error }));
      console.error('[Application settings] Supabase branding load failed. No local image fallback is used.', error);
      throw error;
    }
  })();

  window.getApplicationSettings = function () {
    return window.applicationSettingsReady;
  };
})();
