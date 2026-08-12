(function () {
  var html = document.documentElement;
  // langLabel: update ALL instances (original + sticky clone)
  function getLangLabels() {
    return document.querySelectorAll('.lang-switcher .lang-label');
  }
  var currentLang = localStorage.getItem('siteLang') || 'en';

  // Booking configuration is now stored in Supabase alongside the booking
  // schedule. The remaining site content still uses the existing page JSON.
  Promise.all([
    window.getApplicationSettings ? window.getApplicationSettings() : Promise.resolve(null),
    fetch('assets/data/index.json').then(function (r) { return r.json(); }),
    fetch('assets/data/nav.json').then(function (r) { return r.json(); }),
    window.salonDatabase && window.salonDatabase.getBookingConfiguration
      ? window.salonDatabase.getBookingConfiguration().catch(function () { return null; })
      : Promise.resolve(null)
  ]).then(function (results) {
    var appSettings = results[0];
    var pageData = results[1];
    var navData = results[2];
    var bookingConfiguration = results[3];

    if (!localStorage.getItem('siteLang') && appSettings && appSettings.default_language) {
      currentLang = String(appSettings.default_language).toLowerCase();
      if (currentLang !== 'ar' && currentLang !== 'en') currentLang = 'en';
    }

    // Flatten pageData into a dot-notation lookup map
    // e.g. { "mainSection.title": {en:"...", ar:"..."}, ... }
    var translations = {};

    function flattenSection(obj, prefix) {
      Object.keys(obj).forEach(function (rawKey) {
        var val = obj[rawKey];

        // Keys like "title-en" → strip suffix, collect both langs
        var langMatch = rawKey.match(/^(.+)-(en|ar)$/);
        if (langMatch) {
          var cleanKey = prefix + '.' + langMatch[1];
          var lang = langMatch[2];
          if (!translations[cleanKey]) translations[cleanKey] = {};
          translations[cleanKey][lang] = val;
          return;
        }
        // ✅ ADD THIS BLOCK
        if (typeof val !== 'object') {
          var fk = prefix + '.' + rawKey;
          if (!translations[fk]) translations[fk] = {};
          translations[fk]['en'] = val;
          translations[fk]['ar'] = val;
          return;
        }
        // Arrays (ourServices.items, openingHours.days)
        if (Array.isArray(val)) {
          val.forEach(function (item, index) {
            Object.keys(item).forEach(function (ik) {
              var im = ik.match(/^(.+)-(en|ar)$/);
              if (im) {
                var fk = prefix + '.' + rawKey + '.' + index + '.' + im[1];
                if (!translations[fk]) translations[fk] = {};
                translations[fk][im[2]] = item[ik];
              } else {
                // Plain key (no language suffix) — shared across both languages
                var fk = prefix + '.' + rawKey + '.' + index + '.' + ik;
                if (!translations[fk]) translations[fk] = {};
                translations[fk]['en'] = item[ik];
                translations[fk]['ar'] = item[ik];
              }
            });
          });
          return;
        }

        // Nested object — recurse
        if (typeof val === 'object' && val !== null) {
          flattenSection(val, prefix + '.' + rawKey);
          return;
        }
      });
    }

    // Process pageData sections
    Object.keys(pageData).forEach(function (section) {
      flattenSection(pageData[section], section);
    });

    // Process navData: keys are already "home", "services" etc.
    ['en', 'ar'].forEach(function (lang) {
      Object.keys(navData[lang]).forEach(function (key) {
        var fk = 'nav.' + key;
        if (!translations[fk]) translations[fk] = {};
        translations[fk][lang] = navData[lang][key];
      });
    });
    // Process booking settings from Supabase.
    if (bookingConfiguration && bookingConfiguration.settings) {
      var bookingSettings = bookingConfiguration.settings;
      var dateTimeText = bookingSettings.date_time_text || {};
      ['back', 'title', 'description'].forEach(function (field) {
        if (!dateTimeText[field]) return;
        var dateTimeKey = 'bookingDateTime.' + field;
        if (!translations[dateTimeKey]) translations[dateTimeKey] = {};
        if (dateTimeText[field].en) translations[dateTimeKey].en = dateTimeText[field].en;
        if (dateTimeText[field].ar) translations[dateTimeKey].ar = dateTimeText[field].ar;
      });

      var messages = bookingSettings.messages || {};

      ['en', 'ar'].forEach(function (lang) {
        ['closed', 'booked', 'available'].forEach(function (field) {
          if (messages[lang] && messages[lang][field]) {
            var messageKey = 'bookingDateTime.' + field;
            if (!translations[messageKey]) translations[messageKey] = {};
            translations[messageKey][lang] = messages[lang][field];
          }
        });
      });

      var review = bookingSettings.review_text || {};
      Object.keys(review).forEach(function (field) {
        if (!review[field]) return;
        var key = 'bookingReview.' + field;
        if (!translations[key]) translations[key] = {};
        if (review[field].en) translations[key].en = review[field].en;
        if (review[field].ar) translations[key].ar = review[field].ar;
      });
    }

    function renderServiceItems(lang) {
      var grid = document.getElementById('services-grid');
      if (!grid || !pageData.ourServices || !pageData.ourServices.items) return;

      grid.innerHTML = pageData.ourServices.items.map(function (item, index) {
        var title = item['title-' + lang] || item['title-en'] || '';
        var description = item['description-' + lang] || item['description-en'] || '';
        // src supports both "src" (plain) and "src-en"/"src-ar"
        var filePath = "assets/images/";
        var src = item['src-' + lang] || item['src'];

        if (src) {
          filePath += src;
        }

        var width = 'auto';
        var height = item['height'] || '62';
        var imgHtml = src
          ? '<figure class="box-icon-image"><img src="' + filePath + '" alt="' + title + '" width="' + width + '" height="' + height + '" /></figure>'
          : '';

        return '<div class="cell-xs-6">'
          + '<article class="box-icon">'
          + imgHtml
          + '<p class="box-icon-header"><a class="link-underlined" href="booking.html">' + title + '</a></p>'
          + '<p class="box-icon-text">' + description + '</p>'
          + '</article>'
          + '</div>';
      }).join('');
    }
    // ── Core apply function ───────────────────────────────────────────
    function applyLang(lang, isInitial) {
      // On manual switch: brief fade for smooth UX
      // On initial load: skip fade entirely — body is already hidden by anti-flash style
      if (!isInitial) {
        document.body.classList.add('lang-transitioning');
      }

      function doApply() {
        // Translate every keyed element
        var els = document.querySelectorAll('[data-i18n]');
        els.forEach(function (el) {
          var key = el.getAttribute('data-i18n');
          var data = translations[key];
          var data = translations[key];
          if (!data) return;

          // ✅ fallback to English if selected lang is missing
          var text = data[lang] || data['en'];
          if (!text) return;

          // Handle attribute translations (like href, src, etc.)
          var attrConfig = el.getAttribute('data-i18n-attr');
          if (attrConfig) {
            // Example: "href:tel:"
            var parts = attrConfig.split('-');
            var attrName = parts[0];
            var prefix = parts[1] || '';

            el.setAttribute(attrName, prefix + text);
            if (el.tagName.toLowerCase() !== 'img') {
              el.textContent = text;
            }
            // ✅ IMPORTANT: don't apply text content for elements using attributes only
            return;
          }
          if (text.indexOf('<') !== -1) {
            el.innerHTML = text;
          } else {
            el.textContent = text;
          }
        });

        // Update ALL lang switcher labels (original + sticky clone)
        if (translations['nav.langSwitcherLabel']) {
          getLangLabels().forEach(function (el) {
            el.textContent = translations['nav.langSwitcherLabel'][lang] || '';
          });
        }

        localStorage.setItem('siteLang', lang);
        currentLang = lang;
        document.body.classList.remove('lang-transitioning');

        // Remove the anti-flash style so the page becomes visible
        var antiFlash = document.getElementById('anti-flash');
        if (antiFlash) antiFlash.parentNode.removeChild(antiFlash);

        // Notify dynamic renderers (e.g. services-page.js) about the language change
        document.dispatchEvent(new CustomEvent('langChanged', { detail: { lang: lang } }));
      }

      if (isInitial) {
        doApply();
        renderServiceItems(lang);
      } else {
        setTimeout(doApply, 150);
      }
    }

    // Initial render — synchronous, no flash
    applyLang(currentLang, true);

    // Navbar is injected asynchronously by site-loader.js — re-apply translations
    // to the navbar's data-i18n elements once it signals it is ready.
    document.addEventListener('navbarLoaded', function () {
      applyLang(currentLang, true);
    });

    // Use event delegation on document so both the original navbar
    // and the sticky cloned navbar are covered by a single listener.
    document.addEventListener('click', function (e) {
      var anchor = e.target.closest('.lang-switcher');
      if (!anchor) return;
      e.preventDefault();

      var newLang = currentLang === 'en' ? 'ar' : 'en';
      // ✅ Save selected language
      localStorage.setItem('siteLang', newLang);

      // ✅ Reload page instead of live switching
      location.reload();
      // applyLang(currentLang === 'en' ? 'ar' : 'en');

    });

  }).catch(function (err) {
    console.error('[i18n] Failed to load translation files:', err);
  });
})();