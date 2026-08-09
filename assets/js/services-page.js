(function () {
  var categoryData = null;

  function getDisplayCurrency() {
    return (categoryData && categoryData.displayCurrency) || 'QAR';
  }

  function formatPrice(service) {
    var currency = getDisplayCurrency();
    var options = categoryData.currencyOptions || {};
    var symbol = options[currency] || currency;
    var value = service.prices ? service.prices[currency] : null;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    return symbol + value;
  }

  function getBookLabel(lang, service) {
    var baseLabel = lang === 'ar' ? 'احجز' : 'Book';
    var price = formatPrice(service);

    return price ? baseLabel + ' ' + price : (lang === 'ar' ? 'احجز الآن' : 'Book Now');
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