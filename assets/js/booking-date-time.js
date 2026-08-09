(function () {
  var config = null;
  var schedule = null;

  var MONTH_NAMES_EN = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  function toIsoKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function getLang() {
    return document.documentElement.getAttribute('lang') || localStorage.getItem('siteLang') || 'en';
  }

  function getDateRange() {
    var dates = [];
    var now = new Date();
    // var end = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
    var end = new Date(now.getFullYear(), now.getMonth() + 4, 0); // day 0 = last day of previous month
    var cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while (cur <= end) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  function groupByMonth(dates) {
    var groups = {}, order = [];
    dates.forEach(function (d) {
      var key = d.getFullYear() + '-' + d.getMonth();
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(d);
    });
    return { groups: groups, order: order };
  }

  function getMonthSchedule(date) {
    if (!schedule || !schedule.monthlySchedule) return null;
    return schedule.monthlySchedule[MONTH_NAMES_EN[date.getMonth()]] || null;
  }

  function getDateOverride(date) {
    var ms = getMonthSchedule(date);
    if (!ms || !ms.closedDates) return null;
    return ms.closedDates[String(date.getDate())] || null;
  }

  /** True if the entire date is closed (weekday rule or fullyClose override) */
  function isClosed(date) {
    var ms = getMonthSchedule(date);
    var override = getDateOverride(date);
    if (override && override.fullyClose === true) return true;
    var closedDays = (ms && ms.closedDays) || [];
    return closedDays.indexOf(date.getDay()) !== -1;
  }

  /**
   * True if this specific slot is unavailable because:
   *   1. The whole date is closed, OR
   *   2. Per-date closedTime includes this slot index, OR
   *   3. Month-level closedTime includes this slot index, OR
   */
  function isSlotDisabled(date, slotIndex, slotText) {
    if (isClosed(date)) return true;

    var ms = getMonthSchedule(date);
    var override = getDateOverride(date);
    var isoKey = toIsoKey(date);

    // Per-date closedTime overrides month-level closedTime
    if (override && Array.isArray(override.closedTime)) {
      if (override.closedTime.indexOf(slotIndex) !== -1) return true;
    } else {
      var closedTime = (ms && ms.closedTime) || [];
      if (closedTime.indexOf(slotIndex) !== -1) return true;
    }

    return false;
  }

  function isToday(date) {
    var now = new Date();
    return date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render(lang) {
    if (!config) return;

    var months = config.months[lang] || config.months['en'];
    var days = config.days[lang] || config.days['en'];
    var slots = config.timeSlots;

    var backEl = document.getElementById('booking-date-time-back');
    if (backEl) backEl.textContent = config['back-' + lang] || config['back-en'];

    var titleEl = document.getElementById('booking-date-time-title');
    if (titleEl) titleEl.textContent = config['title-' + lang] || config['title-en'];

    var descEl = document.getElementById('booking-date-time-description');
    if (descEl) descEl.textContent = config['description-' + lang] || config['description-en'];

    var dateRange = getDateRange();
    var grouped = groupByMonth(dateRange);

    var container = document.getElementById('date-picker-container');
    if (!container) return;
    container.innerHTML = '';

    grouped.order.forEach(function (monthKey) {
      var monthDates = grouped.groups[monthKey];
      var sample = monthDates[0];
      var monthName = months[sample.getMonth()];
      var year = sample.getFullYear();
      var monthLabel = monthName + ' ' + year;

      var heading = document.createElement('h3');
      heading.className = 'date-picker-month-heading';
      heading.textContent = monthLabel;
      container.appendChild(heading);

      var tabsWrap = document.createElement('div');
      tabsWrap.className = 'rd-material-tabs date-picker';
      tabsWrap.setAttribute('data-items', '2');
      tabsWrap.setAttribute('data-xs-items', '3');
      tabsWrap.setAttribute('data-sm-items', '4');
      tabsWrap.setAttribute('data-md-items', '5');
      tabsWrap.setAttribute('data-margin', '15');
      tabsWrap.setAttribute('data-stage-padding', '0');
      tabsWrap.setAttribute('data-sm-stage-padding', '30');

      var tabList = document.createElement('div');
      tabList.className = 'rd-material-tabs__list';
      var ul = document.createElement('ul');

      var tabContent = document.createElement('div');
      tabContent.className = 'rd-material-tabs__container';

      monthDates.forEach(function (date) {
        var closed = isClosed(date);
        var today = isToday(date);
        var isoKey = toIsoKey(date);
        var dayNum = String(date.getDate());
        var dayName = days[date.getDay()];

        // ── Date tab ──────────────────────────────────────────────────────
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.className = 'date-picker-date' + (closed ? ' disabled' : '') + (today ? ' today' : '');
        a.href = '#';
        a.dataset.isoKey = isoKey;

        var numDiv = document.createElement('div');
        numDiv.className = 'date-picker-date-number';
        numDiv.textContent = dayNum;

        var dayDiv = document.createElement('p');
        dayDiv.className = 'date-picker-date-text';
        dayDiv.textContent = dayName;
        // Remove margin-top
        dayDiv.style.marginTop = "0"
        dayDiv.style.letterSpacing = "0"

        a.appendChild(numDiv);
        a.appendChild(dayDiv);
        li.appendChild(a);
        ul.appendChild(li);

        // ── Time panel ────────────────────────────────────────────────────
        var panel = document.createElement('div');
        panel.dataset.isoKey = isoKey;
        panel.dataset.monthLabel = monthLabel;
        panel.dataset.dayNum = dayNum;
        panel.dataset.dayName = dayName;

        var slotUl = document.createElement('ul');
        slotUl.className = 'date-picker-list animated fadeIn';

        slots.forEach(function (slot, slotIndex) {
          var slotLi = document.createElement('li');
          var slotA = document.createElement('a');
          slotA.textContent = slot;

          var disabled = isSlotDisabled(date, slotIndex, slot);

          if (disabled) {
            slotLi.className = 'disabled';
          } else {
            (function (capturedIso, capturedSlot, capturedMonth, capturedDayNum, capturedDayName, capturedSlotLi, capturedSlotUl) {
              slotA.addEventListener('click', function (e) {
                e.preventDefault();

                capturedSlotUl.querySelectorAll('li').forEach(function (el) {
                  el.classList.remove('active');
                });

                if (typeof toggleDateSlot === 'function') {
                  toggleDateSlot(capturedSlot, capturedIso, capturedDayNum, capturedDayName, capturedMonth);
                }

                var selections = typeof getSelections === 'function' ? getSelections() : [];
                var isSelected = selections.some(function (s) {
                  return s.isoKey === capturedIso && s.time === capturedSlot;
                });
                if (isSelected) capturedSlotLi.classList.add('active');
              });
            })(isoKey, slot, monthLabel, dayNum, dayName, slotLi, slotUl);
          }

          slotLi.appendChild(slotA);
          slotUl.appendChild(slotLi);
        });

        panel.appendChild(slotUl);
        tabContent.appendChild(panel);
      });

      tabList.appendChild(ul);
      tabsWrap.appendChild(tabList);
      tabsWrap.appendChild(tabContent);
      container.appendChild(tabsWrap);
    });

    if (window.jQuery && jQuery.fn.RDMaterialTabs) {
      jQuery('.rd-material-tabs').RDMaterialTabs();
    }

    if (typeof onDatePickerReady === 'function') {
      onDatePickerReady(config);
    }
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    Promise.all([
      fetch('assets/data/booking-date-time.json').then(function (r) { return r.json(); }),
      fetch('assets/data/salon-schedule.json').then(function (r) { return r.json(); })
    ])
      .then(function (results) {
        config = results[0];
        schedule = results[1];
        render(getLang());
      })
      .catch(function (err) { console.error('Error loading booking date-time data:', err); });
  });

  document.addEventListener('langChanged', function (e) {
    render(e.detail.lang);
  });
})();