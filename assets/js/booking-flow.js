// ─── Navigation helpers ───────────────────────────────────────────────────────

function getParams() {
    return new URLSearchParams(window.location.search);
}

function buildBackLink(currentStep) {
    const service = localStorage.getItem("service");
    const voucher = localStorage.getItem("voucher");
    let targetStep = "";
    let params = [];

    if (currentStep === "booking-date-time") {
        targetStep = "services.html";
        localStorage.removeItem("service");
        localStorage.removeItem("serviceDisplay");
        localStorage.removeItem("serviceCategory");
        localStorage.removeItem("serviceCategoryDisplay");
        localStorage.removeItem("selectedDates");

        if (voucher) params.push(`voucher=${encodeURIComponent(voucher)}`);
    }
    if (currentStep === "booking-review") {
        targetStep = "booking-date-time.html";
        if (service) params.push(`service=${encodeURIComponent(service)}`);
        localStorage.removeItem("selectedDates");
    }
    if (params.length > 0) targetStep += "?" + params.join("&");
    return targetStep;
}

/**
 * Called by services.html when a service is selected.
 * @param {string} serviceName             English name — used as the form submission value
 * @param {string} displayName             Localized name — shown in the UI on checkout
 *                                         Pass the same as serviceName if no translation available.
 * @param {string} [categoryName]          English category name — used as the form submission value
 * @param {string} [categoryDisplayName]   Localized category name — shown in the UI on checkout
 */
function chooseService(serviceName, displayName, categoryName, categoryDisplayName) {
    localStorage.setItem("service", serviceName);
    localStorage.setItem("serviceDisplay", displayName || serviceName);

    var voucher = localStorage.getItem('voucher');

    if (categoryName) {
        localStorage.setItem("serviceCategory", categoryName);
        localStorage.setItem("serviceCategoryDisplay", categoryDisplayName || categoryName);
    } else {
        localStorage.removeItem("serviceCategory");
        localStorage.removeItem("serviceCategoryDisplay");
    }

    const baseUrl = `booking-date-time.html?service=${encodeURIComponent(serviceName)}`;
    window.location.href = voucher ? `${baseUrl}&voucher=${encodeURIComponent(voucher)}` : baseUrl;

}

// ─── Step 2: Selection state ──────────────────────────────────────────────────

/**
 * Each entry: {
 *   isoKey:      "2026-06-03",
 *   time:        "10:00 - 11:00",
 *   displayHTML: "<strong>Sunday June 3 2026</strong> &nbsp;·&nbsp; <span dir=\"ltr\">10:00 - 11:00</span>"
 * }
 * displayHTML is built once at selection time in the current language and stored as-is.
 * Step 3 renders it directly — no rebuild needed.
 */
function getSelections() {
    try { return JSON.parse(localStorage.getItem("selectedDates")) || []; }
    catch (e) { return []; }
}

function saveSelections(sel) {
    localStorage.setItem("selectedDates", JSON.stringify(sel));
}

/**
 * Builds both the English and Arabic label strings from config at the moment of selection.
 * Only called inside toggleDateSlot — never called again after that.
 *
 * @returns {{ en: string, ar: string }}
 */
function buildLocalizedLabels(isoKey, bookingDateTimeConfig) {
    const date = new Date(isoKey + 'T12:00:00');
    const dayNum = date.getDate();
    const year = date.getFullYear();

    function labelFor(lang) {
        const months = (bookingDateTimeConfig && bookingDateTimeConfig.months && bookingDateTimeConfig.months[lang])
            || (bookingDateTimeConfig && bookingDateTimeConfig.months && bookingDateTimeConfig.months['en'])
            || [];
        const days = (bookingDateTimeConfig && bookingDateTimeConfig.days && bookingDateTimeConfig.days[lang])
            || (bookingDateTimeConfig && bookingDateTimeConfig.days && bookingDateTimeConfig.days['en'])
            || [];
        const monthName = months[date.getMonth()] || '';
        const dayName = days[date.getDay()] || '';
        return lang !== 'en'
            ? `${dayName} ${dayNum} ${monthName} ${year}`
            : `${dayName} ${monthName} ${dayNum} ${year}`;
    }

    return { en: labelFor('en'), ar: labelFor('ar') };
}

/**
 * Called by booking-date-time.js on slot click.
 * Builds and stores displayHTML at selection time so it never needs rebuilding.
 *
 * @param {string} timeSlot   e.g. "10:00 - 11:00"
 * @param {string} isoKey     e.g. "2026-06-03"
 * @param {string} dayNum     e.g. "3"
 * @param {string} dayName    e.g. "Sunday"
 * @param {string} monthLabel e.g. "June 2026"
 */
function toggleDateSlot(timeSlot, isoKey, dayNum, dayName, monthLabel) {
    let selections = getSelections();
    const idx = selections.findIndex(s => s.isoKey === isoKey);

    // Build display strings for both languages right now
    const labels = buildLocalizedLabels(isoKey, window._bookingDateTimeConfig);
    const displayHTML_en = `<strong>${labels.en}</strong> &nbsp;·&nbsp; <span dir="ltr">${timeSlot}</span>`;
    const displayHTML_ar = `<strong>${labels.ar}</strong> &nbsp;·&nbsp; <span dir="ltr">${timeSlot}</span>`;

    if (idx !== -1 && selections[idx].time === timeSlot) {
        // Clicking the same slot again → deselect
        selections.splice(idx, 1);
    } else if (idx !== -1) {
        // Different slot on same date → update time + rebuild display
        selections[idx].time = timeSlot;
        selections[idx].displayHTML_en = displayHTML_en;
        selections[idx].displayHTML_ar = displayHTML_ar;
    } else {
        // New date → add entry with pre-built displays
        selections.push({ isoKey, time: timeSlot, displayHTML_en, displayHTML_ar });
    }

    saveSelections(selections);
    refreshTimeSlotUI();
    renderSummary();
    updateContinueButton();
}

/**
 * Scoped entirely by isoKey — finds the exact panel using data-iso-key.
 */
function refreshTimeSlotUI() {
    const selections = getSelections();

    document.querySelectorAll(".date-picker-list a").forEach(a => a.classList.remove("selected-slot"));
    document.querySelectorAll(".date-picker-date").forEach(el => el.classList.remove("has-selection"));

    selections.forEach(sel => {
        const panel = document.querySelector(
            `.rd-material-tabs__container > div[data-iso-key="${sel.isoKey}"]`
        );
        if (!panel) return;

        panel.querySelectorAll(".date-picker-list a").forEach(a => {
            if (a.textContent.trim() === sel.time) {
                a.classList.add("selected-slot");
            }
        });

        const tabsWidget = panel.closest(".rd-material-tabs");
        if (!tabsWidget) return;
        tabsWidget.querySelectorAll(".date-picker-date[data-iso-key]").forEach(tab => {
            if (tab.dataset.isoKey === sel.isoKey) {
                tab.classList.add("has-selection");
            }
        });
    });
}

// ─── Summary panel + Continue button ─────────────────────────────────────────

function removeSelection(isoKey) {
    let selections = getSelections();
    selections = selections.filter(s => s.isoKey !== isoKey);
    saveSelections(selections);
    refreshTimeSlotUI();
    renderSummary();
    updateContinueButton();
}

// Heading strings per language
var _summaryHeadings = {
    en: { one: 'appointment selected for', many: 'appointments selected for' },
    ar: { one: 'موعد محدد لخدمة', many: 'مواعيد محددة لخدمة' }
};

/**
 * Renders the summary panel using the pre-built displayHTML stored in each selection.
 * No config or label rebuilding needed.
 */
function renderSummary() {
    const panel = document.getElementById("selection-summary");
    if (!panel) return;
    const selections = getSelections();

    if (selections.length === 0) {
        panel.style.display = "none";
        panel.innerHTML = "";
        return;
    }

    panel.style.display = "block";
    panel.innerHTML = "";

    const lang = localStorage.getItem('siteLang') || 'en';
    const params = getParams();

    // Always keep the raw service reference
    const service = params.get("service") || localStorage.getItem("service") || "";

    // Decide which values to use for display
    let serviceDisplay, categoryDisplay;

    if (lang === "en") {
        serviceDisplay = service || "Not selected";
        categoryDisplay = localStorage.getItem("serviceCategory") || "";
    } else {
        serviceDisplay = localStorage.getItem("serviceDisplay") || service || "غير محدد";
        categoryDisplay = localStorage.getItem("serviceCategoryDisplay") || localStorage.getItem("serviceCategory") || "";
    }
    const h = _summaryHeadings[lang] || _summaryHeadings['en'];

    if (lang === 'ar') {
        panel.style.setProperty("direction", "rtl", "important");
        panel.style.setProperty("text-align", "right", "important");
    }

    const heading = document.createElement("p");
    heading.textContent = selections.length === 1
        ? `1 ${h.one} ${categoryDisplay + " : " + serviceDisplay}`
        : `${selections.length} ${h.many} ${categoryDisplay + " : " + serviceDisplay}`;
    heading.style.cssText = "font-weight:600; margin:0 0 12px; color:#1a3a6b; font-size:13px; text-transform:uppercase; letter-spacing:.05em;";
    panel.appendChild(heading);

    const sorted = [...selections].sort((a, b) => a.isoKey.localeCompare(b.isoKey));
    sorted.forEach(sel => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; justify-content:space-between; background:#fff; border:1px solid #dde3f0; border-radius:6px; padding:10px 14px; margin-bottom:8px;";

        const text = document.createElement("span");
        text.style.cssText = "font-size:13px; color:#333;";
        // Use the language-appropriate pre-built HTML string
        text.innerHTML = lang === 'ar' ? sel.displayHTML_ar : sel.displayHTML_en;

        const del = document.createElement("button");
        del.innerHTML = "&#10005;";
        del.title = lang === 'ar' ? 'حذف' : 'Remove';
        del.style.cssText = "background:none; border:none; cursor:pointer; color:#999; font-size:16px; line-height:1; padding:0 0 0 12px; flex-shrink:0; transition:color .2s;";
        del.addEventListener("mouseenter", () => del.style.color = "#c0392b");
        del.addEventListener("mouseleave", () => del.style.color = "#999");
        del.addEventListener("click", () => removeSelection(sel.isoKey));

        row.appendChild(text);
        row.appendChild(del);
        panel.appendChild(row);
    });
}

function updateContinueButton() {
    const btn = document.getElementById("continue-btn");
    if (!btn) return;
    const count = getSelections().length;
    btn.disabled = count === 0;
    const lang = document.documentElement.getAttribute("lang") || "en";
    const _continueLabels = { en: "Continue", ar: "متابعة" };
    const label = _continueLabels[lang] || _continueLabels["en"];
    btn.innerHTML = `${label}<span class="continue-count">${count > 0 ? " (" + count + ")" : ""}</span>`;
}

function injectSummaryAndContinue() {
    const container = document.getElementById("date-picker-container");
    if (!container || document.getElementById("selection-summary")) return;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "margin-top: 30px; padding-bottom: 20px;";

    const summary = document.createElement("div");
    summary.id = "selection-summary";
    summary.style.cssText = [
        "display:none",
        "background:#f4f6fb",
        "border-radius:10px",
        "padding:18px 20px",
        "margin-bottom:16px",
        "text-align:left",
        "max-width:600px",
        "margin-left:auto",
        "margin-right:auto",
    ].join(";");

    const btn = document.createElement("button");
    btn.id = "continue-btn";
    btn.className = "btn btn-sm btn-primary btn-circle";
    btn.disabled = true;
    btn.style.cssText = "display:block; margin:0 auto;";

    const _continueLabels = { en: "Continue", ar: "متابعة" };
    function _updateContinueLabel() {
        const lang = document.documentElement.getAttribute("lang") || "en";
        const count = getSelections().length;
        const label = _continueLabels[lang] || _continueLabels["en"];
        btn.innerHTML = `${label}<span class="continue-count">${count > 0 ? " (" + count + ")" : ""}</span>`;
    }
    _updateContinueLabel();
    document.addEventListener("langChanged", _updateContinueLabel);

    btn.addEventListener("click", function () {
        if (getSelections().length === 0) return;
        const service = getParams().get("service") || localStorage.getItem("service");
        window.location.href = `booking-review.html?service=${encodeURIComponent(service)}`;
    });

    wrapper.appendChild(summary);
    wrapper.appendChild(btn);
    container.after(wrapper);
}

/** Called by booking-date-time.js after render completes. */
function onDatePickerReady(bookingDateTimeConfig) {
    if (bookingDateTimeConfig) window._bookingDateTimeConfig = bookingDateTimeConfig;
    injectSummaryAndContinue();
    refreshTimeSlotUI();
    renderSummary();
    updateContinueButton();
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

/**
 * Populates step 3 entirely from stored selections.
 * Uses sel.displayHTML directly — no buildLocalizedLabel calls.
 */
function populateBookingForm() {
    const lang = document.documentElement.getAttribute("lang") || "en";

    const params = getParams();
    const service = params.get("service") || localStorage.getItem("service");
    const selections = getSelections();
    const voucher = localStorage.getItem("voucher");

    // Decide which values to use based on language
    let serviceDisplay, categoryDisplay;

    if (lang === "en") {
        serviceDisplay = service || "Not selected";
        categoryDisplay = localStorage.getItem("serviceCategory") || "";
    } else {
        serviceDisplay = localStorage.getItem("serviceDisplay") || service || "غير محدد";
        categoryDisplay = localStorage.getItem("serviceCategoryDisplay") || localStorage.getItem("serviceCategory") || "";
    }

    // Update visible blocks
    const serviceName = document.querySelector(".service-name");
    const serviceBlock = serviceName ? serviceName.closest(".box-contacts-block") : null;

    if (service != "null") {
        if (serviceName) {
            if (categoryDisplay === serviceDisplay) {
                serviceName.textContent = serviceDisplay;
                localStorage.removeItem("serviceCategoryDisplay");
                localStorage.removeItem("serviceCategory");
                categoryDisplay = "";
            } else {
                serviceName.textContent = categoryDisplay == "" ? serviceDisplay : categoryDisplay + " : " + serviceDisplay;
            }
        }

        if (serviceBlock) serviceBlock.style.display = "";
    } else {
        if (serviceBlock) serviceBlock.style.display = "none";
    }

    const voucherName = document.querySelector(".voucher-name");
    const voucherBlock = voucherName ? voucherName.closest(".box-contacts-block") : null;

    if (voucher) {
        if (voucherName) voucherName.textContent = voucher;
        if (voucherBlock) voucherBlock.style.display = "";
    } else {
        if (voucherBlock) voucherBlock.style.display = "none";
    }

    const sorted = [...selections].sort((a, b) => a.isoKey.localeCompare(b.isoKey));
    const dateBlock = document.querySelector(".box-contacts-block:nth-child(3) p");

    if (sorted.length === 1) {
        dateBlock.innerHTML = lang === "en" ? sorted[0].displayHTML_en : sorted[0].displayHTML_ar;
    } else {
        dateBlock.innerHTML = "";
        const ul = document.createElement("ul");
        ul.style.cssText = "list-style: none; padding: 0; margin: 0; text-align: center;";
        sorted.forEach(sel => {
            const li = document.createElement("li");
            li.style.cssText = "margin-bottom: 6px;";
            li.innerHTML = lang === "en" ? sel.displayHTML_en : sel.displayHTML_ar;
            ul.appendChild(li);
        });
        dateBlock.appendChild(ul);
    }

    // Hidden fields for Formspree submission
    const serviceField = document.querySelector("input[name='service']");
    if (serviceField) serviceField.value = serviceDisplay || "";

    const categoryField = document.querySelector("input[name='category']");
    if (categoryField) categoryField.value = categoryDisplay || "";

    const voucherField = document.querySelector("input[name='voucher']");
    if (voucherField) voucherField.value = voucher || "";

    const dateField = document.querySelector("input[name='date']");
    let dateText = "";
    if (dateField) {

        dateText = sorted
            .map(s => {
                const tmp = document.createElement("span");
                tmp.innerHTML = lang === "en" ? s.displayHTML_en : s.displayHTML_ar;
                return tmp.textContent || tmp.innerText || "";
            })
            .join(" | ");
        dateField.value = dateText;
    }

    // Build WhatsApp message text from the same booking data
    window._whatsappMessage = buildWhatsAppMessage({
        lang, categoryDisplay, serviceDisplay, voucher, dateText
    });
}

// ─── WhatsApp checkout ─────────────────────────────────────────────────────────

const SHOP_WHATSAPP_NUMBER = "96170123456"; // TODO: replace with real shop number

function buildWhatsAppMessage({ lang, categoryDisplay, serviceDisplay, voucher, dateText }) {
    const nameInput = document.getElementById("contact-full-name");
    const phoneInput = document.getElementById("contact-phone");
    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";

    if (lang === "ar") {
        let lines = [
            "حجز جديد",
            serviceDisplay && serviceDisplay !== "null"
                ? `الخدمة: ${categoryDisplay ? categoryDisplay + " : " : ""}${serviceDisplay}`
                : null
        ].filter(Boolean);

        if (voucher) lines.push(`القسيمة: ${voucher}`);
        lines.push(`التاريخ: ${dateText || "غير محدد"}`);
        if (name) lines.push(`الاسم: ${name}`);
        if (phone) lines.push(`الهاتف: ${phone}`);

        // WhatsApp supports \n for line breaks
        return lines.join("\r\n");
    }

    let lines = [
        "New Booking",
        serviceDisplay !== "null"
            ? `Service: ${categoryDisplay ? categoryDisplay + " : " : ""}${serviceDisplay}`
            : null
    ].filter(Boolean); // removes null entries;

    if (voucher) lines.push(`Voucher: ${voucher}`);
    lines.push(`Date: ${dateText || "Not selected"}`);
    if (name) lines.push(`Name: ${name}`);
    if (phone) lines.push(`Phone: ${phone}`);
    return lines.join("\n");
}

function sendBookingViaWhatsApp() {
    const lang = document.documentElement.getAttribute("lang") || "en";
    const params = getParams();
    const service = params.get("service") || localStorage.getItem("service");
    const selections = getSelections();

    const voucher = localStorage.getItem("voucher");

    const serviceDisplay = lang === "en"
        ? (service || "Not selected")
        : (localStorage.getItem("serviceDisplay") || service || "غير محدد");
    const categoryDisplay = lang === "en"
        ? (localStorage.getItem("serviceCategory") || "")
        : (localStorage.getItem("serviceCategoryDisplay") || localStorage.getItem("serviceCategory") || "");

    const sorted = [...selections].sort((a, b) => a.isoKey.localeCompare(b.isoKey));
    const dateText = sorted
        .map(s => {
            const tmp = document.createElement("span");
            tmp.innerHTML = lang === "en" ? s.displayHTML_en : s.displayHTML_ar;
            return tmp.textContent || tmp.innerText || "";
        })
        .join(" | ");

    const message = buildWhatsAppMessage({ lang, categoryDisplay, serviceDisplay, voucher, dateText });
    const url = `https://wa.me/${SHOP_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
}

function setupWhatsAppButton() {
    const bookButton = document.querySelector("button[type='submit']");
    if (!bookButton || document.getElementById("whatsapp-checkout-btn")) return;

    const waButton = document.createElement("button");
    waButton.type = "button";
    waButton.id = "whatsapp-checkout-btn";
    waButton.textContent = (document.documentElement.getAttribute("lang") === "ar")
        ? "إرسال عبر واتساب"
        : "Send via WhatsApp";
    waButton.style.cssText = "margin-top: 10px; background-color: #25D366; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; width: 100%;";
    waButton.addEventListener("click", sendBookingViaWhatsApp);

    bookButton.insertAdjacentElement("afterend", waButton);
}

function setupBookingValidation() {
    const nameInput = document.getElementById("contact-full-name");
    const phoneInput = document.getElementById("contact-phone");
    const bookButton = document.querySelector("button[type='submit']");
    const form = document.querySelector("form");
    if (!nameInput || !phoneInput || !bookButton || !form) return;

    function validateForm() {
        const nameValid = nameInput.value.trim().length > 0;
        const phoneValid = /^[0-9]+$/.test(phoneInput.value.trim()) && phoneInput.value.trim().length > 0;
        bookButton.disabled = !(nameValid && phoneValid);
    }

    nameInput.addEventListener("input", validateForm);
    phoneInput.addEventListener("input", validateForm);

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        bookButton.disabled = true;

        // Use translated strings from data-i18n if available, fallback to English
        const lang = document.documentElement.getAttribute("lang") || "en";
        const getI18n = (key, fallback) => {
            const el = document.querySelector(`[data-i18n="${key}"]`);
            return (el && el.textContent.trim()) || fallback;
        };
        bookButton.textContent = getI18n("bookingReview.submitting", "Booking...");

        fetch(form.action, {
            method: form.method,
            body: new FormData(form),
            headers: { 'Accept': 'application/json' }
        }).then(response => {
            if (response.ok) {
                alert(getI18n("bookingReview.successMessage", "Thanks! We will contact you soon."));
                form.reset();
                localStorage.removeItem("selectedDates");
                localStorage.removeItem("service");
                localStorage.removeItem("serviceDisplay");
                localStorage.removeItem("serviceCategory");
                localStorage.removeItem("serviceCategoryDisplay");
                localStorage.removeItem("selectedDate");
                localStorage.removeItem("selectedTime");
                localStorage.removeItem("voucher");
            } else {
                alert(getI18n("bookingReview.errorMessage", "Oops! Something went wrong."));
            }
            bookButton.textContent = getI18n("bookingReview.submitButton", "Book now");
            bookButton.disabled = false;
            window.location.href = "index.html";
        });
    });

    validateForm();
}

// ─── DOMContentLoaded ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
    const path = window.location.pathname;

    if (path.endsWith("index.html") || path === "/") {
        localStorage.removeItem("selectedDates");
        localStorage.removeItem("service");
        localStorage.removeItem("serviceDisplay");
        localStorage.removeItem("serviceCategory");
        localStorage.removeItem("serviceCategoryDisplay");
        localStorage.removeItem("selectedDate");
        localStorage.removeItem("selectedTime");
        localStorage.removeItem("voucher");
        if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    if (path.endsWith("booking-date-time.html") || path.endsWith("booking-date-time")) {
        // Guard: service must have been set by chooseService() in services.html.
        // Covers both the URL param and localStorage — either is enough.
        const service = getParams().get("service") || localStorage.getItem("service");

        if (!service) {
            localStorage.removeItem("selectedDates");
            // window.location.replace("services.html");
            return;
        }

        // Keep localStorage in sync with URL param (in case only param is present)
        localStorage.setItem("service", service);
    }

    if (path.endsWith("booking-review.html") || path.endsWith("checkout")) {
        // Guard: must have a service and at least one valid selection.
        // A user typing the URL directly will have neither, so redirect them.
        const service = getParams().get("service") || localStorage.getItem("service");
        const selections = getSelections();
        const valid = service && selections.length > 0 && selections.every(s => s.isoKey && s.time && s.displayHTML_en);

        if (!valid) {
            // Clear any partial state and send them back to the start
            localStorage.removeItem("service");
            localStorage.removeItem("selectedDates");
            window.location.replace("services.html");
            return;
        }

        populateBookingForm();
        setupBookingValidation();
        // setupWhatsAppButton();
    }
});