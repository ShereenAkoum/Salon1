(function () {
  const currentPage = window.location.pathname.split("/").pop() || 'index.html';

  function loadVouchers() {
    const container = document.getElementById('vouchers-grid');
    if (!container) return;

    fetch('assets/data/vouchers.json')
        .then(r => r.json())
        .then(vouchers => {

            container.innerHTML = vouchers
                .filter(v => v.active)
                .map(v => `
                    <a href="booking-date-time.html"
                       class="voucher-card"
                       onclick="localStorage.setItem('voucher','${v.title}')">
                        <img src="${v.image}" alt="${v.title}">
                    </a>
                `)
                .join('');
        })
        .catch(err => console.error('Error loading vouchers:', err));
}

  fetch("seo-head.html")
    .then(response => response.text())
    .then(data => {
      var temp = document.createElement('div');
      temp.innerHTML = data;
      Array.from(temp.childNodes).forEach(function (node) {
        document.head.appendChild(node.cloneNode(true));
      });
    })
    .catch(error => console.error("Error loading seo head:", error));

  fetch("site-footer.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("footer-placeholder").innerHTML = data;
    })
    .catch(error => console.error("Error loading footer:", error));

  if (currentPage !== "index.html") {

    // ✅ header first, then navbar
    fetch("site-header.html")
      .then(response => response.text())
      .then(data => {
        document.getElementById("page-header").innerHTML = data;

        return fetch("site-navigation.html");
      })
      .then(response => response.text())
      .then(data => {
        document.getElementById("rdNavBar").innerHTML = data;

        // Set active nav link
        document.querySelectorAll('#rdNavBar .rd-navbar-nav a').forEach(function (link) {
          link.parentElement.classList.remove('active');
          if (link.getAttribute('href') === currentPage) {
            link.parentElement.classList.add('active');
          }
        });

        // Reinitialize RD Navbar plugin
        var $nav = $('.rd-navbar');
        if ($nav.length && typeof $nav.RDNavbar === 'function') {
          $nav.RDNavbar();
        }

        // Reinit perspective menu
        var nav = $('.rd-navbar-wrap');
        var perspective = $('#perspective');

        if (perspectiveMenu.length) {
          $('#perspective-open-menu').on('click', function () {
            nav.addClass('active');
            perspective.addClass('active modalView');
          });
          $('#perspective-content-overlay').on('click', function () {
            nav.removeClass('active');
            perspective.removeClass('active');
            setTimeout(function () {
              perspective.removeClass('modalView');
            }, 400);
          });
        }

        // ✅ Notify language.js only after both are done
        document.dispatchEvent(new CustomEvent('navbarLoaded'));
      })
      .catch(error => console.error("Error loading header/navbar:", error));
  }

  if (currentPage === "index.html" || currentPage === "vouchers.html") {
    loadVouchers();
  }
})();

