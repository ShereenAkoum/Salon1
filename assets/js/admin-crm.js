(function () {
  'use strict';

  var state = { categories: [], services: [], users: [], editingServiceId: null, editingCategoryId: null, editingUserId: null, currentView: 'dashboard', currentRole: null, currentUserId: null };
  var CRM_INVITE_REDIRECT = window.location.origin + window.location.pathname + '?invite=1';

  function $(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function message(text, type) {
    var el = $('app-message') || $('login-message');
    if (!el) return;
    el.textContent = text; el.className = 'crm-message show ' + (type || 'success');
  }
  function clearMessage() {
    ['app-message', 'login-message'].forEach(function (id) { var el = $(id); if (el) { el.textContent = ''; el.className = 'crm-message'; } });
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

  function isCrmAdmin() {
    return state.currentRole === 'admin';
  }

  async function loadData() {
    var cats = await window.salonSupabase.from('service_categories').select('*').order('sort_order', { ascending: true });
    if (cats.error) throw cats.error;
    var services = await window.salonSupabase.from('services').select('*').order('sort_order', { ascending: true });
    if (services.error) throw services.error;
    state.categories = cats.data || []; state.services = services.data || [];
    renderCategories(); renderServices(); populateCategorySelect(); updateDashboard();
  }
  async function loadUsers() {
    if (!isCrmAdmin()) {
      state.users = [];
      $('stat-users') && ($('stat-users').textContent = '—');
      return;
    }
    var result = await window.salonSupabase.from('admin_users').select('*').order('created_at', { ascending: true });
    if (result.error) throw result.error;
    state.users = result.data || []; renderUsers();
    $('stat-users') && ($('stat-users').textContent = state.users.length);
  }
  function categoryName(id) { var c = state.categories.find(function (x) { return String(x.id) === String(id); }); return c ? c.name_en : '—'; }

  function renderCategories() {
    $('category-table-body').innerHTML = state.categories.map(function (c) {
      return '<tr><td><strong>' + escapeHtml(c.name_en) + '</strong><br><span class="crm-small">' + escapeHtml(c.name_ar) + '</span></td>' +
        '<td>' + escapeHtml(c.image_url || '') + '</td><td>' + escapeHtml(c.image_width || '') + ' × ' + escapeHtml(c.image_height || '') + '</td>' +
        '<td>' + (c.active ? '<span class="crm-badge active">Active</span>' : '<span class="crm-badge inactive">Inactive</span>') + '</td>' +
        '<td><button class="crm-btn crm-btn-secondary" data-edit-category="' + c.id + '">Edit</button></td></tr>';
    }).join('');
  }
  function renderServices() {
    $('service-table-body').innerHTML = state.services.map(function (s) {
      return '<tr><td>' + escapeHtml(s.sku || '') + '</td><td><strong>' + escapeHtml(s.name_en) + '</strong><br><span class="crm-small">' + escapeHtml(s.name_ar) + '</span></td>' +
        '<td>' + escapeHtml(categoryName(s.category_id)) + '</td><td class="crm-price">$' + escapeHtml(s.price_usd == null ? '' : s.price_usd) + '<br><span class="crm-price-muted">' + (s.price_qar == null ? '—' : escapeHtml(s.price_qar) + ' QAR') + '</span></td>' +
        '<td>' + (s.duration_minutes == null ? '—' : escapeHtml(s.duration_minutes) + ' min') + '</td><td>' + (s.active ? '<span class="crm-badge active">Active</span>' : '<span class="crm-badge inactive">Inactive</span>') + '</td>' +
        '<td><button class="crm-btn crm-btn-secondary" data-edit-service="' + s.id + '">Edit</button></td></tr>';
    }).join('');
  }
  function renderUsers() {
    $('users-table-body').innerHTML = state.users.map(function (u) {
      var role = (u.role || 'staff').replace(/^./, function (x) { return x.toUpperCase(); });
      var status = u.active !== false;
      var isSelf = state.currentUserId && String(u.user_id) === String(state.currentUserId);
      return '<tr><td><strong>' + escapeHtml(u.full_name || 'CRM user') + '</strong><br><span class="crm-small">' + (isSelf ? 'You' : 'CRM team member') + '</span></td><td>' + escapeHtml(u.email || '—') + '</td>' +
        '<td><span class="crm-role-badge">' + escapeHtml(role) + '</span></td>' +
        '<td>' + (status ? '<span class="crm-badge active">Active</span>' : '<span class="crm-badge inactive">Inactive</span>') + '</td>' +
        '<td>' + escapeHtml(u.created_at ? new Date(u.created_at).toLocaleDateString() : '—') + '</td>' +
        '<td><div class="crm-actions-inline"><button type="button" class="crm-btn crm-btn-secondary crm-btn-small" data-edit-user="' + escapeHtml(u.user_id) + '">Edit</button>' +
        (isSelf ? '' : '<button type="button" class="crm-btn ' + (status ? 'crm-btn-danger' : 'crm-btn-secondary') + ' crm-btn-small" data-toggle-user="' + escapeHtml(u.user_id) + '">' + (status ? 'Deactivate' : 'Activate') + '</button>') +
        '</div></td></tr>';
    }).join('') || '<tr><td colspan="6">No CRM users found.</td></tr>';
  }
  function updateDashboard() {
    var active = state.services.filter(function (s) { return s.active !== false; }).length;
    $('stat-services').textContent = active; $('stat-categories').textContent = state.categories.filter(function (c) { return c.active !== false; }).length + ' categories';
    $('stat-users') && ($('stat-users').textContent = state.users.length);
  }
  function populateCategorySelect() {
    $('service-category').innerHTML = state.categories.map(function (c) { return '<option value="' + c.id + '">' + escapeHtml(c.name_en) + '</option>'; }).join('');
  }
  function resetServiceForm() { state.editingServiceId = null; $('service-form').reset(); $('service-form-title').textContent = 'Add Service'; $('service-save').textContent = 'Add Service'; populateCategorySelect(); }
  function editService(id) {
    var s = state.services.find(function (x) { return String(x.id) === String(id); }); if (!s) return;
    state.editingServiceId = s.id; $('service-form-title').textContent = 'Edit Service'; $('service-save').textContent = 'Save Changes';
    $('service-category').value = s.category_id || ''; $('service-sku').value = s.sku || ''; $('service-name-en').value = s.name_en || ''; $('service-name-ar').value = s.name_ar || '';
    $('service-description-en').value = s.description_en || ''; $('service-description-ar').value = s.description_ar || '';
    $('service-price-usd').value = s.price_usd == null ? '' : s.price_usd; $('service-price-qar').value = s.price_qar == null ? '' : s.price_qar;
    $('service-duration').value = s.duration_minutes == null ? '' : s.duration_minutes; $('service-sort').value = s.sort_order || 0; $('service-active').checked = s.active !== false;
    showView('services'); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function saveService(e) {
    e.preventDefault(); clearMessage();
    var usd = $('service-price-usd').value;
    var payload = {
      category_id: Number($('service-category').value), sku: $('service-sku').value.trim() || null, name_en: $('service-name-en').value.trim(), name_ar: $('service-name-ar').value.trim(),
      description_en: $('service-description-en').value.trim() || null, description_ar: $('service-description-ar').value.trim() || null, price: usd === '' ? 0 : Number(usd),
      price_usd: usd === '' ? null : Number(usd), price_qar: $('service-price-qar').value === '' ? null : Number($('service-price-qar').value),
      duration_minutes: $('service-duration').value === '' ? null : Number($('service-duration').value), sort_order: Number($('service-sort').value || 0), active: $('service-active').checked
    };
    if (!payload.name_en || !payload.name_ar || !payload.category_id) { message('Please enter the English name, Arabic name and category.', 'error'); return; }
    var result = state.editingServiceId ? await window.salonSupabase.from('services').update(payload).eq('id', state.editingServiceId) : await window.salonSupabase.from('services').insert(payload);
    if (result.error) { message(result.error.message, 'error'); return; } message(state.editingServiceId ? 'Service updated.' : 'Service added.', 'success'); resetServiceForm(); await loadData();
  }
  function editCategory(id) {
    var c = state.categories.find(function (x) { return String(x.id) === String(id); }); if (!c) return;
    state.editingCategoryId = c.id; $('category-form-title').textContent = 'Edit Category'; $('category-save').textContent = 'Save Changes';
    $('category-name-en').value = c.name_en || ''; $('category-name-ar').value = c.name_ar || ''; $('category-description-en').value = c.description_en || ''; $('category-description-ar').value = c.description_ar || '';
    $('category-image').value = c.image_url || ''; $('category-width').value = c.image_width == null ? '' : c.image_width; $('category-height').value = c.image_height == null ? '' : c.image_height; $('category-sort').value = c.sort_order || 0; $('category-active').checked = c.active !== false;
    showView('services'); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function resetCategoryForm() { state.editingCategoryId = null; $('category-form').reset(); $('category-form-title').textContent = 'Add Category'; $('category-save').textContent = 'Add Category'; $('category-active').checked = true; }
  async function saveCategory(e) {
    e.preventDefault(); clearMessage();
    var payload = {
      name_en: $('category-name-en').value.trim(), name_ar: $('category-name-ar').value.trim(), description_en: $('category-description-en').value.trim() || null, description_ar: $('category-description-ar').value.trim() || null,
      image_url: $('category-image').value.trim() || null, image_width: $('category-width').value === '' ? null : Number($('category-width').value), image_height: $('category-height').value === '' ? null : Number($('category-height').value), sort_order: Number($('category-sort').value || 0), active: $('category-active').checked
    };
    if (!payload.name_en || !payload.name_ar) { message('Please enter the English and Arabic category names.', 'error'); return; }
    var result = state.editingCategoryId ? await window.salonSupabase.from('service_categories').update(payload).eq('id', state.editingCategoryId) : await window.salonSupabase.from('service_categories').insert(payload);
    if (result.error) { message(result.error.message, 'error'); return; } message(state.editingCategoryId ? 'Category updated.' : 'Category added.', 'success'); resetCategoryForm(); await loadData();
  }

  function showView(view) {
    if (view === 'users' && !isCrmAdmin()) {
      message('Only administrators can manage CRM users.', 'error');
      return;
    }
    state.currentView = view;
    document.querySelectorAll('.crm-view').forEach(function (el) { el.classList.add('crm-hidden'); });
    var target = $('view-' + view); if (target) target.classList.remove('crm-hidden');
    document.querySelectorAll('.crm-nav-item').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    var titles = { dashboard: ['Overview', 'Dashboard'], services: ['Catalog', 'Services'], users: ['Access control', 'Users & Access'], vouchers: ['Marketing', 'Vouchers'], bookings: ['Appointments', 'Bookings'], customers: ['Customers', 'Customers'] };
    var t = titles[view] || titles.dashboard; $('view-eyebrow').textContent = t[0]; $('view-title').textContent = t[1];
    if (view === 'users') loadUsers().catch(function (e) { message(e.message, 'error'); });
    if (view === 'dashboard') updateDashboard();
    $('crm-sidebar').classList.remove('open');
  }

  async function inviteUser(e) {
    e.preventDefault(); clearMessage();
    if (!isCrmAdmin()) { message('Only administrators can invite CRM users.', 'error'); return; }
    var payload = { email: $('user-email').value.trim(), full_name: $('user-name').value.trim(), role: $('user-role').value, redirect_to: CRM_INVITE_REDIRECT };
    if (!payload.email || !payload.full_name) { message('Please enter a name and email.', 'error'); return; }
    var button = e.submitter || $('user-form').querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Sending…'; }
    try {
      var result = await window.salonSupabase.functions.invoke('invite-crm-user', { body: payload });
      if (result.error) {
        var detail = (result.data && result.data.error) || result.error.message || 'Could not send invitation.';
        message(detail, 'error'); return;
      }
      message('Invitation sent to ' + payload.email + '.', 'success'); $('user-form').reset(); $('user-form-card').classList.add('crm-hidden'); await loadUsers();
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Send invitation'; }
    }
  }
  function editUser(id) {
    if (!isCrmAdmin()) return;
    var u = state.users.find(function (x) { return String(x.user_id) === String(id); }); if (!u) return;
    state.editingUserId = u.user_id;
    $('edit-user-name').value = u.full_name || '';
    $('edit-user-role').value = u.role || 'staff';
    $('edit-user-active').checked = u.active !== false;
    $('user-edit-email').textContent = u.email || '';
    $('user-edit-card').classList.remove('crm-hidden');
    $('user-form-card').classList.add('crm-hidden');
    $('edit-user-name').focus();
  }
  async function saveUser(e) {
    e.preventDefault(); clearMessage();
    if (!isCrmAdmin() || !state.editingUserId) return;
    if (String(state.editingUserId) === String(state.currentUserId) && !$('edit-user-active').checked) {
      message('You cannot deactivate your own administrator account.', 'error'); return;
    }
    var payload = { full_name: $('edit-user-name').value.trim(), role: $('edit-user-role').value, active: $('edit-user-active').checked };
    if (!payload.full_name) { message('Please enter a display name.', 'error'); return; }
    var result = await window.salonSupabase.from('admin_users').update(payload).eq('user_id', state.editingUserId);
    if (result.error) { message(result.error.message, 'error'); return; }
    message('User updated.', 'success'); state.editingUserId = null; $('user-edit-card').classList.add('crm-hidden'); await loadUsers();
  }
  async function toggleUser(id) {
    if (!isCrmAdmin()) return;
    if (String(id) === String(state.currentUserId)) { message('You cannot deactivate your own administrator account.', 'error'); return; }
    var u = state.users.find(function (x) { return String(x.user_id) === String(id); }); if (!u) return;
    var next = u.active === false;
    var result = await window.salonSupabase.from('admin_users').update({ active: next }).eq('user_id', id);
    if (result.error) { message(result.error.message, 'error'); return; }
    message(next ? 'User activated.' : 'User deactivated.', 'success'); await loadUsers();
  }
  function isInviteSetup() {
    return new URLSearchParams(window.location.search).get('invite') === '1';
  }
  function showPasswordSetup() {
    $('crm-login').classList.add('crm-hidden'); $('crm-app').classList.add('crm-hidden'); $('crm-password-setup').classList.remove('crm-hidden');
    $('setup-password').focus();
  }
  function passwordSetupMessage(text, type) {
    var el = $('password-setup-message'); el.textContent = text; el.className = 'crm-message show ' + (type || 'success');
  }
  async function finishPasswordSetup(e) {
    e.preventDefault();
    var password = $('setup-password').value, confirm = $('setup-password-confirm').value;
    if (password.length < 8) { passwordSetupMessage('Password must be at least 8 characters.', 'error'); return; }
    if (password !== confirm) { passwordSetupMessage('The passwords do not match.', 'error'); return; }
    var button = e.submitter;
    if (button) { button.disabled = true; button.textContent = 'Saving…'; }
    try {
      var result = await window.salonSupabase.auth.updateUser({ password: password });
      if (result.error) { passwordSetupMessage(result.error.message, 'error'); return; }
      history.replaceState({}, document.title, window.location.pathname);
      $('crm-password-setup').classList.add('crm-hidden');
      if (!(await requireAdmin())) { await window.salonSupabase.auth.signOut(); showLogin(); message('Your invitation was accepted, but this account is not authorized for the salon CRM.', 'error'); return; }
      state.currentUserId = result.data.user.id; showApp(); $('current-user-email').textContent = result.data.user.email || 'CRM user'; applyRoleVisibility(); await loadData(); await loadUsers();
      message('Password created. Welcome to the salon CRM.', 'success');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Create password →'; }
    }
  }
  function showLogin() { $('crm-login').classList.remove('crm-hidden'); $('crm-app').classList.add('crm-hidden'); }
  async function signOut() { await window.salonSupabase.auth.signOut(); showLogin(); }
  async function login(e) {
    e.preventDefault(); clearMessage();
    var result = await window.salonSupabase.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-password').value });
    if (result.error) { message(result.error.message, 'error'); return; }
    if (!(await requireAdmin())) { await window.salonSupabase.auth.signOut(); message('This account is not authorized to access the salon CRM.', 'error'); return; }
    showApp(); $('current-user-email').textContent = result.data.user.email || 'CRM user'; applyRoleVisibility(); await loadData(); await loadUsers();
  }
  function applyRoleVisibility() {
    document.querySelectorAll('[data-admin-only]').forEach(function (el) {
      el.classList.toggle('crm-hidden', !isCrmAdmin());
    });
  }
  function showApp() { $('crm-login').classList.add('crm-hidden'); $('crm-app').classList.remove('crm-hidden'); applyRoleVisibility(); }

  document.addEventListener('DOMContentLoaded', async function () {
    $('login-form').addEventListener('submit', login); $('service-form').addEventListener('submit', saveService); $('category-form').addEventListener('submit', saveCategory);
    $('user-form').addEventListener('submit', inviteUser); $('user-cancel').addEventListener('click', function () { $('user-form-card').classList.add('crm-hidden'); });
    $('user-edit-form').addEventListener('submit', saveUser); $('user-edit-cancel').addEventListener('click', function () { $('user-edit-card').classList.add('crm-hidden'); state.editingUserId = null; });
    $('password-setup-form').addEventListener('submit', finishPasswordSetup);
    $('invite-user-btn').addEventListener('click', function () { $('user-form-card').classList.remove('crm-hidden'); $('user-name').focus(); });
    $('new-service-top').addEventListener('click', function () { resetServiceForm(); showView('services'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    $('service-reset').addEventListener('click', resetServiceForm); $('category-reset').addEventListener('click', resetCategoryForm); $('logout').addEventListener('click', signOut);
    document.querySelectorAll('.crm-nav-item').forEach(function (b) { b.addEventListener('click', function () { showView(b.getAttribute('data-view')); }); });
    document.querySelectorAll('[data-view-target]').forEach(function (b) { b.addEventListener('click', function () { showView(b.getAttribute('data-view-target')); }); });
    $('mobile-menu').addEventListener('click', function () { $('crm-sidebar').classList.toggle('open'); });
    $('service-table-body').addEventListener('click', function (e) { var b = e.target.closest('[data-edit-service]'); if (b) editService(b.getAttribute('data-edit-service')); });
    $('category-table-body').addEventListener('click', function (e) { var b = e.target.closest('[data-edit-category]'); if (b) editCategory(b.getAttribute('data-edit-category')); }); $('users-table-body').addEventListener('click', function (e) { var edit = e.target.closest('[data-edit-user]'); if (edit) editUser(edit.getAttribute('data-edit-user')); var toggle = e.target.closest('[data-toggle-user]'); if (toggle) toggleUser(toggle.getAttribute('data-toggle-user')); });
    try {
      // Handle Supabase invitation callback before checking the session.
      // Supabase may return a PKCE ?code=... parameter.
      var urlParams = new URLSearchParams(window.location.search);
      var inviteMode = isInviteSetup();
      var authCode = urlParams.get('code');

      if (inviteMode && authCode) {
        var exchangeResult = await window.salonSupabase.auth.exchangeCodeForSession(authCode);

        if (exchangeResult.error) {
          console.error('Invitation exchange failed:', exchangeResult.error);
          showLogin();
          message('This invitation link is invalid or has expired. Please request a new invitation.', 'error');
          return;
        }

        // Remove the temporary code from the browser URL,
        // but keep ?invite=1 so we know this is the password setup flow.
        history.replaceState(
          {},
          document.title,
          window.location.pathname + '?invite=1'
        );
      }

      var sessionResult = await window.salonSupabase.auth.getSession();
      var session = sessionResult.data.session;

      if (isInviteSetup() && session) {
        state.currentUserId = session.user.id;
        showPasswordSetup();
      } else if (await requireAdmin()) {
        state.currentUserId = session && session.user ? session.user.id : null;
        showApp(); $('current-user-email').textContent = session && session.user ? session.user.email : 'CRM user'; applyRoleVisibility(); await loadData(); await loadUsers();
      } else showLogin();
    } catch (e) { console.error(e); showLogin(); }
  });
})();