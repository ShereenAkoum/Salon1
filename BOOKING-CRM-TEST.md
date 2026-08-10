# Booking CRM test

This first Booking CRM iteration is connected to the current test booking store used by the booking website:

- `localStorage.salonTestBookings` is the live test source.
- `assets/data/bookings.json` is used as a fallback when the local test store is empty.
- The CRM resolves service names from the Supabase `services` data and voucher names from `assets/data/vouchers.json`.
- Status changes made in the CRM are written back to `localStorage.salonTestBookings`, so cancelled bookings will stop blocking the booking-time selector on the same browser.

This is intentionally a test-stage implementation. It does not yet make Supabase the shared booking database for all devices. The next backend step should be a protected bookings table/Edge Function so public customers can create bookings without exposing write access to the table, while CRM staff can manage them securely.
