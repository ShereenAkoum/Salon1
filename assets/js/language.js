(function () {
  var html = document.documentElement;
  // langLabel: update ALL instances (original + sticky clone)
  function getLangLabels() {
    return document.querySelectorAll('.lang-switcher .lang-label');
  }
  var currentLang = localStorage.getItem('siteLang') || 'en';

  // ── Fetch both JSON files in parallel ────────────────────────────────
  Promise.all([
    window.getApplicationSettings ? window.getApplicationSettings() : Promise.resolve(null),
    fetch('assets/data/index.json').then(function (r) { return r.json(); }),
    fetch('assets/data/nav.json').then(function (r) { return r.json(); }),
    fetch('assets/data/faq.json').then(function (r) { return r.json(); }).catch(function () { return null; }),
    fetch('assets/data/booking-date-time.json').then(function (r) { return r.json(); }).catch(function () { return null; }),
    fetch('assets/data/booking-review.json').then(function (r) { return r.json(); }).catch(function () { return null; })
  ]).then(function (results) {
    var appSettings = results[0];
    var pageData = results[1];
    var navData = results[2];
    var faqData = results[3];
    var bookingDateTimeData = results[4];
    var bookingReviewData = results[5];

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

    // Process faq-page.json
    if (faqData) {
      ['title', 'description'].forEach(function (field) {
        ['en', 'ar'].forEach(function (lang) {
          var val = faqData[field + '-' + lang];
          if (val) {
            var fk = 'faq.' + field;
            if (!translations[fk]) translations[fk] = {};
            translations[fk][lang] = val;
          }
        });
      });
    }

    // Process booking-date-time.json
    if (bookingDateTimeData) {
      ['back', 'title', 'description'].forEach(function (field) {
        ['en', 'ar'].forEach(function (lang) {
          var val = bookingDateTimeData[field + '-' + lang];
          if (val) {
            var fk = 'bookingDateTime.' + field;
            if (!translations[fk]) translations[fk] = {};
            translations[fk][lang] = val;
          }
        });
      });
    }

    // Process booking-review.json
    if (bookingReviewData && bookingReviewData.bookingReview) {
      var bookingReviewFields = [
        'back', 'title', 'description',
        'serviceLabel', 'dateLabel',
        'namePlaceholder', 'phonePlaceholder',
        'submitButton', 'submitting',
        'successMessage', 'errorMessage','voucherLabel'
      ];
      bookingReviewFields.forEach(function (field) {
        ['en', 'ar'].forEach(function (lang) {
          var val = bookingReviewData.bookingReview[field + '-' + lang];
          if (val) {
            var fk = 'bookingReview.' + field;
            if (!translations[fk]) translations[fk] = {};
            translations[fk][lang] = val;
          }
        });
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