(function () {
  var categoryData = null;

  /*
   * Supabase is the primary source for the service catalogue.
   * services.json is kept as an emergency fallback only.
   *
   * Supabase tables:
   *   service_categories
   *   services
   *
   * The renderer below converts the database rows into the same shape
   * the existing page expects, so the visual design and booking flow
   * do not need to change.
   */

  var SERVICE_PAGE_CONFIG = {
    displayCurrency: 'USD',
    currencyOptions: {
      USD: { en: '$', ar: '$' },
      QAR: { en: 'QAR', ar: 'ريال' }
    },
    title: {
      en: 'Our Services',
      ar: 'خدماتنا'
    },
    description: {
      en: 'Discover your perfect look with our professional women\'s hair salon services. From beautiful hairstyles to advanced hair treatments, our team is here to help you look and feel your best.',
      ar: 'اكتشفي إطلالتك المثالية مع خدمات صالون الشعر المتخصصة للنساء. من تسريحات الشعر الجميلة إلى علاجات الشعر المتقدمة، فريقنا هنا ليمنحك إطلالة تشعرين معها بأفضل حال.'
    }
  };

  function getDisplayCurrency() {
    return SERVICE_PAGE_CONFIG.displayCurrency || 'USD';
  }

  function getCurrencyLabel(currency, lang) {
    var option = SERVICE_PAGE_CONFIG.currencyOptions[currency];

    if (option && typeof option === 'object') {
      return option[lang] || option.en || currency;
    }

    return option || currency;
  }

  function getPriceValue(service, currency) {
    var prices = service && service.prices ? service.prices : {};
    var value = prices[currency];

    // No automatic conversion. Only use the price explicitly entered
    // for the selected currency.
    if (value !== null && value !== undefined && value !== '') {
      var numericValue = Number(value);
      return Number.isNaN(numericValue) ? null : numericValue;
    }

    return null;
  }

  function formatPrice(service, lang) {
    var currency = getDisplayCurrency();
    var value = getPriceValue(service, currency);

    if (value === null || Number.isNaN(value)) {
      return null;
    }

    var label = getCurrencyLabel(currency, lang);
    var roundedValue = currency === 'QAR'
      ? Math.round(value)
      : Number(value.toFixed(2));

    // USD: $25
    // QAR English: 25QAR
    // QAR Arabic: 25 ريال
    if (currency === 'QAR') {
      return roundedValue + (lang === 'ar' ? ' ' : '') + label;
    }

    return label + roundedValue;
  }

  function openBookingForService(service) {
    try {
      localStorage.setItem('service', service['name-en'] || '');
      localStorage.setItem('bookingServiceSku', service.sku || '');
    } catch (e) {}
    window.location.href = 'booking.html';
  }

  function getBookLabel(lang, service) {
    var baseLabel = lang === 'ar' ? 'احجز' : 'Book';
    var price = formatPrice(service, lang);

    return price
      ? baseLabel + ' ' + price
      : (lang === 'ar' ? 'احجز الآن' : 'Book Now');
  }

  function updateServicePageText(lang) {
    var title = document.querySelector('[data-i18n="categoryServices.title"]');
    var description = document.querySelector('[data-i18n="categoryServices.description"]');

    if (title) {
      title.textContent = SERVICE_PAGE_CONFIG.title[lang] || SERVICE_PAGE_CONFIG.title.en;
    }

    if (description) {
      description.textContent =
        SERVICE_PAGE_CONFIG.description[lang] || SERVICE_PAGE_CONFIG.description.en;
    }
  }

  // Convert Supabase rows to the structure already used by the page.
  function convertSupabaseData(categories, services) {
    return {
      displayCurrency: SERVICE_PAGE_CONFIG.displayCurrency,
      currencyOptions: SERVICE_PAGE_CONFIG.currencyOptions,

      categories: (categories || []).map(function (category) {
        return {
          id: category.id,
          'name-en': category.name_en,
          'name-ar': category.name_ar,
          src: category.image_url || '',
          width: category.image_width || 70,
          height: category.image_height || 62,
          sortOrder: category.sort_order || 0,
          active: category.active !== false,

          services: (services || [])
            .filter(function (service) {
              return service.category_id === category.id && service.active !== false;
            })
            .map(function (service) {
              return {
                id: service.id,
                sku: service.sku,
                'name-en': service.name_en,
                'name-ar': service.name_ar,
                'description-en': service.description_en || '',
                'description-ar': service.description_ar || '',
                prices: {
                  USD: service.price_usd,
                  QAR: service.price_qar
                },
                durationMinutes: service.duration_minutes,
                active: service.active !== false,
                sortOrder: service.sort_order || 0
              };
            })
        };
      }).filter(function (category) {
        return category.active;
      })
    };
  }

  async function loadServicesFromSupabase() {
    if (!window.salonSupabase) {
      throw new Error('Supabase client is not available.');
    }

    var categoryResult = await window.salonSupabase
      .from('service_categories')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (categoryResult.error) {
      throw categoryResult.error;
    }

    var serviceResult = await window.salonSupabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (serviceResult.error) {
      throw serviceResult.error;
    }

    return convertSupabaseData(
      categoryResult.data,
      serviceResult.data
    );
  }

  async function loadServicesFromJsonFallback() {
    var response = await fetch('assets/data/services.json', {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Could not load services.json fallback.');
    }

    return response.json();
  }

  async function loadSalonServices() {
    try {
      console.info('[Services] Loading service catalogue from Supabase...');

      var databaseData = await loadServicesFromSupabase();

      console.info(
        '[Services] Loaded from Supabase:',
        databaseData.categories.length,
        'categories /',
        databaseData.categories.reduce(function (total, category) {
          return total + category.services.length;
        }, 0),
        'services'
      );

      return {
        source: 'supabase',
        data: databaseData
      };

    } catch (error) {
      console.error(
        '[Services] Supabase failed. Using services.json fallback.',
        error
      );

      try {
        var fallbackData = await loadServicesFromJsonFallback();

        console.warn('[Services] Fallback catalogue loaded from services.json.');

        return {
          source: 'json',
          data: fallbackData
        };
      } catch (fallbackError) {
        console.error(
          '[Services] Both Supabase and services.json failed.',
          fallbackError
        );

        throw fallbackError;
      }
    }
  }

  // ── Render categories in the given language ────────────────────────────
  function renderServices(lang) {
    if (!categoryData) return;

    updateServicePageText(lang);

    var container = document.getElementById("services-container");
    if (!container) return;
    container.innerHTML = "";

    categoryData.categories.forEach(function (category) {
      var categoryName = category['name-' + lang] || category['name-en'];

      var wrapper = document.createElement("div");
      wrapper.className = "cell-xs-6 cell-md-3";

      var article = document.createElement("article");
      article.className = "card-service";

      // Image
      var img = document.createElement("img");
      img.className = "card-service-image";
      img.src = "assets/images/" + category.src;
      img.alt = categoryName;
      img.width = category.width || 70;
      img.height = category.height || 62;

      // Category title
      var titleEl = document.createElement("p");
      titleEl.className = "card-service-title";
      titleEl.textContent = categoryName;

      article.appendChild(img);
      article.appendChild(titleEl);

      var activeServices = category.services.filter(function (s) {
        return s.active;
      });

      if (activeServices.length === 1) {
        // Single service → price + Book Now button
        var service = activeServices[0];
        var bookLabel = getBookLabel(lang, service);

        var btn = document.createElement("a");
        btn.className = "btn btn-sm card-service-control";
        btn.href = "javascript:void(0);";
        btn.textContent = bookLabel;
        btn.onclick = (function (s) {
          return function () {
            openBookingForService(s);
          };
        })(service);

        article.appendChild(btn);

      } else {
        // Multiple services → list with individual Book buttons
        var ul = document.createElement("ul");
        ul.className = "card-service-list";

        activeServices.forEach(function (service) {
          var serviceName =
            service['name-' + lang] || service['name-en'];

          var bookLabel = getBookLabel(lang, service);

          var li = document.createElement("li");

          var nameEl = document.createElement("span");
          nameEl.className = "card-service-list-name";
          nameEl.textContent = serviceName;
          li.appendChild(nameEl);

          var bookBtn = document.createElement("a");
          bookBtn.className = "btn btn-xs card-service-price-list";
          bookBtn.href = "javascript:void(0);";
          bookBtn.textContent = bookLabel;
          bookBtn.onclick = (function (s) {
            return function () {
              openBookingForService(s);
            };
          })(service);

          li.appendChild(bookBtn);
          ul.appendChild(li);
        });

        article.appendChild(ul);
      }

      wrapper.appendChild(article);
      container.appendChild(wrapper);
    });
  }

  // ── Load data on DOM ready ─────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    loadSalonServices()
      .then(function (result) {
        categoryData = result.data;

        var lang =
          document.documentElement.getAttribute('lang') ||
          localStorage.getItem('siteLang') ||
          'en';

        renderServices(lang);

        console.info('[Services] Active data source:', result.source);
      })
      .catch(function (err) {
        console.error('[Services] Could not load service catalogue:', err);
      });
  });

  // Re-render whenever language.js broadcasts a language change.
  document.addEventListener('langChanged', function (e) {
    renderServices(e.detail.lang);
  });
})();
