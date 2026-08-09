(function () {
    var faqData = null;

    function renderFaq(lang) {
        if (!faqData) return;

        // Title & description
        var descEl = document.getElementById('faq-description');
        if (descEl) descEl.textContent = faqData['description-' + lang] || faqData['description-en'];

        // FAQ list
        var faqList = document.getElementById('faq-list');
        if (!faqList) return;
        faqList.innerHTML = '';

        faqData.faq.forEach(function (item) {
            var dt = document.createElement('dt');
            dt.textContent = item['question-' + lang] || item['question-en'];

            var dd = document.createElement('dd');
            dd.textContent = item['answer-' + lang] || item['answer-en'];

            faqList.appendChild(dt);
            faqList.appendChild(dd);
        });
    }

    // Load data once, then render in current language
    document.addEventListener('DOMContentLoaded', function () {
        fetch('assets/data/faq.json')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                faqData = data;
                var lang = document.documentElement.getAttribute('lang') || localStorage.getItem('siteLang') || 'en';
                renderFaq(lang);
            })
            .catch(function (err) { console.error('Error loading FAQ:', err); });
    });

    // Re-render whenever language.js switches language
    document.addEventListener('langChanged', function (e) {
        renderFaq(e.detail.lang);
    });
})();