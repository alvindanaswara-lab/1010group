# 1010Group Warehouse

React and Vite build the screens. A Cloudflare Worker serves the app and its same-origin API. Supabase Auth manages staff credentials. PostgreSQL stores one versioned record per order, PO, receipt, outlet, vendor, report, and SKU/month, plus a separate stock movement ledger. Existing JSON document shapes preserve compatibility with the screens and Excel/PDF exports. This is a new Supabase schema; confirm the deployed project's existing records before cutover.

## Staging setup

1. Use Node 24 LTS and run `npm install`, `npm run lint`, and `npm run build`. Save the generated `package-lock.json` with the repository after the first successful install.
2. Apply `supabase/migrations/20261113060000_warehouse_core.sql` to a staging Supabase project via its SQL Editor or migration workflow. Keep `warehouse_private` outside the Data API's exposed schemas. Enable email/password sign-in and disable public signup for the staff-only application.
3. Create the first confirmed staff account in Supabase Authentication. In SQL Editor, run the following, replacing the email and name with those of the designated administrator.

   ```sql
   insert into warehouse_private.profiles(id, email, username, position)
   select id, email, 'Warehouse Admin', 'Administrator'
   from auth.users where lower(email) = lower('admin@example.com');
   ```

   Confirm that one row was inserted. Sign in with that work email. In **System & Setting**, add the real outlets/departments first, then create staff accounts. Import the item master and opening stock into the correct period. Login uses work email; the username is the display name.

4. In `wrangler.jsonc`, set the intended staging Worker name. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the legacy JWT `SUPABASE_SERVICE_ROLE_KEY` as Worker secrets (`npx wrangler secret put <NAME>` or through Cloudflare). The publishable key can also be a legacy anon key. Use the legacy service-role JWT for the Auth admin endpoint configured here. Keep that key server-only. For local Worker testing, copy `.dev.vars.example` to `.dev.vars` and run `npm run dev:worker`.
5. Deploy with `npm run deploy` or configure Workers Builds with `npm run build` and `npx wrangler deploy`. Use HTTPS. The app and `/api/*` must share the same origin. The `vite preview` command serves the frontend only.
6. Optional Gmail integration: supply `VITE_GMAIL_FIREBASE_API_KEY`, `VITE_GMAIL_FIREBASE_AUTH_DOMAIN`, and `VITE_GMAIL_FIREBASE_PROJECT_ID` at build time. Register the Worker domain with the separate Firebase Google sign-in setup. That integration handles vendor Gmail only. Warehouse staff login uses Supabase.

## Cutover

The old app stored data per browser. Use `scripts/export-legacy-browser.js` from each source browser on the existing app to export records before replacing the old deployment or clearing its data. Reconcile duplicates and audit which inventory period is authoritative. Recreate staff accounts with fresh passwords. Use the existing item master and outlet request Excel imports for opening stock and open requests. For historical POs and receipts, reconcile and migrate them separately before enabling historical reporting. Import opening balances with the physical count and retain historical movements as a distinct history so they are not posted twice. Existing browser data is never uploaded automatically.

## Pilot acceptance

- Admin creates an outlet account in one browser. That staff member signs in from another browser and submits a request for 2.5 kg. A warehouse account sees it, and a different outlet cannot see it.
- Purchasing sends the PO to Finance. Finance approves each line. Changing the price returns it to Vendor Summary and blocks release until the revision is approved again.
- Receive separate lines of the same SKU, including fractional quantities. For 4 units at Rp100,000 and 6 at Rp120,000, the accumulated value is Rp1,120,000. A concurrent save from a stale browser must receive a conflict and leave stock unchanged.
- Before closing a month, post movements in the next period using opening stock staged for the pilot. Close the prior stock count. Existing next-period inbound and outbound must survive, and rerunning close must not move stock again.
- Run `node scripts/check-core.mjs` for dependency-free business rules and mocked Worker checks. Run the complete workflow against staging to validate the real Supabase schema and Cloudflare build before switching production.

## Difference from STOK

This app consolidates requested quantities and produces a draft PO that becomes releasable after Cost Control approval. It retains per-outlet and department allocations, distinct receipt lines, and a monthly stock closing workflow. STOK’s documented workflow first reviews purchase need and rechecks usable stock before creating a purchasing PR. Its buying decision accounts for minimum/target, open PR/PO, pending replacements, and paused items. STOK also uses a distinct approved/awaiting-purchase state, locked SKU prices with exceptions, vendor-grouped POs and an aging warning. These replenishment and document rules are a separate workflow change from this migration.
