(function () {
  var categoryData = null;

  function getDisplayCurrency() {
    return (categoryData && categoryData.displayCurrency) || 'USD';
  }

  function getCurrencyLabel(currency, lang) {
    var options = (categoryData && categoryData.currencyOptions) || {};
    var option = options[currency];

    // New format: { USD: { en: "$", ar: "$" }, QAR: { en: "QAR", ar: "ريال" } }
    if (option && typeof option === 'object') {
      return option[lang] || option.en || currency;
    }

    // Backward compatibility with the old format: { USD: "$", QAR: "QAR" }
    return option || currency;
  }

  function getPriceValue(service, currency) {
    var prices = service && service.prices ? service.prices : {};
    var value = prices[currency];

    // Only use the price explicitly entered for the selected currency.
    // There is intentionally no automatic currency conversion.
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
    // QAR in English: 25QAR
    // QAR in Arabic: 25 ريال
    if (currency === 'QAR') {
      return roundedValue + (lang === 'ar' ? ' ' : '') + label;
    }

    return label + roundedValue;
  }

  function getBookLabel(lang, service) {
    var baseLabel = lang === 'ar' ? 'احجز' : 'Book';
    var price = formatPrice(service, lang);

    return price
      ? baseLabel + ' ' + price
      : (lang === 'ar' ? 'احجز الآن' : 'Book Now');
  }

  // ── Render categories in the given language ────────────────────────────
  function renderServices(lang) {
    if (!categoryData) return;

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

      var activeServices = category.services.filter(function (s) { return s.active; });

      if (activeServices.length === 1) {
        // Single service → price + Book Now button
        var service = activeServices[0];
        var bookLabel = getBookLabel(lang, service);

        var btn = document.createElement("a");
        btn.className = "btn btn-sm card-service-control";
        btn.href = "javascript:void(0);";
        btn.textContent = bookLabel;
        btn.onclick = (function (s) {
          return function () { if (typeof chooseService === 'function') chooseService(s['name-en'], s['name-ar'], category['name-en'], category['name-ar']); };
        })(service);

        article.appendChild(btn);

      } else {
        // Multiple services → list with individual Book buttons
        var ul = document.createElement("ul");
        ul.className = "card-service-list";

        activeServices.forEach(function (service) {
          var serviceName = service['name-' + lang] || service['name-en'];
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
            return function () { if (typeof chooseService === 'function') chooseService(s['name-en'], s['name-ar'], category['name-en'], category['name-ar']); };
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

  // ── Load data on DOM ready, initial render ─────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    fetch("assets/data/services.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        categoryData = data;
        var lang = document.documentElement.getAttribute('lang') || localStorage.getItem('siteLang') || 'en';
        renderServices(lang);
      })
      .catch(function (err) { console.error("Error loading categoryServices:", err); });
  });

  // Re-render whenever language.js broadcasts a language change
  document.addEventListener('langChanged', function (e) {
    renderServices(e.detail.lang);
  });
})();