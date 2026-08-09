/*
 * Supabase client for the Salon website.
 *
 * This project is a static GitHub Pages site, so we use the browser client
 * instead of the Next.js setup shown in the Supabase dashboard.
 *
 * IMPORTANT:
 * - The publishable/anon key is safe to expose in frontend code when RLS is
 *   configured correctly.
 * - NEVER put a service_role or sb_secret key in this file.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://nonucaahxdwhmtqaoqii.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qJXElJyjAUwZsfCXJFAqOw_v9mf3VuX';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase library was not loaded. Check the CDN script in the page.');
    return;
  }

  window.salonSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  window.salonDatabase = {
    url: SUPABASE_URL,
    isConfigured: true,

    async getServiceCategories() {
      var result = await window.salonSupabase
        .from('service_categories')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (result.error) throw result.error;
      return result.data || [];
    },

    async getServices() {
      var result = await window.salonSupabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (result.error) throw result.error;
      return result.data || [];
    },

    async getWorkingHours() {
      var result = await window.salonSupabase
        .from('working_hours')
        .select('*')
        .order('day_of_week', { ascending: true });

      if (result.error) throw result.error;
      return result.data || [];
    },

    async getBlockedDates() {
      var result = await window.salonSupabase
        .from('blocked_dates')
        .select('*')
        .order('blocked_date', { ascending: true });

      if (result.error) throw result.error;
      return result.data || [];
    },

    async getVouchers() {
      var result = await window.salonSupabase
        .from('vouchers')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (result.error) throw result.error;
      return result.data || [];
    }
  };

  console.info('Salon Supabase client connected:', SUPABASE_URL);
})();
