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
                .map(v => {
                    const payload = JSON.stringify({
                        id: v.id,
                        sku: v.sku || ('V-' + String(v.id).padStart(3, '0')),
                        title: v.title,
                        image: v.image,
                        durationMinutes: Number(v.durationMinutes || 30),
                        price: v.price == null || v.price === '' ? null : Number(v.price)
                    }).replace(/"/g, '&quot;');

                    return `
                    <a href="booking.html"
                       class="voucher-card"
                       data-voucher='${payload}'
                       aria-label="Book ${String(v.title).replace(/"/g, '&quot;')}">
                        <img src="${v.image}" alt="${v.title}">
                    </a>`;
                })
                .join('');

            container.querySelectorAll('[data-voucher]').forEach(card => {
                card.addEventListener('click', function () {
                    try {
                        const voucher = JSON.parse(card.getAttribute('data-voucher'));
                        // A voucher is a standalone booking item: selecting a
                        // voucher replaces any previous service/voucher draft.
                        localStorage.removeItem('salonBookingDraft');
                        localStorage.removeItem('bookingServiceSku');
                        localStorage.removeItem('service');
                        localStorage.setItem('bookingVoucher', JSON.stringify(voucher));
                    } catch (e) {
                        console.error('Could not prepare voucher booking:', e);
                    }
                });
            });
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

