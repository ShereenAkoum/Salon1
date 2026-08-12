(function () {
  'use strict';

  var state = { customers: [], editingCustomerId: null, selectedCustomerId: null, categories: [], services: [], vouchers: [], users: [], appSettings: [], bookings: [], bookingFilter: 'all', bookingDateFilter: 'all', bookingSearch: '', bookingVouchers: [], bookingView: 'list', scheduleDate: new Date(), editingServiceId: null, editingCategoryId: null, editingVoucherId: null, editingUserId: null, editingFaqId: null, faqs: [], faqSettings: null, currentView: 'dashboard', currentRole: null, currentUserId: null };
  var CRM_INVITE_REDIRECT = window.location.origin + window.location.pathname + '?invite=1';

  function $(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function message(text, type) {
    var el = $('app-message') || $('login-message');
    if (!el) return;
    el.textContent = text; el.className = 'crm-message show ' + (type || 'success');
  }
  function clearMessage() {
    ['app-message','login-message'].forEach(function(id){ var el=$(id); if(el){el.textContent='';el.className='crm-message';} });
  }
  async function getCurrentRole() {
    var sessionResult = await window.salonSupabase.auth.getSession();
    if (!sessionResult.data.session) return null;
    var result = await window.salonSupabase
      .from('admin_users')
      .select('role,active')
      .eq('user_id', sessionResult.data.session.user.id)
      .maybeSingle();
    if (result.error || !result.data || result.data.active === false) return null;
    return result.data.role || 'staff';
  }

  async function requireAdmin() {
    var role = await getCurrentRole();
    state.currentRole = role;
    return !!role;
  }


  async function loadCustomers() {
    var result = await window.salonSupabase
      .from('customers')
      .select('id,name,phone,email,notes,created_at')
      .order('id', {ascending:false});
    if (result.error) throw result.error;
    state.customers = result.data || [];
    renderCustomers();
    $('stat-customers') && ($('stat-customers').textContent=String(state.customers.length));
  }

  function renderCustomers() {
    var tbody = $('customers-table-body');
    if (!tbody) return;
    var q = (($('customer-search') && $('customer-search').value) || '').trim().toLowerCase();
    var rows = state.customers.filter(function(c) {
      return !q ||
        String(c.name||'').toLowerCase().includes(q) ||
        String(c.phone||'').toLowerCase().includes(q) ||
        String(c.email||'').toLowerCase().includes(q);
    });

    tbody.innerHTML = rows.map(function(c) {
      return '<tr>' +
        '<td><strong>'+escapeHtml(c.name||'—')+'</strong></td>' +
        '<td>'+escapeHtml(c.phone||'—')+'</td>' +
        '<td>'+escapeHtml(c.email||'—')+'</td>' +
        '<td>'+escapeHtml(c.notes||'—')+'</td>' +
        '<td><button type="button" class="crm-btn crm-btn-secondary crm-btn-sm" onclick="viewCustomer('+Number(c.id)+')">View</button> ' +
        '<button type="button" class="crm-btn crm-btn-secondary crm-btn-sm" onclick="editCustomer('+Number(c.id)+')">Edit</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="5" class="crm-empty">No customers found.</td></tr>';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[ch];
    });
  }

  function startCustomerCreate() {
    state.editingCustomerId = null;
    $('customer-form').reset();
    $('customer-form-title').textContent = 'Add customer';
    $('customer-form-card').classList.remove('crm-hidden');
    $('customer-name').focus();
  }

  function editCustomer(id) {
    var c = state.customers.find(function(x){ return String(x.id) === String(id); });
    if (!c) return;
    state.editingCustomerId = c.id;
    $('customer-name').value = c.name || '';
    $('customer-phone').value = c.phone || '';
    $('customer-email').value = c.email || '';
    $('customer-notes').value = c.notes || '';
    $('customer-form-title').textContent = 'Edit customer';
    $('customer-form-card').classList.remove('crm-hidden');
    $('customer-name').focus();
  }

  async function saveCustomer(e) {
    e.preventDefault();
    clearMessage();
    var payload = {
      name: $('customer-name').value.trim(),
      phone: $('customer-phone').value.trim() || null,
      email: $('customer-email').value.trim() || null,
      notes: $('customer-notes').value.trim() || null
    };
    if (!payload.name) {
      message('Please enter the customer name.','error');
      return;
    }

    var result;
    if (state.editingCustomerId) {
      result = await window.salonSupabase.from('customers')
        .update(payload).eq('id', state.editingCustomerId);
    } else {
      result = await window.salonSupabase.from('customers').insert(payload);
    }
    if (result.error) {
      message(result.error.message,'error');
      return;
    }
    message(state.editingCustomerId ? 'Customer updated.' : 'Customer added.','success');
    state.editingCustomerId = null;
    $('customer-form-card').classList.add('crm-hidden');
    await loadCustomers();
  }

  function cancelCustomerEdit() {
    state.editingCustomerId = null;
    $('customer-form-card').classList.add('crm-hidden');
  }

  async function viewCustomer(id) {
    var c = state.customers.find(function(x){ return String(x.id) === String(id); });
    if (!c) return;
    state.selectedCustomerId = c.id;
    $('customer-detail-name').textContent = c.name || 'Customer';
    $('customer-detail-contact').textContent = [c.phone, c.email].filter(Boolean).join(' • ') || 'No contact information';
    $('customer-detail-notes').textContent = c.notes || 'No notes.';
    $('customer-detail-card').classList.remove('crm-hidden');

    var results = await Promise.all([
      window.salonSupabase
        .from('bookings')
        .select('id,booking_date,start_time,end_time,status,total_price,total_duration_minutes,customer_notes')
        .eq('customer_id', c.id)
        .order('booking_date', {ascending:false})
        .order('start_time', {ascending:false}),
      window.salonSupabase
        .from('booking_services')
        .select('id,booking_id,service_id,start_time,end_time,price,duration_minutes,voucher_id')
        .order('start_time', {ascending:true})
    ]);

    if (results[0].error) {
      message(results[0].error.message,'error');
      return;
    }
    if (results[1].error) {
      message(results[1].error.message,'error');
      return;
    }

    var bookings = results[0].data || [];
    var bookingServices = results[1].data || [];
    var servicesById = {};
    state.services.forEach(function(service){ servicesById[String(service.id)] = service; });
    var vouchersById = {};
    state.vouchers.forEach(function(voucher){ vouchersById[String(voucher.id)] = voucher; });
    var itemsByBooking = {};

    bookingServices.forEach(function(bs) {
      var key = String(bs.booking_id);
      if (!itemsByBooking[key]) itemsByBooking[key] = [];
      itemsByBooking[key].push(bs);
    });

    $('customer-booking-count').textContent = bookings.length;
    var total = bookings.reduce(function(sum,b){ return sum + Number(b.total_price||0); },0);
    $('customer-total-spent').textContent = total.toFixed(2);

    $('customer-booking-history').innerHTML = bookings.map(function(b){
      var names=(itemsByBooking[String(b.id)]||[]).map(function(bs){
        if (bs.voucher_id != null) {
          var voucher = vouchersById[String(bs.voucher_id)];
          return voucher ? (voucher.title_en || voucher.title || 'Voucher') : 'Voucher';
        }
        var service = bs.service_id != null ? servicesById[String(bs.service_id)] : null;
        return service ? (service.name_en || service.name || 'Service') : 'Service';
      }).join(', ');

      return '<tr><td>'+escapeHtml(b.booking_date||'—')+'</td><td>'+escapeHtml((b.start_time||'')+' – '+(b.end_time||''))+'</td><td>'+escapeHtml(names||'—')+'</td><td>'+escapeHtml(b.status||'—')+'</td><td>'+Number(b.total_price||0).toFixed(2)+'</td></tr>';
    }).join('') || '<tr><td colspan="5" class="crm-empty">No bookings yet.</td></tr>';
  }

  function closeCustomerDetails() {
    state.selectedCustomerId = null;
    $('customer-detail-card').classList.add('crm-hidden');
  }

  function isCrmAdmin() {
    return state.currentRole === 'admin';
  }

  function settingValue(key, fallback) {
    var row = state.appSettings.find(function(x){ return x.setting_key === key && x.active !== false; });
    if (!row) return fallback;
    return row.setting_value;
  }

  function normalizeCurrencyOptions(value) {
    var options = value;
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch (e) { options = {}; }
    }
    if (!options || typeof options !== 'object' || Array.isArray(options)) options = {};
    return options;
  }

  function currencyOptionRows() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-currency-row]'));
  }

  function renderCurrencyOptions(options) {
    options = normalizeCurrencyOptions(options);
    var container = $('currency-options-list');
    if (!container) return;

    var codes = Object.keys(options);
    if (!codes.length) {
      container.innerHTML = '<div class="crm-settings-empty">No currencies configured yet. Add one below.</div>';
      return;
    }

    container.innerHTML = codes.map(function(code) {
      var item = options[code] || {};
      var safeCode = escapeHtml(String(code).toUpperCase());
      return '<div class="crm-currency-row" data-currency-row data-code="'+safeCode+'">'+
        '<div class="crm-currency-code">'+
          '<span class="crm-currency-symbol">'+escapeHtml((item.en || item.ar || String(code).charAt(0)).toString().slice(0,2))+'</span>'+
          '<div><strong>'+safeCode+'</strong><small>Currency code</small></div>'+
        '</div>'+
        '<div class="crm-field">'+
          '<label>English label</label>'+
          '<input type="text" data-currency-en value="'+escapeHtml(item.en || '')+'" placeholder="$ or USD">'+
        '</div>'+
        '<div class="crm-field">'+
          '<label>Arabic label</label>'+
          '<input type="text" data-currency-ar value="'+escapeHtml(item.ar || '')+'" placeholder="ريال or $">'+
        '</div>'+
        '<button type="button" class="crm-icon-btn crm-remove-currency" title="Remove '+safeCode+'" aria-label="Remove '+safeCode+'">×</button>'+
      '</div>';
    }).join('');

    bindCurrencyRowEvents();
  }

  function bindCurrencyRowEvents() {
    currencyOptionRows().forEach(function(row) {
      var remove = row.querySelector('.crm-remove-currency');
      if (remove) {
        remove.addEventListener('click', function() {
          var rows = currencyOptionRows();
          if (rows.length <= 1) {
            message('Keep at least one currency configured.','error');
            return;
          }
          row.remove();
        });
      }
    });
  }

  function addCurrencyOption() {
    var container = $('currency-options-list');
    if (!container) return;
    if (container.querySelector('.crm-settings-empty')) container.innerHTML = '';

    var existingCodes = currencyOptionRows().map(function(row) {
      return row.getAttribute('data-code') || '';
    });
    var code = 'NEW';
    var n = 1;
    while (existingCodes.indexOf(code) !== -1) {
      code = 'NEW' + n++;
    }

    var row = document.createElement('div');
    row.className = 'crm-currency-row';
    row.setAttribute('data-currency-row', '');
    row.setAttribute('data-code', code);
    row.innerHTML =
      '<div class="crm-currency-code crm-currency-code-edit">'+
        '<input type="text" data-currency-code value="'+code+'" maxlength="5" aria-label="Currency code" placeholder="USD">'+
        '<small>3-letter code</small>'+
      '</div>'+
      '<div class="crm-field">'+
        '<label>English label</label>'+
        '<input type="text" data-currency-en placeholder="$ or USD">'+
      '</div>'+
      '<div class="crm-field">'+
        '<label>Arabic label</label>'+
        '<input type="text" data-currency-ar placeholder="ريال or $">'+
      '</div>'+
      '<button type="button" class="crm-icon-btn crm-remove-currency" title="Remove currency" aria-label="Remove currency">×</button>';

    container.appendChild(row);
    bindCurrencyRowEvents();
    var codeInput = row.querySelector('[data-currency-code]');
    if (codeInput) {
      codeInput.focus();
      codeInput.select();
      codeInput.addEventListener('input', function() {
        row.setAttribute('data-code', codeInput.value.trim().toUpperCase());
      });
    }
  }

  function collectCurrencyOptions() {
    var options = {};
    var rows = currencyOptionRows();

    rows.forEach(function(row) {
      var codeInput = row.querySelector('[data-currency-code]');
      var code = codeInput
        ? codeInput.value.trim().toUpperCase()
        : String(row.getAttribute('data-code') || '').trim().toUpperCase();
      var en = row.querySelector('[data-currency-en]').value.trim();
      var ar = row.querySelector('[data-currency-ar]').value.trim();

      if (!code) throw new Error('Every currency needs a currency code.');
      if (!/^[A-Z]{3,5}$/.test(code)) throw new Error('Currency code "'+code+'" must use 3–5 letters.');
      if (!en || !ar) throw new Error('Please enter both English and Arabic labels for '+code+'.');
      if (options[code]) throw new Error('Currency '+code+' is listed more than once.');

      options[code] = {en: en, ar: ar};
    });

    return options;
  }

  async function loadApplicationSettings() {
    var result = await window.salonSupabase
      .from('application_settings')
      .select('id,setting_key,setting_value,description,active,created_at,updated_at')
      .order('setting_key', {ascending:true});
    if (result.error) throw result.error;
    state.appSettings = result.data || [];
    renderApplicationSettings();
  }

  function renderApplicationSettings() {
    var currency = settingValue('display_currency', 'USD');
    var options = normalizeCurrencyOptions(settingValue('currency_options', {
      USD: {en:'$', ar:'$'},
      QAR: {en:'QAR', ar:'ريال'}
    }));
    var language = settingValue('default_language', 'en');
    var contactPhone = settingValue('contact_phone', '+1 234 567 890');

    var currencySelect = $('app-setting-currency');
    var languageSelect = $('app-setting-language');
    if (currencySelect) {
      var codes = Object.keys(options);
      currencySelect.innerHTML = codes.map(function(code) {
        var item = options[code] || {};
        return '<option value="'+escapeHtml(code)+'">'+escapeHtml(code)+' — '+escapeHtml(item.en || item.ar || '')+'</option>';
      }).join('');
      currencySelect.value = String(currency || 'USD').toUpperCase();
      if (!currencySelect.value && codes.length) currencySelect.value = codes[0];
    }
    if (languageSelect) languageSelect.value = String(language || 'en').toLowerCase();
    var phoneInput = $('app-setting-contact-phone');
    if (phoneInput) phoneInput.value = String(contactPhone || '').trim();

    renderCurrencyOptions(options);

    var status = $('app-settings-status');
    if (status) status.textContent = 'Synced with Supabase';
  }

  async function saveApplicationSettings(e) {
    e.preventDefault();
    clearMessage();
    if (!isCrmAdmin()) {
      message('Only administrators can manage application settings.','error');
      return;
    }

    var currency = $('app-setting-currency').value.trim().toUpperCase();
    var language = $('app-setting-language').value.trim().toLowerCase();
    var contactPhone = $('app-setting-contact-phone').value.trim();
    var options;

    if (!currency || !language || !contactPhone) {
      message('Please complete the currency, language and contact phone settings.','error');
      return;
    }
    if (language !== 'en' && language !== 'ar') {
      message('Default language must be English or Arabic.','error');
      return;
    }

    try {
      options = collectCurrencyOptions();
    } catch (err) {
      message(err.message,'error');
      return;
    }

    if (!options[currency]) {
      message('The display currency must be one of the configured currencies.','error');
      return;
    }

    var settings = [
      {key:'display_currency', value:currency, description:'Default website display currency.'},
      {key:'currency_options', value:options, description:'Currency labels by currency and language.'},
      {key:'default_language', value:language, description:'Default website language for new visitors.'},
      {key:'contact_phone', value:contactPhone, description:'Public contact phone number used across the website.'}
    ];

    var button = $('save-application-settings');
    if (button) { button.disabled = true; button.textContent = 'Saving…'; }

    try {
      for (var i=0; i<settings.length; i++) {
        var s = settings[i];
        var result = await window.salonSupabase
          .from('application_settings')
          .upsert({
            setting_key: s.key,
            setting_value: s.value,
            description: s.description,
            active: true,
            updated_at: new Date().toISOString()
          }, {onConflict:'setting_key'});
        if (result.error) {
          message(result.error.message,'error');
          return;
        }
      }

      message('Application settings saved.','success');
      await loadApplicationSettings();
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Save Settings'; }
    }
  }


  async function loadFaqs() {
    if (!isCrmAdmin()) {
      state.faqs = [];
      state.faqSettings = null;
      return;
    }
    var settingsResult = await window.salonSupabase
      .from('faq_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (settingsResult.error) throw settingsResult.error;
    var faqResult = await window.salonSupabase
      .from('faqs')
      .select('*')
      .order('sort_order', {ascending:true})
      .order('id', {ascending:true});
    if (faqResult.error) throw faqResult.error;

    state.faqSettings = settingsResult.data || null;
    state.faqs = faqResult.data || [];
    renderFaqSettings();
    renderFaqs();
  }

  function renderFaqSettings() {
    var s = state.faqSettings || {};
    if ($('faq-settings-title-en')) $('faq-settings-title-en').value = s.title_en || '';
    if ($('faq-settings-title-ar')) $('faq-settings-title-ar').value = s.title_ar || '';
    if ($('faq-settings-description-en')) $('faq-settings-description-en').value = s.description_en || '';
    if ($('faq-settings-description-ar')) $('faq-settings-description-ar').value = s.description_ar || '';
    if ($('faq-settings-active')) $('faq-settings-active').checked = s.active !== false;
  }

  function renderFaqs() {
    var tbody = $('faq-table-body');
    if (!tbody) return;
    tbody.innerHTML = state.faqs.map(function(f) {
      var answer = String(f.answer_en || '');
      if (answer.length > 150) answer = answer.slice(0,147) + '…';
      return '<tr>' +
        '<td><strong>'+escapeHtml(f.question_en || '—')+'</strong><br><span class="crm-small" dir="rtl">'+escapeHtml(f.question_ar || '')+'</span></td>' +
        '<td>'+escapeHtml(answer || '—')+'</td>' +
        '<td>'+Number(f.sort_order || 0)+'</td>' +
        '<td>'+(f.active ? '<span class="crm-badge active">Active</span>' : '<span class="crm-badge inactive">Inactive</span>')+'</td>' +
        '<td><button type="button" class="crm-btn crm-btn-secondary crm-btn-sm" data-edit-faq="'+f.id+'">Edit</button> ' +
        '<button type="button" class="crm-btn crm-btn-danger crm-btn-sm" data-delete-faq="'+f.id+'">Delete</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="5" class="crm-empty">No FAQs found.</td></tr>';
  }

  function resetFaqForm() {
    state.editingFaqId = null;
    if (!$('faq-form')) return;
    $('faq-form').reset();
    $('faq-form-title').textContent = 'Add FAQ';
    $('faq-sort-order').value = state.faqs.length ? String(Math.max.apply(null, state.faqs.map(function(f){ return Number(f.sort_order)||0; })) + 1) : '1';
    $('faq-active').checked = true;
    $('faq-form-card').classList.add('crm-hidden');
  }

  function startFaqCreate() {
    resetFaqForm();
    $('faq-form-card').classList.remove('crm-hidden');
    $('faq-question-en').focus();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function editFaq(id) {
    var f = state.faqs.find(function(x){ return String(x.id) === String(id); });
    if (!f) return;
    state.editingFaqId = f.id;
    $('faq-question-en').value = f.question_en || '';
    $('faq-question-ar').value = f.question_ar || '';
    $('faq-answer-en').value = f.answer_en || '';
    $('faq-answer-ar').value = f.answer_ar || '';
    $('faq-sort-order').value = Number(f.sort_order || 0);
    $('faq-active').checked = f.active !== false;
    $('faq-form-title').textContent = 'Edit FAQ';
    $('faq-form-card').classList.remove('crm-hidden');
    $('faq-question-en').focus();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function saveFaq(e) {
    e.preventDefault();
    clearMessage();
    var payload = {
      question_en: $('faq-question-en').value.trim(),
      question_ar: $('faq-question-ar').value.trim() || null,
      answer_en: $('faq-answer-en').value.trim(),
      answer_ar: $('faq-answer-ar').value.trim() || null,
      sort_order: Math.max(0, parseInt($('faq-sort-order').value,10) || 0),
      active: $('faq-active').checked
    };
    if (!payload.question_en || !payload.answer_en) {
      message('English question and answer are required.','error');
      return;
    }
    var result;
    if (state.editingFaqId) {
      result = await window.salonSupabase.from('faqs')
        .update(payload)
        .eq('id', state.editingFaqId)
        .select()
        .maybeSingle();
    } else {
      result = await window.salonSupabase.from('faqs')
        .insert(payload)
        .select()
        .maybeSingle();
    }
    if (result.error) {
      message(result.error.message,'error');
      return;
    }
    if (!result.data) {
      message('FAQ could not be saved. Check that your CRM account is an admin and that FAQ RLS policies are installed.','error');
      return;
    }
    message(state.editingFaqId ? 'FAQ updated.' : 'FAQ added.','success');
    resetFaqForm();
    await loadFaqs();
  }

  async function saveFaqSettings(e) {
    e.preventDefault();
    clearMessage();
    var payload = {
      id: 1,
      title_en: $('faq-settings-title-en').value.trim(),
      title_ar: $('faq-settings-title-ar').value.trim() || null,
      description_en: $('faq-settings-description-en').value.trim() || null,
      description_ar: $('faq-settings-description-ar').value.trim() || null,
      active: $('faq-settings-active').checked
    };
    if (!payload.title_en) {
      message('Please enter the English FAQ title.','error');
      return;
    }
    var result = await window.salonSupabase.from('faq_settings')
      .upsert(payload, {onConflict:'id'})
      .select()
      .maybeSingle();
    if (result.error) {
      message(result.error.message,'error');
      return;
    }
    if (!result.data) {
      message('FAQ page settings could not be saved. Check FAQ settings RLS.','error');
      return;
    }
    message('FAQ page settings saved.','success');
    await loadFaqs();
  }

  async function deleteFaq(id) {
    var f = state.faqs.find(function(x){ return String(x.id) === String(id); });
    if (!f || !window.confirm('Delete this FAQ? This cannot be undone.')) return;
    var result = await window.salonSupabase.from('faqs').delete().eq('id', id);
    if (result.error) {
      message(result.error.message,'error');
      return;
    }
    message('FAQ deleted.','success');
    await loadFaqs();
  }

  async function loadData() {
    var cats = await window.salonSupabase.from('service_categories').select('*').order('sort_order',{ascending:true});
    if (cats.error) throw cats.error;
    var services = await window.salonSupabase.from('services').select('*').order('sort_order',{ascending:true});
    if (services.error) throw services.error;
    var vouchers = await window.salonSupabase.from('vouchers').select('*');
    if (vouchers.error) throw vouchers.error;

    state.categories=cats.data||[];
    state.services=services.data||[];
    state.vouchers=(vouchers.data||[]).slice().sort(function(a,b){
      var ao = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 0;
      var bo = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;
      if (ao !== bo) return ao - bo;
      var ad = a.created_at ? new Date(a.created_at).getTime() : 0;
      var bd = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bd - ad;
    });
    state.bookingVouchers=state.vouchers.slice();

    renderCategories();
    renderServices();
    renderVouchers();
    populateCategorySelect();
    updateDashboard();
  }
  async function loadUsers() {
    if (!isCrmAdmin()) {
      state.users = [];
      $('stat-users') && ($('stat-users').textContent='—');
      return;
    }
    var result = await window.salonSupabase.from('admin_users').select('*').order('created_at',{ascending:true});
    if (result.error) throw result.error;
    state.users=result.data||[]; renderUsers();
    $('stat-users') && ($('stat-users').textContent=state.users.length);
    $('stat-bookings') && ($('stat-bookings').textContent=state.bookings.length);
  }
  function categoryName(id) { var c=state.categories.find(function(x){return String(x.id)===String(id);}); return c?c.name_en:'—'; }

  function renderCategories() {
    $('category-table-body').innerHTML=state.categories.map(function(c){
      return '<tr><td><strong>'+escapeHtml(c.name_en)+'</strong><br><span class="crm-small">'+escapeHtml(c.name_ar)+'</span></td>'+
      '<td>'+escapeHtml(c.image_url||'')+'</td><td>'+escapeHtml(c.image_width||'')+' × '+escapeHtml(c.image_height||'')+'</td>'+
      '<td>'+(c.active?'<span class="crm-badge active">Active</span>':'<span class="crm-badge inactive">Inactive</span>')+'</td>'+
      '<td><button class="crm-btn crm-btn-secondary" data-edit-category="'+c.id+'">Edit</button></td></tr>';
    }).join('');
  }
  function renderServices() {
    $('service-table-body').innerHTML=state.services.map(function(s){
      return '<tr><td>'+escapeHtml(s.sku||'')+'</td><td><strong>'+escapeHtml(s.name_en)+'</strong><br><span class="crm-small">'+escapeHtml(s.name_ar)+'</span></td>'+
      '<td>'+escapeHtml(categoryName(s.category_id))+'</td><td class="crm-price">$'+escapeHtml(s.price_usd==null?'':s.price_usd)+'<br><span class="crm-price-muted">'+(s.price_qar==null?'—':escapeHtml(s.price_qar)+' QAR')+'</span></td>'+
      '<td>'+(s.duration_minutes==null?'—':escapeHtml(s.duration_minutes)+' min')+'</td><td>'+(s.active?'<span class="crm-badge active">Active</span>':'<span class="crm-badge inactive">Inactive</span>')+'</td>'+
      '<td><button class="crm-btn crm-btn-secondary" data-edit-service="'+s.id+'">Edit</button></td></tr>';
    }).join('');
  }
  function voucherImageUrl(v) {
    if (!v || !v.image_path) return '';
    if (/^https?:\/\//i.test(String(v.image_path))) return String(v.image_path);
    if (window.salonDatabase && typeof window.salonDatabase.getVoucherImageUrl === 'function') {
      return window.salonDatabase.getVoucherImageUrl(v.image_path);
    }
    return '';
  }

  function renderVouchers() {
    var tbody = $('voucher-table-body');
    if (!tbody) return;

    tbody.innerHTML = state.vouchers.map(function(v) {
      var image = voucherImageUrl(v);
      var title = v.title_en || v.title || 'Voucher';
      var arabic = v.title_ar || '';
      var prices = [];
      if (v.price_usd != null) prices.push('$' + v.price_usd);
      if (v.price_qar != null) prices.push(v.price_qar + ' QAR');

      return '<tr>' +
        '<td><div class="crm-voucher-thumb">' +
          (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '">' : '<span>◇</span>') +
        '</div></td>' +
        '<td><strong>' + escapeHtml(v.sku || '') + '</strong></td>' +
        '<td><strong>' + escapeHtml(title) + '</strong>' +
          (arabic ? '<br><span class="crm-small">' + escapeHtml(arabic) + '</span>' : '') +
        '</td>' +
        '<td>' + escapeHtml(prices.join(' · ') || '—') + '</td>' +
        '<td>' + escapeHtml(v.duration_minutes || 30) + ' min</td>' +
        '<td>' + (v.active !== false ? '<span class="crm-badge active">Active</span>' : '<span class="crm-badge inactive">Inactive</span>') + '</td>' +
        '<td><div class="crm-actions-inline">' +
          '<button type="button" class="crm-btn crm-btn-secondary crm-btn-small" data-edit-voucher="' + escapeHtml(v.id) + '">Edit</button>' +
          '<button type="button" class="crm-btn crm-btn-danger crm-btn-small" data-delete-voucher="' + escapeHtml(v.id) + '">Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="7" class="crm-empty">No vouchers found.</td></tr>';
  }

  function resetVoucherForm() {
    state.editingVoucherId = null;
    var form = $('voucher-form');
    if (form) form.reset();
    $('voucher-form-title').textContent = 'Add Voucher';
    $('voucher-save').textContent = 'Add Voucher';
    $('voucher-active').checked = true;
    $('voucher-duration').value = 30;
    $('voucher-current-image').innerHTML = '<div class="crm-image-empty">No image uploaded</div>';
    $('voucher-image-file').value = '';
    $('voucher-image-delete').classList.add('crm-hidden');
  }

  function editVoucher(id) {
    var v = state.vouchers.find(function(x){ return String(x.id) === String(id); });
    if (!v) return;

    state.editingVoucherId = v.id;
    $('voucher-form-title').textContent = 'Edit Voucher';
    $('voucher-save').textContent = 'Save Changes';
    $('voucher-sku').value = v.sku || '';
    $('voucher-title-en').value = v.title_en || v.title || '';
    $('voucher-title-ar').value = v.title_ar || '';
    $('voucher-price-usd').value = v.price_usd == null ? '' : v.price_usd;
    $('voucher-price-qar').value = v.price_qar == null ? '' : v.price_qar;
    $('voucher-duration').value = v.duration_minutes || 30;
    $('voucher-active').checked = v.active !== false;
    $('voucher-image-file').value = '';

    var image = voucherImageUrl(v);
    $('voucher-current-image').innerHTML = image
      ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(v.title_en || 'Voucher') + '"><span>Current image</span>'
      : '<div class="crm-image-empty">No image uploaded</div>';
    $('voucher-image-delete').classList.toggle('crm-hidden', !v.image_path);

    $('voucher-form-card').classList.remove('crm-hidden');
    $('voucher-title-en').focus();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function getVoucherFileExtension(file) {
    var name = file && file.name ? file.name : '';
    var match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
    var ext = match ? match[1] : 'jpg';
    return ['jpg','jpeg','png','webp','gif','avif'].indexOf(ext) >= 0 ? ext : 'jpg';
  }

  async function uploadVoucherImage(voucherId, file) {
    if (!file) return null;
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type || '')) {
      throw new Error('Please choose a JPG, PNG, WebP, GIF or AVIF image.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Voucher images must be 5 MB or smaller.');
    }

    var ext = getVoucherFileExtension(file);
    var token = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    var path = String(voucherId) + '/' + token + '.' + ext;

    var upload = await window.salonSupabase.storage
      .from('vouchers')
      .upload(path, file, {upsert:false, contentType:file.type || 'image/jpeg', cacheControl:'3600'});
    if (upload.error) throw upload.error;

    return path;
  }

  async function deleteVoucherStorageImage(imagePath) {
    if (!imagePath || /^https?:\/\//i.test(String(imagePath)) || /^assets\//i.test(String(imagePath))) return;
    var result = await window.salonSupabase.storage.from('vouchers').remove([String(imagePath)]);
    if (result.error) throw result.error;
  }

  function previewVoucherImageFile() {
    var file = $('voucher-image-file').files[0];
    var preview = $('voucher-current-image');
    if (!file) return;

    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type || '')) {
      preview.innerHTML = '<div class="crm-image-empty">Unsupported image type</div>';
      return;
    }

    var url = URL.createObjectURL(file);
    preview.innerHTML = '<img src="' + escapeHtml(url) + '" alt="New voucher image"><span>New image</span>';
  }

  async function saveVoucher(e) {
    e.preventDefault();
    clearMessage();

    var payload = {
      sku: $('voucher-sku').value.trim(),
      title_en: $('voucher-title-en').value.trim(),
      title_ar: $('voucher-title-ar').value.trim() || null,
      price_usd: $('voucher-price-usd').value === '' ? null : Number($('voucher-price-usd').value),
      price_qar: $('voucher-price-qar').value === '' ? null : Number($('voucher-price-qar').value),
      duration_minutes: Math.max(1, Number($('voucher-duration').value || 30)),
      active: $('voucher-active').checked
    };

    if (!payload.sku || !payload.title_en) {
      message('Please enter the voucher SKU and English title.', 'error');
      return;
    }

    var file = $('voucher-image-file').files[0] || null;
    var existing = state.editingVoucherId
      ? state.vouchers.find(function(v){ return String(v.id) === String(state.editingVoucherId); })
      : null;

    var button = $('voucher-save');
    button.disabled = true;
    button.textContent = 'Saving…';

    try {
      var saved;

      if (state.editingVoucherId) {
        /*
         * Do not rely on UPDATE ... SELECT returning the row.
         * PostgREST can legally return an empty representation even when the
         * UPDATE itself succeeded (especially with an older/legacy table and
         * multiple RLS SELECT policies). We have already verified admin access
         * separately, so perform the write first and then read the row back.
         */
        var updateResult = await window.salonSupabase
          .from('vouchers')
          .update(payload)
          .eq('id', state.editingVoucherId);

        if (updateResult.error) throw updateResult.error;

        var fetchResult = await window.salonSupabase
          .from('vouchers')
          .select('*')
          .eq('id', state.editingVoucherId)
          .maybeSingle();

        if (fetchResult.error) throw fetchResult.error;

        if (!fetchResult.data) {
          throw new Error(
            'The voucher update was accepted, but the updated row could not be read back. Check that the voucher ID still exists and that the CRM SELECT policy allows this admin to read it.'
          );
        }

        saved = fetchResult.data;
      } else {
        var insertResult = await window.salonSupabase
          .from('vouchers')
          .insert(payload);

        if (insertResult.error) throw insertResult.error;

        var fetchInserted = await window.salonSupabase
          .from('vouchers')
          .select('*')
          .eq('sku', payload.sku)
          .maybeSingle();

        if (fetchInserted.error) throw fetchInserted.error;

        if (!fetchInserted.data) {
          throw new Error(
            'The voucher was created, but the new row could not be read back. Check the CRM SELECT policy.'
          );
        }

        saved = fetchInserted.data;
      }
      var oldImage = existing && existing.image_path ? existing.image_path : null;

      if (file) {
        // Storage upload and the database reference are two separate writes.
        // PostgREST can return no error when an UPDATE matches zero rows, so
        // request the updated row and verify that the image_path was actually
        // written before reporting success.
        var newPath = await uploadVoucherImage(saved.id, file);
        var imageUpdate = await window.salonSupabase
          .from('vouchers')
          .update({image_path:newPath})
          .eq('id', saved.id)
          .select('id, image_path')
          .maybeSingle();

        if (imageUpdate.error) {
          try { await deleteVoucherStorageImage(newPath); } catch (_) {}
          throw imageUpdate.error;
        }

        if (!imageUpdate.data || imageUpdate.data.image_path !== newPath) {
          try { await deleteVoucherStorageImage(newPath); } catch (_) {}
          throw new Error(
            'The image uploaded to Supabase Storage, but the voucher record could not be updated with the image path. Check the vouchers UPDATE RLS policy.'
          );
        }

        if (oldImage && oldImage !== newPath) {
          try {
            await deleteVoucherStorageImage(oldImage);
          } catch (cleanupError) {
            console.warn('Could not delete previous voucher image:', cleanupError);
          }
        }

        // Keep the local object consistent until loadVouchers() refreshes it.
        saved.image_path = newPath;
      }

      state.editingVoucherId = null;
      $('voucher-form-card').classList.add('crm-hidden');
      await loadVouchers();
      message('Voucher saved successfully.', 'success');
    } catch (err) {
      console.error('Could not save voucher:', err);
      message(err.message || 'Could not save voucher.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = state.editingVoucherId ? 'Save Changes' : 'Add Voucher';
    }
  }

  async function loadVouchers() {
    var result = await window.salonSupabase
      .from('vouchers')
      .select('*');

    if (result.error) throw result.error;

    state.vouchers = (result.data || []).slice().sort(function(a,b){
      var ao = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 0;
      var bo = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;
      if (ao !== bo) return ao - bo;
      var ad = a.created_at ? new Date(a.created_at).getTime() : 0;
      var bd = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bd - ad;
    });
    state.bookingVouchers = state.vouchers.slice();
    renderVouchers();
    updateDashboard();
  }

  async function deleteVoucherImage() {
    if (!state.editingVoucherId) return;
    var voucher = state.vouchers.find(function(v){ return String(v.id) === String(state.editingVoucherId); });
    if (!voucher || !voucher.image_path) return;

    if (!window.confirm('Remove this voucher image?')) return;

    try {
      var imagePath = voucher.image_path;

      // Clear the database reference first. Only remove the storage object
      // after the row has been updated successfully.
      var result = await window.salonSupabase
        .from('vouchers')
        .update({image_path:null})
        .eq('id', voucher.id)
        .select('id, image_path')
        .maybeSingle();

      if (result.error) throw result.error;
      if (!result.data || result.data.image_path !== null) {
        throw new Error(
          'The voucher image could not be removed from the database. Check the vouchers UPDATE RLS policy.'
        );
      }

      try {
        await deleteVoucherStorageImage(imagePath);
      } catch (storageError) {
        // The database is already correct; keep the warning visible in the
        // console so an orphaned object can be cleaned up later if necessary.
        console.warn('Voucher image record cleared, but storage cleanup failed:', storageError);
      }

      await loadVouchers();
      editVoucher(voucher.id);
      message('Voucher image removed.', 'success');
    } catch (err) {
      console.error('Could not remove voucher image:', err);
      message(err.message || 'Could not remove voucher image.', 'error');
    }
  }

  async function deleteVoucher(id) {
    var voucher = state.vouchers.find(function(v){ return String(v.id) === String(id); });
    if (!voucher) return;

    var title = voucher.title_en || voucher.title || voucher.sku || 'this voucher';
    if (!window.confirm('Delete "' + title + '"? This cannot be undone.')) return;

    try {
      if (voucher.image_path) {
        try { await deleteVoucherStorageImage(voucher.image_path); }
        catch (imageError) { console.warn('Could not delete voucher image:', imageError); }
      }

      var result = await window.salonSupabase
        .from('vouchers')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        throw new Error('The voucher could not be deleted. Check the vouchers DELETE RLS policy.');
      }

      await loadVouchers();
      $('voucher-form-card').classList.add('crm-hidden');
      message('Voucher deleted.', 'success');
    } catch (err) {
      console.error('Could not delete voucher:', err);
      message(err.message || 'Could not delete voucher.', 'error');
    }
  }

  function renderUsers() {
    $('users-table-body').innerHTML=state.users.map(function(u){
      var role=(u.role||'staff').replace(/^./,function(x){return x.toUpperCase();});
      var status=u.active!==false;
      var isSelf=state.currentUserId && String(u.user_id)===String(state.currentUserId);
      return '<tr><td><strong>'+escapeHtml(u.full_name||'CRM user')+'</strong><br><span class="crm-small">'+(isSelf?'You':'CRM team member')+'</span></td><td>'+escapeHtml(u.email||'—')+'</td>'+
      '<td><span class="crm-role-badge">'+escapeHtml(role)+'</span></td>'+
      '<td>'+(status?'<span class="crm-badge active">Active</span>':'<span class="crm-badge inactive">Inactive</span>')+'</td>'+
      '<td>'+escapeHtml(u.created_at?new Date(u.created_at).toLocaleDateString():'—')+'</td>'+
      '<td><div class="crm-actions-inline"><button type="button" class="crm-btn crm-btn-secondary crm-btn-small" data-edit-user="'+escapeHtml(u.user_id)+'">Edit</button>'+
      (isSelf?'':'<button type="button" class="crm-btn '+(status?'crm-btn-danger':'crm-btn-secondary')+' crm-btn-small" data-toggle-user="'+escapeHtml(u.user_id)+'">'+(status?'Deactivate':'Activate')+'</button>')+
      '</div></td></tr>';
    }).join('') || '<tr><td colspan="6">No CRM users found.</td></tr>';
  }
  async function updateDashboard() {
    var active=state.services.filter(function(s){return s.active!==false;}).length;
    $('stat-services').textContent=active;
    $('stat-categories').textContent=state.categories.filter(function(c){return c.active!==false;}).length+' categories';
    $('stat-vouchers') && ($('stat-vouchers').textContent=state.vouchers.filter(function(v){return v.active!==false;}).length);
    $('stat-users') && ($('stat-users').textContent=state.users.length);
    $('stat-bookings') && ($('stat-bookings').textContent=state.bookings.length);

    // Customers are stored in Supabase, so the dashboard must get the
    // current count from the database instead of relying on the customers
    // page having been opened first.
    var customerStat=$('stat-customers');
    if(customerStat){
      try{
        var customerResult=await window.salonSupabase
          .from('customers')
          .select('id',{count:'exact',head:true});
        if(customerResult.error) throw customerResult.error;
        customerStat.textContent=String(customerResult.count||0);
      }catch(e){
        // If the count request fails, use already-loaded customer records
        // when available rather than replacing the card with an error.
        customerStat.textContent=String(state.customers.length||0);
        console.warn('Could not load customer count for dashboard:',e);
      }
    }
  }
  function populateCategorySelect() {
    $('service-category').innerHTML=state.categories.map(function(c){return '<option value="'+c.id+'">'+escapeHtml(c.name_en)+'</option>';}).join('');
  }
  function resetServiceForm(){state.editingServiceId=null;$('service-form').reset();$('service-form-title').textContent='Add Service';$('service-save').textContent='Add Service';populateCategorySelect();}
  function editService(id){
    var s=state.services.find(function(x){return String(x.id)===String(id);}); if(!s)return;
    state.editingServiceId=s.id; $('service-form-title').textContent='Edit Service';$('service-save').textContent='Save Changes';
    $('service-category').value=s.category_id||'';$('service-sku').value=s.sku||'';$('service-name-en').value=s.name_en||'';$('service-name-ar').value=s.name_ar||'';
    $('service-description-en').value=s.description_en||'';$('service-description-ar').value=s.description_ar||'';
    $('service-price-usd').value=s.price_usd==null?'':s.price_usd;$('service-price-qar').value=s.price_qar==null?'':s.price_qar;
    $('service-duration').value=s.duration_minutes==null?30:s.duration_minutes;$('service-sort').value=s.sort_order||0;$('service-active').checked=s.active!==false;
    showView('services'); window.scrollTo({top:0,behavior:'smooth'});
  }
  async function saveService(e){
    e.preventDefault(); clearMessage();
    var usd=$('service-price-usd').value;
    var payload={category_id:Number($('service-category').value),sku:$('service-sku').value.trim()||null,name_en:$('service-name-en').value.trim(),name_ar:$('service-name-ar').value.trim(),
      description_en:$('service-description-en').value.trim()||null,description_ar:$('service-description-ar').value.trim()||null,price:usd===''?0:Number(usd),
      price_usd:usd===''?null:Number(usd),price_qar:$('service-price-qar').value===''?null:Number($('service-price-qar').value),
      duration_minutes:$('service-duration').value===''?30:Number($('service-duration').value),sort_order:Number($('service-sort').value||0),active:$('service-active').checked};
    if(!payload.name_en||!payload.name_ar||!payload.category_id){message('Please enter the English name, Arabic name and category.','error');return;}
    var result=state.editingServiceId?await window.salonSupabase.from('services').update(payload).eq('id',state.editingServiceId):await window.salonSupabase.from('services').insert(payload);
    if(result.error){message(result.error.message,'error');return;} message(state.editingServiceId?'Service updated.':'Service added.','success');resetServiceForm();await loadData();
  }
  function editCategory(id){
    var c=state.categories.find(function(x){return String(x.id)===String(id);});if(!c)return;
    state.editingCategoryId=c.id;$('category-form-title').textContent='Edit Category';$('category-save').textContent='Save Changes';
    $('category-name-en').value=c.name_en||'';$('category-name-ar').value=c.name_ar||'';$('category-description-en').value=c.description_en||'';$('category-description-ar').value=c.description_ar||'';
    $('category-image').value=c.image_url||'';$('category-width').value=c.image_width==null?'':c.image_width;$('category-height').value=c.image_height==null?'':c.image_height;$('category-sort').value=c.sort_order||0;$('category-active').checked=c.active!==false;
    showView('services');window.scrollTo({top:0,behavior:'smooth'});
  }
  function resetCategoryForm(){state.editingCategoryId=null;$('category-form').reset();$('category-form-title').textContent='Add Category';$('category-save').textContent='Add Category';$('category-active').checked=true;}
  async function saveCategory(e){
    e.preventDefault();clearMessage();
    var payload={name_en:$('category-name-en').value.trim(),name_ar:$('category-name-ar').value.trim(),description_en:$('category-description-en').value.trim()||null,description_ar:$('category-description-ar').value.trim()||null,
      image_url:$('category-image').value.trim()||null,image_width:$('category-width').value===''?null:Number($('category-width').value),image_height:$('category-height').value===''?null:Number($('category-height').value),sort_order:Number($('category-sort').value||0),active:$('category-active').checked};
    if(!payload.name_en||!payload.name_ar){message('Please enter the English and Arabic category names.','error');return;}
    var result=state.editingCategoryId?await window.salonSupabase.from('service_categories').update(payload).eq('id',state.editingCategoryId):await window.salonSupabase.from('service_categories').insert(payload);
    if(result.error){message(result.error.message,'error');return;}message(state.editingCategoryId?'Category updated.':'Category added.','success');resetCategoryForm();await loadData();
  }


  function bookingStore() {
    try {
      var raw = localStorage.getItem('salonTestBookings');
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  async function loadBookings() {
    /*
     * Current Supabase schema:
     *   bookings      -> customer_id, total_price, total_duration_minutes
     *   customers     -> name, phone, email, notes
     *   booking_services -> one row per booked item, with either service_id
     *                        or voucher_id
     *
     * Do not query the old JSON/items/customer_name columns here. Those were
     * used by an earlier booking schema and cause PostgREST 42703 errors.
     */
    var dbBookings = null;
    try {
      var results = await Promise.all([
        window.salonSupabase
          .from('bookings')
          .select('id,booking_date,start_time,end_time,status,total_price,total_duration_minutes,customer_id,customer_notes,created_at,public_reference')
          .order('created_at',{ascending:false}),
        window.salonSupabase
          .from('customers')
          .select('id,name,phone,email,notes'),
        window.salonSupabase
          .from('booking_services')
          .select('id,booking_id,service_id,staff_id,start_time,end_time,price,duration_minutes,voucher_id')
          .order('start_time',{ascending:true})
      ]);

      var bookingsResult = results[0];
      var customersResult = results[1];
      var bookingServicesResult = results[2];

      if (bookingsResult.error) throw bookingsResult.error;
      if (customersResult.error) throw customersResult.error;
      if (bookingServicesResult.error) throw bookingServicesResult.error;

      var customersById = {};
      (customersResult.data || []).forEach(function(customer) {
        customersById[String(customer.id)] = customer;
      });

      var servicesById = {};
      state.services.forEach(function(service) {
        servicesById[String(service.id)] = service;
      });

      var vouchersById = {};
      state.vouchers.forEach(function(voucher) {
        vouchersById[String(voucher.id)] = voucher;
      });

      var itemsByBooking = {};
      (bookingServicesResult.data || []).forEach(function(row) {
        var service = row.service_id != null ? servicesById[String(row.service_id)] : null;
        var voucher = row.voucher_id != null ? vouchersById[String(row.voucher_id)] : null;

        var item = {
          id: row.id,
          serviceId: row.service_id,
          voucherId: row.voucher_id,
          serviceSku: service ? (service.sku || '') : '',
          voucherSku: voucher ? (voucher.sku || '') : '',
          start: String(row.start_time || '').slice(0,5),
          end: String(row.end_time || '').slice(0,5),
          price: row.price,
          duration_minutes: row.duration_minutes,
          serviceName: service ? (service.name_en || service.name || '') : '',
          voucherName: voucher ? (voucher.title_en || voucher.title || '') : ''
        };

        if (!itemsByBooking[String(row.booking_id)]) itemsByBooking[String(row.booking_id)] = [];
        itemsByBooking[String(row.booking_id)].push(item);
      });

      dbBookings = (bookingsResult.data || []).map(function(row) {
        var customer = row.customer_id != null
          ? (customersById[String(row.customer_id)] || null)
          : null;

        var items = itemsByBooking[String(row.id)] || [];
        items.sort(function(a,b) {
          return a.start.localeCompare(b.start);
        });

        return {
          id: String(row.id),
          databaseId: row.id,
          publicReference: row.public_reference || '',
          date: row.booking_date,
          start_time: row.start_time,
          end_time: row.end_time,
          status: String(row.status || 'pending').toLowerCase(),
          total: row.total_price,
          total_duration_minutes: row.total_duration_minutes,
          currency: 'USD',
          customer: {
            id: row.customer_id,
            name: customer ? (customer.name || 'Customer') : 'Customer',
            phone: customer ? (customer.phone || '') : '',
            email: customer ? (customer.email || '') : '',
            notes: row.customer_notes || (customer ? (customer.notes || '') : '')
          },
          items: items,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      });
    } catch (e) {
      console.warn('Could not load Supabase bookings; using browser-local cache only.', e);
      dbBookings = null;
    }

    var local = bookingStore();
    state.bookingVouchers = state.vouchers.slice();
    var source = dbBookings !== null ? dbBookings : local;
    state.bookings = source.slice().sort(function(a,b) {
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
    renderBookings();
    updateBookingDashboardStat();
  }

  function bookingStatus(b) {
    return String(b.status || 'pending').toLowerCase();
  }

  function bookingStart(b) {
    return b.items && b.items[0] ? b.items[0].start : '';
  }

  function bookingEnd(b) {
    if (!b.items || !b.items.length) return '';
    return b.items[b.items.length - 1].end || '';
  }

  function bookingDateTime(b) {
    var date = b.date || '';
    var start = bookingStart(b);
    return date ? new Date(date + 'T' + (start || '00:00') + ':00') : null;
  }

  function bookingCustomer(b) {
    return b.customer || { name: b.name || 'Customer', phone: b.phone || '', email: b.email || '', notes: b.notes || '' };
  }

  function serviceForBookingItem(item) {
    var voucher = item && item.voucherId != null
      ? state.bookingVouchers.find(function(v){ return String(v.id) === String(item.voucherId); })
      : null;
    if (!voucher && item && item.voucherSku) {
      voucher = state.bookingVouchers.find(function(v){ return String(v.sku || '') === String(item.voucherSku); });
    }
    if (voucher) return {
      name: voucher.title_en || voucher.title || item.voucherSku || 'Voucher',
      duration: voucher.duration_minutes || voucher.durationMinutes || item.duration_minutes || 30,
      price: voucher.price_usd != null ? voucher.price_usd : (voucher.price != null ? voucher.price : item.price),
      voucher: true
    };

    var found = item && item.serviceId != null
      ? state.services.find(function(s){ return String(s.id) === String(item.serviceId); })
      : null;
    if (!found && item && item.serviceSku) {
      found = state.services.find(function(s){ return String(s.sku || '') === String(item.serviceSku); });
    }
    if (found) return {
      name: found.name_en || found.name || item.serviceSku || 'Service',
      duration: found.duration_minutes || item.duration_minutes,
      price: found.price_usd != null ? found.price_usd : (found.price != null ? found.price : item.price)
    };

    return { name: (item && (item.voucherName || item.serviceName || item.voucherSku || item.serviceSku)) || 'Service', duration: item ? item.duration_minutes : null, price: item ? item.price : null };
  }

  function bookingServiceNames(b) {
    return (b.items || []).map(function(item){ return serviceForBookingItem(item).name; });
  }

  function bookingMoney(b) {
    if (b.total == null || b.total === '') return '—';
    return escapeHtml(String(b.total)) + ' ' + escapeHtml(b.currency === 'QAR' ? 'QAR' : '$');
  }

  function statusLabel(status) {
    var s = bookingStatus({status: status});
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function bookingMatches(b) {
    var status = bookingStatus(b);
    if (state.bookingFilter !== 'all' && status !== state.bookingFilter) return false;
    var now = new Date(); now.setHours(0,0,0,0);
    var d = b.date ? new Date(b.date + 'T12:00:00') : null;
    if (state.bookingDateFilter === 'today' && (!d || d.toDateString() !== now.toDateString())) return false;
    if (state.bookingDateFilter === 'upcoming' && (!d || d < now)) return false;
    if (state.bookingDateFilter === 'past' && (!d || d >= now)) return false;
    var q = state.bookingSearch.trim().toLowerCase();
    if (q) {
      var c = bookingCustomer(b);
      var hay = [b.id, c.name, c.phone, c.email].concat(bookingServiceNames(b)).join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }


  function pad2(n){ return String(n).padStart(2,'0'); }
  function dateKey(d){ return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
  function parseTimeMinutes(t){
    if(!t) return null;
    var p=String(t).split(':'); var h=Number(p[0]), m=Number(p[1]||0);
    return isNaN(h)||isNaN(m)?null:h*60+m;
  }
  function formatTime12(t){
    var mins=parseTimeMinutes(t); if(mins==null)return '—';
    var h=Math.floor(mins/60), m=mins%60, ap=h>=12?'PM':'AM', hh=h%12||12;
    return hh+':'+pad2(m)+' '+ap;
  }
  function startOfWeek(d){
    var x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    var day=x.getDay(); x.setDate(x.getDate()-day); return x;
  }
  function sameDay(a,b){ return dateKey(a)===dateKey(b); }

  function scheduleVisibleBookings(){
    return state.bookings.filter(bookingMatches).filter(function(b){ return !!b.date && !!bookingStart(b); });
  }


  function bookingRange(b) {
    var start = parseTimeMinutes(bookingStart(b));
    var end = parseTimeMinutes(bookingEnd(b));
    if (start == null) return null;
    if (end == null || end <= start) end = start + 30;
    return {start:start,end:end};
  }

  function isBlockingStatus(b) {
    // Only confirmed appointments reserve time on the public calendar.
    // Pending requests are requests, not reservations.
    return bookingStatus(b) === 'confirmed';
  }

  function overlaps(a,b) {
    return a && b && a.start < b.end && b.start < a.end;
  }

  function dayBookings(date) {
    return state.bookings.filter(function(b){
      return b.date === date && !!bookingRange(b) && bookingStatus(b) !== 'cancelled';
    }).sort(function(a,b){ return bookingRange(a).start - bookingRange(b).start; });
  }

  function hasBlockingOverlap(candidate, ignoreId) {
    var range = bookingRange(candidate);
    if (!range) return null;
    return state.bookings.find(function(b){
      if (ignoreId != null && String(b.id) === String(ignoreId)) return false;
      if (b.date !== candidate.date || !isBlockingStatus(b)) return false;
      return overlaps(range, bookingRange(b));
    }) || null;
  }

  function freeIntervalsForDay(date, hourStart, hourEnd) {
    var booked = dayBookings(date).filter(function(b){ return isBlockingStatus(b); })
      .map(bookingRange).sort(function(a,b){ return a.start-b.start; });
    var result = [], cursor = hourStart * 60;
    booked.forEach(function(r){
      var start = Math.max(r.start, hourStart*60);
      var end = Math.min(r.end, hourEnd*60);
      if (end <= hourStart*60 || start >= hourEnd*60) return;
      if (start > cursor) result.push({start:cursor,end:start});
      cursor = Math.max(cursor,end);
    });
    if (cursor < hourEnd*60) result.push({start:cursor,end:hourEnd*60});
    return result;
  }

  function freeIntervalLabel(r) {
    return formatTime12(pad2(Math.floor(r.start/60))+':'+pad2(r.start%60)) + ' – ' +
           formatTime12(pad2(Math.floor(r.end/60))+':'+pad2(r.end%60));
  }

  function renderSchedule(){
    var grid=$('booking-schedule-grid'); if(!grid)return;
    var weekStart=startOfWeek(state.scheduleDate), days=[];
    for(var i=0;i<7;i++){var d=new Date(weekStart);d.setDate(weekStart.getDate()+i);days.push(d);}
    var visible=scheduleVisibleBookings(), hourStart=8, hourEnd=20, rowH=64, labelW=74;
    var cols='74px repeat(7,minmax(150px,1fr))';
    grid.style.setProperty('--schedule-cols',cols);

    // Flag overlaps for the current view.
    visible.forEach(function(b){
      var r=bookingRange(b);
      b.__crmOverlap=!!r && state.bookings.some(function(other){
        if(String(other.id)===String(b.id) || other.date!==b.date || bookingStatus(other)==='cancelled') return false;
        return overlaps(r,bookingRange(other));
      });
    });

    var head='<div class="crm-schedule-corner"><span>Time</span></div>';
    days.forEach(function(d){
      var key=dateKey(d), count=visible.filter(function(b){return b.date===key;}).length;
      var free=freeIntervalsForDay(key,hourStart,hourEnd);
      var today=sameDay(d,new Date());
      head+='<div class="crm-schedule-day-head '+(today?'is-today':'')+'">'+
        '<span>'+d.toLocaleDateString(undefined,{weekday:'short'})+'</span>'+
        '<strong>'+d.getDate()+'</strong>'+
        '<small>'+count+' '+(count===1?'booking':'bookings')+' · '+(free.length?free.length+' free':'fully booked')+'</small>'+
      '</div>';
    });

    var body='';
    for(var h=hourStart;h<hourEnd;h++){
      body+='<div class="crm-schedule-time">'+formatTime12(pad2(h)+':00')+'</div>';
      days.forEach(function(d){body+='<div class="crm-schedule-cell" data-schedule-date="'+dateKey(d)+'" style="height:'+rowH+'px"></div>';});
    }
    grid.innerHTML='<div class="crm-schedule-head" style="grid-template-columns:'+cols+'">'+head+'</div>'+
      '<div class="crm-schedule-body" style="grid-template-columns:'+cols+'">'+body+'</div>';

    var bodyEl=grid.querySelector('.crm-schedule-body');

    // Exact free windows are shown behind bookings.
    days.forEach(function(d,dayIndex){
      freeIntervalsForDay(dateKey(d),hourStart,hourEnd).forEach(function(r){
        var el=document.createElement('div');
        el.className='crm-schedule-free';
        el.style.left='calc('+labelW+'px + '+dayIndex+' * ((100% - '+labelW+'px) / 7) + 4px)';
        el.style.width='calc((100% - '+labelW+'px) / 7 - 8px)';
        el.style.top=((r.start-hourStart*60)/60*rowH)+'px';
        el.style.height=Math.max(22,(r.end-r.start)/60*rowH-4)+'px';
        el.innerHTML='<span>Available</span><small>'+escapeHtml(freeIntervalLabel(r))+'</small>';
        bodyEl.appendChild(el);
      });
    });

    visible.forEach(function(b){
      var dayIndex=days.findIndex(function(d){return b.date===dateKey(d);});
      if(dayIndex<0)return;
      var range=bookingRange(b); if(!range)return;
      var clampedStart=Math.max(range.start,hourStart*60);
      var clampedEnd=Math.min(Math.max(range.end,range.start+15),hourEnd*60);
      if(clampedEnd<=hourStart*60 || clampedStart>=hourEnd*60)return;
      var card=document.createElement('button'), c=bookingCustomer(b), names=bookingServiceNames(b), status=bookingStatus(b);
      card.type='button';
      card.className='crm-schedule-booking status-'+status+(b.__crmOverlap?' has-overlap':'');
      card.style.left='calc('+labelW+'px + '+dayIndex+' * ((100% - '+labelW+'px) / 7) + 4px)';
      card.style.width='calc((100% - '+labelW+'px) / 7 - 8px)';
      card.style.top=((clampedStart-hourStart*60)/60*rowH)+'px';
      card.style.height=Math.max(38,(clampedEnd-clampedStart)/60*rowH-4)+'px';
      card.setAttribute('data-view-booking',b.id||'');
      card.title=b.__crmOverlap?'Overlap detected — review this booking':'Open booking details';
      card.innerHTML='<span class="crm-schedule-time">'+escapeHtml(formatTime12(bookingStart(b)))+' – '+escapeHtml(formatTime12(bookingEnd(b)))+'</span>'+
        '<strong>'+escapeHtml(c.name||'Customer')+'</strong><span>'+escapeHtml(names.join(', ')||'Booking')+'</span>'+
        (b.__crmOverlap?'<em class="crm-overlap-flag">Overlap</em>':'');
      bodyEl.appendChild(card);
    });

    $('schedule-range-label').textContent=days[0].toLocaleDateString(undefined,{month:'long',day:'numeric'})+' – '+days[6].toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
    var conflicts=visible.filter(function(b){return b.__crmOverlap;}).length;
    $('schedule-summary').textContent=visible.length+' '+(visible.length===1?'booking':'bookings')+' this week'+(conflicts?' · '+conflicts+' overlap'+(conflicts===1?'':'s')+' to review':'');
  }

  function setBookingView(view){
    state.bookingView=view==='list'?'list':'schedule';
    document.querySelectorAll('[data-booking-view]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-booking-view')===state.bookingView);});
    var sched=$('booking-schedule'), list=$('booking-list');
    if(sched)sched.classList.toggle('crm-hidden',state.bookingView!=='schedule');
    if(list)list.classList.toggle('crm-hidden',state.bookingView!=='list');
    if(state.bookingView==='schedule')renderSchedule();
  }

  function renderBookings() {
    var body = $('bookings-table-body');
    if (!body) return;
    var visible = state.bookings.filter(bookingMatches);
    body.innerHTML = visible.map(function(b) {
      var c = bookingCustomer(b);
      var names = bookingServiceNames(b);
      var first = bookingStart(b), last = bookingEnd(b);
      var dateText = b.date ? new Date(b.date + 'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '—';
      var timeText = first ? first + (last ? ' – ' + last : '') : '—';
      var status = bookingStatus(b);
      var badgeClass = status === 'confirmed' ? 'active' : (status === 'cancelled' ? 'inactive' : 'crm-booking-status-' + status);
      return '<tr class="crm-booking-row" data-booking-id="' + escapeHtml(b.id || '') + '">' +
        '<td><strong>' + escapeHtml(dateText) + '</strong><br><span class="crm-small">' + escapeHtml(timeText) + '</span></td>' +
        '<td><strong>' + escapeHtml(c.name || 'Customer') + '</strong><br><span class="crm-small">' + escapeHtml(b.id || 'No reference') + '</span></td>' +
        '<td><strong>' + escapeHtml(names.join(', ') || '—') + '</strong><br><span class="crm-small">' + (b.items ? b.items.length : 0) + ' service' + ((b.items && b.items.length === 1) ? '' : 's') + '</span></td>' +
        '<td>' + escapeHtml(c.phone || '—') + '<br><span class="crm-small">' + escapeHtml(c.email || 'No email') + '</span></td>' +
        '<td class="crm-price">' + bookingMoney(b) + '</td>' +
        '<td><span class="crm-badge ' + badgeClass + '">' + escapeHtml(statusLabel(status)) + '</span></td>' +
        '<td><button type="button" class="crm-btn crm-btn-secondary crm-btn-small" data-view-booking="' + escapeHtml(b.id || '') + '">View</button></td>' +
      '</tr>';
    }).join('');
    $('bookings-empty').classList.toggle('crm-hidden', visible.length !== 0);
    updateBookingCounts();
    if(state.bookingView==='schedule') renderSchedule();
  }

  function updateBookingCounts() {
    var counts = {all:state.bookings.length,pending:0,confirmed:0,completed:0,cancelled:0};
    state.bookings.forEach(function(b){ var s=bookingStatus(b); if (counts[s] != null) counts[s]++; });
    Object.keys(counts).forEach(function(k){ var el=$('booking-count-'+k); if(el) el.textContent=counts[k]; });
    document.querySelectorAll('[data-booking-filter]').forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-booking-filter') === state.bookingFilter); });
  }

  function updateBookingDashboardStat() {
    var el = $('stat-bookings');
    if (el) el.textContent = state.bookings.length;
  }

  function persistBookings() {
    localStorage.setItem('salonTestBookings', JSON.stringify(state.bookings));
  }

  async function updateBookingStatusInDatabase(id,status){
    var result=await window.salonSupabase.from('bookings').update({
      status:status
    }).eq('id',id);
    if(result.error) throw result.error;
  }

  function shiftBookingItems(items, newStart) {
    var source = Array.isArray(items) ? items : [];
    if (!source.length) return [];
    var firstStart = parseTimeMinutes(source[0].start);
    var targetStart = parseTimeMinutes(newStart);
    if (firstStart == null || targetStart == null) throw new Error('Invalid appointment time.');

    var delta = targetStart - firstStart;
    function clock(total){
      if(total < 0 || total >= 24*60) throw new Error('The appointment cannot extend past midnight.');
      return pad2(Math.floor(total/60))+':'+pad2(total%60);
    }
    return source.map(function(item){
      var start = parseTimeMinutes(item.start);
      var end = parseTimeMinutes(item.end);
      if (start == null || end == null || end <= start) throw new Error('Invalid appointment time.');
      return Object.assign({}, item, {
        start: clock(start + delta),
        end: clock(end + delta)
      });
    });
  }

  async function updateBookingAppointmentInDatabase(id, date, items){
    var result=await window.salonSupabase.from('bookings').update({
      booking_date:date
    }).eq('id',id);
    if(result.error) throw result.error;

    var source = Array.isArray(items) ? items : [];
    await Promise.all(source.filter(function(item){ return item && item.id != null; }).map(function(item){
      return window.salonSupabase.from('booking_services').update({
        start_time:item.start,
        end_time:item.end
      }).eq('id',item.id).eq('booking_id',id).then(function(r){
        if(r.error) throw r.error;
        return r;
      });
    }));
  }

  function findBooking(id) {
    return state.bookings.find(function(b){ return String(b.id) === String(id); });
  }

  function renderBookingDetail(id) {
    var b = findBooking(id); if (!b) return;
    var c = bookingCustomer(b), status = bookingStatus(b);
    var dateText = b.date ? new Date(b.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '—';
    var items = (b.items || []).map(function(item) {
      var s = serviceForBookingItem(item);
      return '<div class="crm-detail-item"><div><strong>' + escapeHtml(s.name) + '</strong><span>' + escapeHtml(item.start || '') + (item.end ? ' – ' + escapeHtml(item.end) : '') + '</span></div><strong>' + (s.price == null ? '—' : escapeHtml(String(s.price)) + ' ' + (b.currency === 'QAR' ? 'QAR' : '$')) + '</strong></div>';
    }).join('');
    var nextStatuses = ['pending','confirmed','completed','cancelled'].filter(function(s){return s!==status;}).map(function(s){
      return '<button type="button" class="crm-btn ' + (s==='cancelled'?'crm-btn-danger':'crm-btn-secondary') + '" data-booking-status="' + s + '" data-booking-id="' + escapeHtml(b.id) + '">' + statusLabel(s) + '</button>';
    }).join('');
    $('booking-detail-content').innerHTML =
      '<div class="crm-detail-status"><span class="crm-badge ' + (status==='confirmed'?'active':status==='cancelled'?'inactive':'crm-booking-status-'+status) + '">' + escapeHtml(statusLabel(status)) + '</span><span class="crm-small">' + escapeHtml(b.id || '') + '</span></div>' +
      '<div class="crm-detail-grid">' +
        '<div><span class="crm-detail-label">Customer</span><strong>' + escapeHtml(c.name || '—') + '</strong></div>' +
        '<div><span class="crm-detail-label">Phone / WhatsApp</span><strong>' + escapeHtml(c.phone || '—') + '</strong></div>' +
        '<div><span class="crm-detail-label">Email</span><strong>' + escapeHtml(c.email || '—') + '</strong></div>' +
        '<div><span class="crm-detail-label">Appointment</span><strong>' + escapeHtml(dateText) + '</strong><span>' + escapeHtml(bookingStart(b) || '—') + (bookingEnd(b) ? ' – ' + escapeHtml(bookingEnd(b)) : '') + '</span></div>' +
      '</div>' +
      '<div class="crm-detail-section crm-booking-edit-section">' +
        '<div class="crm-section-label">Adjust appointment</div>' +
        '<div class="crm-form-grid">' +
          '<div class="crm-field"><label for="crm-edit-booking-date">Date</label><input id="crm-edit-booking-date" type="date" value="' + escapeHtml(b.date || '') + '"></div>' +
          '<div class="crm-field"><label for="crm-edit-booking-start">Start time</label><input id="crm-edit-booking-start" type="time" value="' + escapeHtml(bookingStart(b) || '') + '"></div>' +
        '</div>' +
        '<div class="crm-small crm-booking-edit-help">Changing the start time moves the entire appointment by the same amount and keeps each service duration. Pending requests do not block other customers.</div>' +
        '<button type="button" class="crm-btn crm-btn-secondary" data-save-booking-appointment="' + escapeHtml(b.id) + '">Save date & time</button>' +
        '<span id="crm-edit-booking-message" class="crm-small"></span>' +
      '</div>' +
      '<div class="crm-detail-section"><div class="crm-section-label">Services</div>' + items + '</div>' +
      '<div class="crm-detail-total"><span>Total</span><strong>' + bookingMoney(b) + '</strong></div>' +
      (c.notes ? '<div class="crm-detail-section"><div class="crm-section-label">Customer notes</div><p class="crm-detail-notes">' + escapeHtml(c.notes) + '</p></div>' : '') +
      '<div class="crm-detail-actions">' + nextStatuses + '</div>';
    $('booking-detail-modal').classList.remove('crm-hidden');
    $('booking-detail-modal').setAttribute('aria-hidden','false');
  }

  async function saveBookingAppointment(id) {
    var b = findBooking(id);
    if (!b) return;
    var dateInput = $('crm-edit-booking-date');
    var startInput = $('crm-edit-booking-start');
    var messageEl = $('crm-edit-booking-message');
    if (!dateInput || !startInput) return;

    var date = dateInput.value;
    var start = startInput.value;
    if (!date || !start) {
      if (messageEl) messageEl.textContent = 'Please choose a date and start time.';
      return;
    }

    var items;
    try {
      items = shiftBookingItems(b.items, start);
    } catch (e) {
      if (messageEl) messageEl.textContent = e.message || 'Invalid appointment time.';
      return;
    }

    // Only confirmed appointments are hard reservations. A pending request
    // may be moved freely; when the admin confirms it, the overlap check
    // below is performed against other confirmed appointments.
    if (bookingStatus(b) === 'confirmed') {
      var candidate = Object.assign({}, b, {date:date, items:items});
      var conflict = hasBlockingOverlap(candidate, id);
      if (conflict) {
        var cc = bookingCustomer(conflict);
        if (messageEl) messageEl.textContent =
          'This time overlaps confirmed booking ' + (cc.name || conflict.id) + '.';
        return;
      }
    }

    var button = document.querySelector('[data-save-booking-appointment="' + CSS.escape(String(id)) + '"]');
    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Saving…';
    }

    try {
      await updateBookingAppointmentInDatabase(b.databaseId || id, date, items);
      b.date = date;
      b.items = items;
      b.updated_at = new Date().toISOString();
      persistBookings();
      renderBookings();
      renderBookingDetail(id);
      message('Appointment date/time updated.', 'success');
    } catch (e) {
      console.error('Could not update booking appointment:', e);
      if (messageEl) messageEl.textContent = 'Could not save the appointment: ' + (e.message || 'Unknown error');
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Save date & time';
      }
    }
  }

  function closeBookingDetail() {
    $('booking-detail-modal').classList.add('crm-hidden');
    $('booking-detail-modal').setAttribute('aria-hidden','true');
  }

  async function updateBookingStatus(id, status) {
    var b = findBooking(id); if (!b) return;
    status = String(status || 'pending').toLowerCase();

    if (status === 'pending' || status === 'confirmed') {
      var conflict = hasBlockingOverlap(b, id);
      if (conflict) {
        var cc = bookingCustomer(conflict);
        message('Cannot mark this booking ' + statusLabel(status).toLowerCase() +
          '. It overlaps ' + (cc.name || 'another booking') + ' (' + conflict.id + ').', 'error');
        renderBookingDetail(id);
        return;
      }
    }

    try {
      await updateBookingStatusInDatabase(id,status);
    } catch(e) {
      message('Could not update the booking in Supabase: '+(e.message||'Unknown error'),'error');
      return;
    }

    b.status = status;
    persistBookings();
    renderBookings();
    updateBookingDashboardStat();
    renderBookingDetail(id);
    message('Booking ' + id + ' marked as ' + statusLabel(status) + '.', 'success');
  }

  function showView(view){
    if((view==='users' || view==='booking-config' || view==='faqs' || view==='settings') && !isCrmAdmin()){
      message('Only administrators can manage this section.','error');
      return;
    }
    state.currentView=view;
    document.querySelectorAll('.crm-view').forEach(function(el){el.classList.add('crm-hidden');});
    var target=$('view-'+view); if(target)target.classList.remove('crm-hidden');
    document.querySelectorAll('.crm-nav-item').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-view')===view);});
    var titles={dashboard:['Overview','Dashboard'],services:['Catalog','Services'],users:['Access control','Users & Access'],vouchers:['Marketing','Vouchers'],faqs:['Content','FAQs'],bookings:['Appointments','Bookings'],customers:['Customers','Customers'],'booking-config':['Booking','Booking Setup'],settings:['Configuration','Application Settings']};
    var t=titles[view]||titles.dashboard;$('view-eyebrow').textContent=t[0];$('view-title').textContent=t[1];
    if(view==='users') loadUsers().catch(function(e){message(e.message,'error');});
    if(view==='settings') loadApplicationSettings().catch(function(e){message(e.message,'error');});
    if(view==='vouchers') loadVouchers().catch(function(e){message(e.message,'error');});
    if(view==='bookings') loadBookings().catch(function(e){message(e.message,'error');});
    if(view==='dashboard') updateDashboard();
    if(view==='customers') loadCustomers().catch(function(e){message(e.message,'error');});
    if(view==='booking-config') loadBookingConfig().catch(function(e){message(e.message||'Could not load booking configuration.','error');});
    $('crm-sidebar').classList.remove('open');
  }

  async function inviteUser(e){
    e.preventDefault();clearMessage();
    if(!isCrmAdmin()){message('Only administrators can invite CRM users.','error');return;}
    var payload={email:$('user-email').value.trim(),full_name:$('user-name').value.trim(),role:$('user-role').value,redirect_to:CRM_INVITE_REDIRECT};
    if(!payload.email||!payload.full_name){message('Please enter a name and email.','error');return;}
    var button=e.submitter || $('user-form').querySelector('button[type="submit"]');
    if(button){button.disabled=true;button.textContent='Sending…';}
    try{
      var result=await window.salonSupabase.functions.invoke('invite-crm-user',{body:payload});
      if(result.error){
        var detail=(result.data&&result.data.error)||result.error.message||'Could not send invitation.';
        message(detail,'error');return;
      }
      message('Invitation sent to '+payload.email+'.','success');$('user-form').reset();$('user-form-card').classList.add('crm-hidden');await loadUsers();
    } finally {
      if(button){button.disabled=false;button.textContent='Send invitation';}
    }
  }
  function editUser(id){
    if(!isCrmAdmin()) return;
    var u=state.users.find(function(x){return String(x.user_id)===String(id);}); if(!u)return;
    state.editingUserId=u.user_id;
    $('edit-user-name').value=u.full_name||'';
    $('edit-user-role').value=u.role||'staff';
    $('edit-user-active').checked=u.active!==false;
    $('user-edit-email').textContent=u.email||'';
    $('user-edit-card').classList.remove('crm-hidden');
    $('user-form-card').classList.add('crm-hidden');
    $('edit-user-name').focus();
  }
  async function saveUser(e){
    e.preventDefault();clearMessage();
    if(!isCrmAdmin() || !state.editingUserId) return;
    if(String(state.editingUserId)===String(state.currentUserId) && !$('edit-user-active').checked){
      message('You cannot deactivate your own administrator account.','error');return;
    }
    var payload={full_name:$('edit-user-name').value.trim(),role:$('edit-user-role').value,active:$('edit-user-active').checked};
    if(!payload.full_name){message('Please enter a display name.','error');return;}
    var result=await window.salonSupabase.from('admin_users').update(payload).eq('user_id',state.editingUserId);
    if(result.error){message(result.error.message,'error');return;}
    message('User updated.','success');state.editingUserId=null;$('user-edit-card').classList.add('crm-hidden');await loadUsers();
  }
  async function toggleUser(id){
    if(!isCrmAdmin()) return;
    if(String(id)===String(state.currentUserId)){message('You cannot deactivate your own administrator account.','error');return;}
    var u=state.users.find(function(x){return String(x.user_id)===String(id);});if(!u)return;
    var next=u.active===false;
    var result=await window.salonSupabase.from('admin_users').update({active:next}).eq('user_id',id);
    if(result.error){message(result.error.message,'error');return;}
    message(next?'User activated.':'User deactivated.','success');await loadUsers();
  }
  function isInviteSetup(){
    return new URLSearchParams(window.location.search).get('invite')==='1';
  }
  function showPasswordSetup(){
    $('crm-login').classList.add('crm-hidden');$('crm-app').classList.add('crm-hidden');$('crm-password-setup').classList.remove('crm-hidden');
    $('setup-password').focus();
  }
  function passwordSetupMessage(text,type){
    var el=$('password-setup-message');el.textContent=text;el.className='crm-message show '+(type||'success');
  }
  async function finishPasswordSetup(e){
    e.preventDefault();
    var password=$('setup-password').value, confirm=$('setup-password-confirm').value;
    if(password.length<8){passwordSetupMessage('Password must be at least 8 characters.','error');return;}
    if(password!==confirm){passwordSetupMessage('The passwords do not match.','error');return;}
    var button=e.submitter;
    if(button){button.disabled=true;button.textContent='Saving…';}
    try{
      var result=await window.salonSupabase.auth.updateUser({password:password});
      if(result.error){passwordSetupMessage(result.error.message,'error');return;}
      history.replaceState({},document.title,window.location.pathname);
      $('crm-password-setup').classList.add('crm-hidden');
      if(!(await requireAdmin())){await window.salonSupabase.auth.signOut();showLogin();message('Your invitation was accepted, but this account is not authorized for the salon CRM.','error');return;}
      state.currentUserId=result.data.user.id;showApp();$('current-user-email').textContent=result.data.user.email||'CRM user';applyRoleVisibility();await loadData();await loadUsers();await loadApplicationSettings();await loadFaqs();await loadBookings();
      message('Password created. Welcome to the salon CRM.','success');
    } finally {
      if(button){button.disabled=false;button.textContent='Create password →';}
    }
  }
  function showLogin(){ $('crm-login').classList.remove('crm-hidden');$('crm-app').classList.add('crm-hidden');}
  async function signOut(){await window.salonSupabase.auth.signOut();showLogin();}
  async function login(e){
    e.preventDefault();clearMessage();
    var result=await window.salonSupabase.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
    if(result.error){message(result.error.message,'error');return;}
    if(!(await requireAdmin())){await window.salonSupabase.auth.signOut();message('This account is not authorized to access the salon CRM.','error');return;}
    showApp();$('current-user-email').textContent=result.data.user.email||'CRM user';applyRoleVisibility();await loadData();await loadUsers();await loadApplicationSettings();await loadFaqs();await loadBookings();
  }
  function applyRoleVisibility(){
    document.querySelectorAll('[data-admin-only]').forEach(function(el){
      el.classList.toggle('crm-hidden',!isCrmAdmin());
    });
  }
  function showApp(){$('crm-login').classList.add('crm-hidden');$('crm-app').classList.remove('crm-hidden');applyRoleVisibility();}

  document.addEventListener('DOMContentLoaded',async function(){
    $('login-form').addEventListener('submit',login);$('faq-form').addEventListener('submit',saveFaq);$('faq-settings-form').addEventListener('submit',saveFaqSettings);$('faq-cancel').addEventListener('click',resetFaqForm);$('new-faq-top').addEventListener('click',startFaqCreate);$('faqs-refresh').addEventListener('click',function(){loadFaqs().catch(function(e){message(e.message,'error');});});$('faq-table-body').addEventListener('click',function(e){var edit=e.target.closest('[data-edit-faq]');if(edit)editFaq(edit.getAttribute('data-edit-faq'));var del=e.target.closest('[data-delete-faq]');if(del)deleteFaq(del.getAttribute('data-delete-faq'));});$('service-form').addEventListener('submit',saveService);$('category-form').addEventListener('submit',saveCategory);$('customer-form').addEventListener('submit',saveCustomer);$('customer-search').addEventListener('input',renderCustomers);$('customer-cancel').addEventListener('click',cancelCustomerEdit);$('customer-detail-close').addEventListener('click',closeCustomerDetails);$('application-settings-form').addEventListener('submit',saveApplicationSettings);$('add-currency-option').addEventListener('click',addCurrencyOption);
    $('user-form').addEventListener('submit',inviteUser);$('user-cancel').addEventListener('click',function(){$('user-form-card').classList.add('crm-hidden');});
    $('user-edit-form').addEventListener('submit',saveUser);$('user-edit-cancel').addEventListener('click',function(){$('user-edit-card').classList.add('crm-hidden');state.editingUserId=null;});
    $('password-setup-form').addEventListener('submit',finishPasswordSetup);
    $('invite-user-btn').addEventListener('click',function(){$('user-form-card').classList.remove('crm-hidden');$('user-name').focus();});
    $('new-service-top').addEventListener('click',function(){resetServiceForm();showView('services');window.scrollTo({top:0,behavior:'smooth'});});
    $('service-reset').addEventListener('click',resetServiceForm);$('category-reset').addEventListener('click',resetCategoryForm);$('logout').addEventListener('click',signOut);
    document.querySelectorAll('.crm-nav-item').forEach(function(b){b.addEventListener('click',function(){showView(b.getAttribute('data-view'));});});
    document.querySelectorAll('[data-view-target]').forEach(function(b){b.addEventListener('click',function(){showView(b.getAttribute('data-view-target'));});});
    $('mobile-menu').addEventListener('click',function(){$('crm-sidebar').classList.toggle('open');});
    $('bookings-refresh').addEventListener('click',function(){loadBookings().catch(function(e){message(e.message,'error');});});
    $('booking-search').addEventListener('input',function(e){state.bookingSearch=e.target.value;renderBookings();});
    $('booking-date-filter').addEventListener('change',function(e){state.bookingDateFilter=e.target.value;renderBookings();});
    document.querySelectorAll('[data-booking-filter]').forEach(function(b){b.addEventListener('click',function(){state.bookingFilter=b.getAttribute('data-booking-filter');renderBookings();});});
    $('bookings-table-body').addEventListener('click',function(e){var b=e.target.closest('[data-view-booking]');if(b)renderBookingDetail(b.getAttribute('data-view-booking'));});
    document.querySelectorAll('[data-close-booking]').forEach(function(el){el.addEventListener('click',closeBookingDetail);});
    $('booking-detail-content').addEventListener('click',function(e){
      var statusButton=e.target.closest('[data-booking-status]');
      if(statusButton) updateBookingStatus(statusButton.getAttribute('data-booking-id'),statusButton.getAttribute('data-booking-status'));
      var saveButton=e.target.closest('[data-save-booking-appointment]');
      if(saveButton) saveBookingAppointment(saveButton.getAttribute('data-save-booking-appointment'));
    });
    document.querySelectorAll('[data-booking-view]').forEach(function(b){b.addEventListener('click',function(){setBookingView(b.getAttribute('data-booking-view'));});});
    $('schedule-prev').addEventListener('click',function(){state.scheduleDate.setDate(state.scheduleDate.getDate()-7);renderSchedule();});
    $('schedule-next').addEventListener('click',function(){state.scheduleDate.setDate(state.scheduleDate.getDate()+7);renderSchedule();});
    $('schedule-today').addEventListener('click',function(){state.scheduleDate=new Date();renderSchedule();});
    $('booking-schedule-grid').addEventListener('click',function(e){var b=e.target.closest('[data-view-booking]');if(b)renderBookingDetail(b.getAttribute('data-view-booking'));});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeBookingDetail();});

    $('service-table-body').addEventListener('click',function(e){var b=e.target.closest('[data-edit-service]');if(b)editService(b.getAttribute('data-edit-service'));});
    $('category-table-body').addEventListener('click',function(e){var b=e.target.closest('[data-edit-category]');if(b)editCategory(b.getAttribute('data-edit-category'));}); $('users-table-body').addEventListener('click',function(e){var edit=e.target.closest('[data-edit-user]');if(edit)editUser(edit.getAttribute('data-edit-user'));var toggle=e.target.closest('[data-toggle-user]');if(toggle)toggleUser(toggle.getAttribute('data-toggle-user'));});
    $('voucher-form').addEventListener('submit',saveVoucher);
    $('voucher-reset').addEventListener('click',resetVoucherForm);
    $('voucher-cancel').addEventListener('click',function(){$('voucher-form-card').classList.add('crm-hidden');state.editingVoucherId=null;});
    $('new-voucher-top').addEventListener('click',function(){resetVoucherForm();$('voucher-form-card').classList.remove('crm-hidden');$('voucher-sku').focus();window.scrollTo({top:0,behavior:'smooth'});});
    $('vouchers-refresh').addEventListener('click',function(){loadVouchers().catch(function(e){message(e.message,'error');});});
    $('voucher-image-delete').addEventListener('click',deleteVoucherImage);    $('voucher-image-file').addEventListener('change',previewVoucherImageFile);
    $('voucher-table-body').addEventListener('click',function(e){
      var edit=e.target.closest('[data-edit-voucher]');
      if(edit) editVoucher(edit.getAttribute('data-edit-voucher'));
      var del=e.target.closest('[data-delete-voucher]');
      if(del) deleteVoucher(del.getAttribute('data-delete-voucher'));
    });
    try{
      var sessionResult=await window.salonSupabase.auth.getSession();
      var session=sessionResult.data.session;
      if(isInviteSetup() && session){
        state.currentUserId=session.user.id;showPasswordSetup();
      } else if(await requireAdmin()){
        state.currentUserId=session&&session.user?session.user.id:null;
        showApp();$('current-user-email').textContent=session&&session.user?session.user.email:'CRM user';applyRoleVisibility();await loadData();await loadUsers();await loadApplicationSettings();await loadFaqs();await loadBookings();
      } else showLogin();
    } catch(e){console.error(e);showLogin();}

    // Customer actions are called from admin.html inline handlers, so expose them
    // only after the customer functions have been created inside this scope.
    window.viewCustomer = viewCustomer;
    window.editCustomer = editCustomer;
    window.startCustomerCreate = startCustomerCreate;
  });
  var bookingConfigState = { settings: null, rules: [], editingRuleId: null };

  // Booking blackout timestamps are treated as local wall-clock values.
  // We encode them with a Z suffix when writing so the same clock components
  // survive whether the Supabase column is timestamptz or timestamp without
  // time zone. We never let the browser convert the stored wall-clock value
  // between time zones when putting it back into the datetime-local input.
  function formatBlackoutDateTime(value) {
    if(!value) return '—';
    var raw=String(value).trim().replace(' ','T');
    var match=raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if(!match) return String(value);
    var d=new Date(match[1]+'T'+match[2]+':00');
    if(Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString([], {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function bookingRuleLabel(r) {
    return formatBlackoutDateTime(r.starts_at)+' → '+formatBlackoutDateTime(r.ends_at);
  }

  function renderBookingRules() {
    var body=$('booking-rules-body'); if(!body)return;
    var rows=bookingConfigState.rules.slice().sort(function(a,b){
      return String(a.starts_at||'').localeCompare(String(b.starts_at||''));
    });
    if(!rows.length){
      body.innerHTML='<tr><td colspan="2" class="crm-empty">No booking blocks configured.</td></tr>';
      return;
    }
    body.innerHTML=rows.map(function(r){
      return '<tr>'+
        '<td><strong>'+escapeHtml(bookingRuleLabel(r))+'</strong></td>'+
        '<td><div class="crm-row-actions"><button type="button" class="crm-btn crm-btn-secondary edit-booking-rule" data-id="'+r.id+'">Edit</button><button type="button" class="crm-btn crm-btn-danger delete-booking-rule" data-id="'+r.id+'">Delete</button></div></td>'+
      '</tr>';
    }).join('');
    body.querySelectorAll('.edit-booking-rule').forEach(function(b){
      b.addEventListener('click',function(){openBookingRuleForm(Number(b.dataset.id));});
    });
    body.querySelectorAll('.delete-booking-rule').forEach(function(b){
      b.addEventListener('click',async function(){
        if(!confirm('Delete this booking block?'))return;
        try{
          await window.salonDatabase.deleteBookingScheduleRule(Number(b.dataset.id));
          await loadBookingConfig();
          message('Booking block deleted.','success');
        }catch(e){
          console.error(e);
          message(e.message||'Could not delete booking block.','error');
        }
      });
    });
  }

  function toLocalDateTimeInput(value) {
    if(!value) return '';
    var raw=String(value).trim().replace(' ','T');
    var match=raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return match ? match[1]+'T'+match[2] : '';
  }

  function localInputToStorage(value) {
    // Preserve the exact local clock selected in datetime-local.
    // The Z suffix is intentional: it makes the stored clock components
    // stable and prevents Supabase timestamptz from shifting them.
    return value + ':00Z';
  }

  function openBookingRuleForm(id) {
    bookingConfigState.editingRuleId=id||null;
    var r=id?bookingConfigState.rules.find(function(x){return Number(x.id)===Number(id);}):null;
    $('booking-rule-form-title').textContent=r?'Edit booking block':'Add booking block';
    $('booking-rule-start').value=r?toLocalDateTimeInput(r.starts_at):'';
    $('booking-rule-end').value=r?toLocalDateTimeInput(r.ends_at):'';
    $('booking-rule-form-card').classList.remove('crm-hidden');
    $('booking-rule-form-card').scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function loadBookingConfig() {
    var cfg=await window.salonDatabase.getBookingConfiguration();
    bookingConfigState.settings=cfg.settings||{};
    bookingConfigState.rules=cfg.schedule||[];
    var s=bookingConfigState.settings;
    var weekdaySlot=$('booking-weekday-slot-minutes'); if(weekdaySlot) weekdaySlot.value=s.weekday_slot_minutes ?? s.slot_minutes ?? 30;
    var weekdayOpening=$('booking-weekday-opening-time'); if(weekdayOpening) weekdayOpening.value=String(s.weekday_opening_time||s.opening_time||'09:00').slice(0,5);
    var weekdayClosing=$('booking-weekday-closing-time'); if(weekdayClosing) weekdayClosing.value=String(s.weekday_closing_time||s.closing_time||'18:00').slice(0,5);
    var weekendSlot=$('booking-weekend-slot-minutes'); if(weekendSlot) weekendSlot.value=s.weekend_slot_minutes ?? 30;
    var weekendOpening=$('booking-weekend-opening-time'); if(weekendOpening) weekendOpening.value=String(s.weekend_opening_time||'10:00').slice(0,5);
    var weekendClosing=$('booking-weekend-closing-time'); if(weekendClosing) weekendClosing.value=String(s.weekend_closing_time||'16:00').slice(0,5);
    var advance=$('booking-advance-months'); if(advance) advance.value=s.advance_months??3;
    var messages=$('booking-messages-json'); if(messages) messages.value=JSON.stringify(s.messages||{},null,2);
    var dateText=$('booking-date-text-json'); if(dateText) dateText.value=JSON.stringify(s.date_time_text||{},null,2);
    var review=$('booking-review-text-json'); if(review) review.value=JSON.stringify(s.review_text||{},null,2);
    renderBookingRules();
  }

  async function saveBookingSettings(e) {
    e.preventDefault();
    try {
      var weekdaySlot=Number($('booking-weekday-slot-minutes').value);
      var weekdayOpening=$('booking-weekday-opening-time').value;
      var weekdayClosing=$('booking-weekday-closing-time').value;
      var weekendSlot=Number($('booking-weekend-slot-minutes').value);
      var weekendOpening=$('booking-weekend-opening-time').value;
      var weekendClosing=$('booking-weekend-closing-time').value;

      if(!weekdaySlot || !weekendSlot || !weekdayOpening || !weekdayClosing || !weekendOpening || !weekendClosing){
        throw new Error('Please complete both weekday and weekend schedule settings.');
      }
      if(weekdayClosing <= weekdayOpening){
        throw new Error('Weekday closing time must be after the weekday opening time.');
      }
      if(weekendClosing <= weekendOpening){
        throw new Error('Weekend closing time must be after the weekend opening time.');
      }

      await window.salonDatabase.updateBookingSettings({
        // Keep the legacy fields aligned with Monday-Friday for older integrations.
        slot_minutes:weekdaySlot,
        opening_time:weekdayOpening,
        closing_time:weekdayClosing,
        weekday_slot_minutes:weekdaySlot,
        weekday_opening_time:weekdayOpening,
        weekday_closing_time:weekdayClosing,
        weekend_slot_minutes:weekendSlot,
        weekend_opening_time:weekendOpening,
        weekend_closing_time:weekendClosing,
        advance_months:Number($('booking-advance-months').value)
      });
      await loadBookingConfig(); message('Booking settings saved.','success');
    } catch(err){ console.error(err); message(err.message||'Could not save booking settings.','error'); }
  }

  async function saveBookingText(e) {
    e.preventDefault();
    try {
      var messages=JSON.parse($('booking-messages-json').value||'{}');
      var dateText=JSON.parse($('booking-date-text-json').value||'{}');
      var review=JSON.parse($('booking-review-text-json').value||'{}');
      await window.salonDatabase.updateBookingSettings({messages:messages,date_time_text:dateText,review_text:review});
      await loadBookingConfig(); message('Booking page text saved.','success');
    } catch(err){ console.error(err); message(err.name==='SyntaxError'?'One of the JSON fields is invalid.':(err.message||'Could not save booking text.'),'error'); }
  }

  async function saveBookingRule(e) {
    e.preventDefault();
    var start=$('booking-rule-start').value;
    var end=$('booking-rule-end').value;
    if(!start || !end){message('Please choose both a start and end date/time.','error');return;}
    // datetime-local values are local wall-clock values. Compare their
    // components directly, then store the exact same components.
    if(end <= start){
      message('The end date/time must be after the start date/time.','error');return;
    }
    var payload={
      starts_at:localInputToStorage(start),
      ends_at:localInputToStorage(end)
    };
    try {
      if(bookingConfigState.editingRuleId) await window.salonDatabase.updateBookingScheduleRule(bookingConfigState.editingRuleId,payload);
      else await window.salonDatabase.createBookingScheduleRule(payload);
      $('booking-rule-form-card').classList.add('crm-hidden');
      bookingConfigState.editingRuleId=null;
      await loadBookingConfig(); message('Booking block saved.','success');
    } catch(err){console.error(err);message(err.message||'Could not save booking block.','error');}
  }


  document.addEventListener('DOMContentLoaded', function(){
    var save=$('booking-settings-form'); if(save)save.addEventListener('submit',saveBookingSettings);
    var text=$('booking-text-form'); if(text)text.addEventListener('submit',saveBookingText);
    var refresh=$('booking-config-refresh'); if(refresh)refresh.addEventListener('click',function(){loadBookingConfig().catch(function(e){message(e.message||'Could not load booking configuration.','error');});});
    var add=$('new-booking-rule'); if(add)add.addEventListener('click',function(){openBookingRuleForm(null);});
    var cancel=$('cancel-booking-rule'); if(cancel)cancel.addEventListener('click',function(){$('booking-rule-form-card').classList.add('crm-hidden');bookingConfigState.editingRuleId=null;});
    var form=$('booking-rule-form'); if(form)form.addEventListener('submit',saveBookingRule);
    var startInput=$('booking-rule-start');
    var endInput=$('booking-rule-end');
    if(startInput && endInput){
      startInput.addEventListener('change',function(){
        if(startInput.value) endInput.min=startInput.value;
        if(endInput.value && endInput.value<=startInput.value) endInput.value='';
      });
    }
    document.querySelectorAll('[data-view="booking-config"]').forEach(function(btn){btn.addEventListener('click',function(){loadBookingConfig().catch(function(e){console.error(e);message(e.message||'Could not load booking configuration.','error');});});});
  });

})();
