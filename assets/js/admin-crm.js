(function () {
  'use strict';

  var state = { categories: [], services: [], users: [], bookings: [], bookingFilter: 'all', bookingDateFilter: 'all', bookingSearch: '', bookingVouchers: [], bookingView: 'schedule', scheduleDate: new Date(), editingServiceId: null, editingCategoryId: null, editingUserId: null, currentView: 'dashboard', currentRole: null, currentUserId: null };
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

  function isCrmAdmin() {
    return state.currentRole === 'admin';
  }

  async function loadData() {
    var cats = await window.salonSupabase.from('service_categories').select('*').order('sort_order',{ascending:true});
    if (cats.error) throw cats.error;
    var services = await window.salonSupabase.from('services').select('*').order('sort_order',{ascending:true});
    if (services.error) throw services.error;
    state.categories=cats.data||[]; state.services=services.data||[];
    renderCategories(); renderServices(); populateCategorySelect(); updateDashboard();
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
  function updateDashboard() {
    var active=state.services.filter(function(s){return s.active!==false;}).length;
    $('stat-services').textContent=active; $('stat-categories').textContent=state.categories.filter(function(c){return c.active!==false;}).length+' categories';
    $('stat-users') && ($('stat-users').textContent=state.users.length);
    $('stat-bookings') && ($('stat-bookings').textContent=state.bookings.length);
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
    $('service-duration').value=s.duration_minutes==null?'':s.duration_minutes;$('service-sort').value=s.sort_order||0;$('service-active').checked=s.active!==false;
    showView('services'); window.scrollTo({top:0,behavior:'smooth'});
  }
  async function saveService(e){
    e.preventDefault(); clearMessage();
    var usd=$('service-price-usd').value;
    var payload={category_id:Number($('service-category').value),sku:$('service-sku').value.trim()||null,name_en:$('service-name-en').value.trim(),name_ar:$('service-name-ar').value.trim(),
      description_en:$('service-description-en').value.trim()||null,description_ar:$('service-description-ar').value.trim()||null,price:usd===''?0:Number(usd),
      price_usd:usd===''?null:Number(usd),price_qar:$('service-price-qar').value===''?null:Number($('service-price-qar').value),
      duration_minutes:$('service-duration').value===''?null:Number($('service-duration').value),sort_order:Number($('service-sort').value||0),active:$('service-active').checked};
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
     * Supabase is the source of truth for CRM bookings.
     *
     * IMPORTANT: the live bookings table does NOT use the old JSON fields
     * (date/items/total/customer). It uses booking_date, customer_id,
     * total_price and booking_services. The old query ordered by `date`,
     * which made Supabase return an error and silently sent the CRM to the
     * local JSON fallback. That is why confirmed test bookings were shown
     * while the real pending booking was missing.
     */
    var dbBookings = null;
    try {
      var result = await window.salonSupabase
        .from('bookings')
        .select('id,public_reference,customer_id,booking_date,start_time,end_time,status,total_price,total_duration_minutes,customer_notes,created_at')
        .order('id',{ascending:false});
      if (result.error) throw result.error;

      var rows = result.data || [];
      var customerIds = rows.map(function(r){ return r.customer_id; }).filter(function(id){ return id != null; });
      var customersById = {};
      if (customerIds.length) {
        var cr = await window.salonSupabase
          .from('customers')
          .select('id,name,phone,email,notes')
          .in('id', Array.from(new Set(customerIds)));
        if (cr.error) throw cr.error;
        (cr.data || []).forEach(function(c){ customersById[String(c.id)] = c; });
      }

      var bookingIds = rows.map(function(r){ return r.id; }).filter(function(id){ return id != null; });
      var bookingServices = [];
      if (bookingIds.length) {
        var br = await window.salonSupabase
          .from('booking_services')
          .select('id,booking_id,service_id,start_time,end_time,price,duration_minutes')
          .in('booking_id', Array.from(new Set(bookingIds)));
        if (br.error) throw br.error;
        bookingServices = br.data || [];
      }

      var serviceIds = bookingServices.map(function(r){ return r.service_id; }).filter(function(id){ return id != null; });
      var servicesById = {};
      if (serviceIds.length) {
        var sr = await window.salonSupabase
          .from('services')
          .select('id,sku,name_en,name_ar,price_usd,price_qar')
          .in('id', Array.from(new Set(serviceIds)));
        if (sr.error) throw sr.error;
        (sr.data || []).forEach(function(svc){ servicesById[String(svc.id)] = svc; });
      }

      var itemsByBooking = {};
      bookingServices.forEach(function(item){
        var key=String(item.booking_id);
        if(!itemsByBooking[key]) itemsByBooking[key]=[];
        var svc=servicesById[String(item.service_id)] || {};
        itemsByBooking[key].push({
          serviceSku: svc.sku || '',
          start: String(item.start_time || '').slice(0,5),
          end: String(item.end_time || '').slice(0,5),
          price: item.price,
          duration_minutes: item.duration_minutes,
          serviceName: svc.name_en || ''
        });
      });
      Object.keys(itemsByBooking).forEach(function(key){
        itemsByBooking[key].sort(function(a,b){ return a.start.localeCompare(b.start); });
      });

      dbBookings = rows.map(function(row){
        var customer = customersById[String(row.customer_id)] || {};
        return {
          id: row.public_reference || String(row.id),
          databaseId: row.id,
          date: row.booking_date,
          status: String(row.status || 'pending').toLowerCase(),
          total: row.total_price,
          currency: 'USD',
          customer: {
            name: customer.name || 'Customer',
            phone: customer.phone || '',
            email: customer.email || '',
            notes: row.customer_notes || customer.notes || ''
          },
          items: itemsByBooking[String(row.id)] || [],
          created_at: row.created_at
        };
      });
    } catch (e) {
      console.warn('Could not load Supabase bookings; using test fallback.', e);
      dbBookings = null;
    }

    /*
     * Only use local/JSON data when the Supabase request actually failed.
     * If Supabase succeeds and contains zero bookings, the CRM must show zero
     * bookings rather than resurrecting old confirmed test data.
     */
    var local = bookingStore();
    if (dbBookings === null && !local.length) {
      try {
        var response = await fetch('assets/data/bookings.json', { cache: 'no-store' });
        if (response.ok) {
          var data = await response.json();
          local = Array.isArray(data.bookings) ? data.bookings : [];
        }
      } catch (e) {}
    }

    try {
      var vr = await fetch('assets/data/vouchers.json', { cache: 'no-store' });
      if (vr.ok) {
        var vd = await vr.json();
        state.bookingVouchers = Array.isArray(vd) ? vd : [];
      }
    } catch (e) { state.bookingVouchers = []; }

    var source = dbBookings !== null ? dbBookings : local;
    state.bookings = source.slice().sort(function(a,b) {
      return Number(b.databaseId || 0) - Number(a.databaseId || 0);
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
    var found = state.services.find(function(s){ return String(s.sku || '') === String(item.serviceSku || ''); });
    if (found) return { name: found.name_en || found.name || item.serviceSku, duration: found.duration_minutes, price: found.price_usd };
    var voucher = state.bookingVouchers.find(function(v){ return String(v.sku || v.id || '') === String(item.serviceSku || ''); });
    if (voucher) return { name: voucher.title || 'Voucher', duration: voucher.durationMinutes, price: voucher.price, voucher: true };
    return { name: item.serviceSku || 'Service', duration: null, price: null };
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
    var s = bookingStatus(b);
    return s === 'pending' || s === 'confirmed';
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
      status:status,
      updated_at:new Date().toISOString()
    }).eq('id',id);
    if(result.error) throw result.error;
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
      '<div class="crm-detail-section"><div class="crm-section-label">Services</div>' + items + '</div>' +
      '<div class="crm-detail-total"><span>Total</span><strong>' + bookingMoney(b) + '</strong></div>' +
      (c.notes ? '<div class="crm-detail-section"><div class="crm-section-label">Customer notes</div><p class="crm-detail-notes">' + escapeHtml(c.notes) + '</p></div>' : '') +
      '<div class="crm-detail-actions">' + nextStatuses + '</div>';
    $('booking-detail-modal').classList.remove('crm-hidden');
    $('booking-detail-modal').setAttribute('aria-hidden','false');
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
    if(view==='users' && !isCrmAdmin()){
      message('Only administrators can manage CRM users.','error');
      return;
    }
    state.currentView=view;
    document.querySelectorAll('.crm-view').forEach(function(el){el.classList.add('crm-hidden');});
    var target=$('view-'+view); if(target)target.classList.remove('crm-hidden');
    document.querySelectorAll('.crm-nav-item').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-view')===view);});
    var titles={dashboard:['Overview','Dashboard'],services:['Catalog','Services'],users:['Access control','Users & Access'],vouchers:['Marketing','Vouchers'],bookings:['Appointments','Bookings'],customers:['Customers','Customers']};
    var t=titles[view]||titles.dashboard;$('view-eyebrow').textContent=t[0];$('view-title').textContent=t[1];
    if(view==='users') loadUsers().catch(function(e){message(e.message,'error');});
    if(view==='bookings') loadBookings().catch(function(e){message(e.message,'error');});
    if(view==='dashboard') updateDashboard();
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
      state.currentUserId=result.data.user.id;showApp();$('current-user-email').textContent=result.data.user.email||'CRM user';applyRoleVisibility();await loadData();await loadUsers();await loadBookings();
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
    showApp();$('current-user-email').textContent=result.data.user.email||'CRM user';applyRoleVisibility();await loadData();await loadUsers();await loadBookings();
  }
  function applyRoleVisibility(){
    document.querySelectorAll('[data-admin-only]').forEach(function(el){
      el.classList.toggle('crm-hidden',!isCrmAdmin());
    });
  }
  function showApp(){$('crm-login').classList.add('crm-hidden');$('crm-app').classList.remove('crm-hidden');applyRoleVisibility();}

  document.addEventListener('DOMContentLoaded',async function(){
    $('login-form').addEventListener('submit',login);$('service-form').addEventListener('submit',saveService);$('category-form').addEventListener('submit',saveCategory);
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
    $('booking-detail-content').addEventListener('click',function(e){var b=e.target.closest('[data-booking-status]');if(b)updateBookingStatus(b.getAttribute('data-booking-id'),b.getAttribute('data-booking-status'));});
    document.querySelectorAll('[data-booking-view]').forEach(function(b){b.addEventListener('click',function(){setBookingView(b.getAttribute('data-booking-view'));});});
    $('schedule-prev').addEventListener('click',function(){state.scheduleDate.setDate(state.scheduleDate.getDate()-7);renderSchedule();});
    $('schedule-next').addEventListener('click',function(){state.scheduleDate.setDate(state.scheduleDate.getDate()+7);renderSchedule();});
    $('schedule-today').addEventListener('click',function(){state.scheduleDate=new Date();renderSchedule();});
    $('booking-schedule-grid').addEventListener('click',function(e){var b=e.target.closest('[data-view-booking]');if(b)renderBookingDetail(b.getAttribute('data-view-booking'));});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeBookingDetail();});

    $('service-table-body').addEventListener('click',function(e){var b=e.target.closest('[data-edit-service]');if(b)editService(b.getAttribute('data-edit-service'));});
    $('category-table-body').addEventListener('click',function(e){var b=e.target.closest('[data-edit-category]');if(b)editCategory(b.getAttribute('data-edit-category'));}); $('users-table-body').addEventListener('click',function(e){var edit=e.target.closest('[data-edit-user]');if(edit)editUser(edit.getAttribute('data-edit-user'));var toggle=e.target.closest('[data-toggle-user]');if(toggle)toggleUser(toggle.getAttribute('data-toggle-user'));});
    try{
      var sessionResult=await window.salonSupabase.auth.getSession();
      var session=sessionResult.data.session;
      if(isInviteSetup() && session){
        state.currentUserId=session.user.id;showPasswordSetup();
      } else if(await requireAdmin()){
        state.currentUserId=session&&session.user?session.user.id:null;
        showApp();$('current-user-email').textContent=session&&session.user?session.user.email:'CRM user';applyRoleVisibility();await loadData();await loadUsers();await loadBookings();
      } else showLogin();
    } catch(e){console.error(e);showLogin();}
  });
})();