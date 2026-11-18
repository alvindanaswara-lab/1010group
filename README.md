# 1010Group Warehouse

React and Vite build the screens. A Cloudflare Worker serves the app and its same-origin API. Supabase Auth manages staff credentials. PostgreSQL stores one versioned record per order, PO, receipt, outlet, vendor, report, and SKU/month, plus a separate stock movement ledger. Existing JSON document shapes preserve compatibility with the screens and Excel/PDF exports. Check which migrations and records already exist in your Supabase project before cutover.

## Staging setup

1. Use Node 24 LTS and Bun 1.4.4. Run `bun install --frozen-lockfile`, `bun run lint`, `bun run test`, and `bun run build` from the repository root. Commit `package.json` and `bun.lock` together whenever dependencies change.
2. Apply these migrations in order to a staging Supabase project via its SQL Editor or migration workflow. If the core migration already ran, apply only the second migration after confirming the schema and backing up the project.

   - `supabase/migrations/20261113060000_warehouse_core.sql`
   - `supabase/migrations/20261118050000_warehouse_costs_and_vendor_delivery.sql`

   Keep `warehouse_private` outside the Data API's exposed schemas. Enable email/password sign-in and disable public signup for the staff-only application.
3. For a fresh database, create the first confirmed staff account in Supabase Authentication. In SQL Editor, run the following, replacing the email and name with those of the designated administrator.

   ```sql
   insert into warehouse_private.profiles(id, email, username, position)
   select id, email, 'Warehouse Admin', 'Administrator'
   from auth.users where lower(email) = lower('admin@example.com');
   ```

   Confirm that one row was inserted. Sign in with that work email. In **System & Setting**, add the real outlets/departments first, then create staff accounts. Import the item master and opening stock into the correct period. Login uses work email; the username is the display name.

4. The checked-in Worker name is `1010group`. For staging, use a separate Worker and a configuration whose name matches that Worker. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the legacy JWT `SUPABASE_SERVICE_ROLE_KEY` as Worker secrets (`bun run wrangler secret put <NAME>` or through Cloudflare). The publishable key can also be a legacy anon key. Use the legacy service-role JWT for the Auth admin endpoint configured here. Keep that key server-only. For local Worker testing, copy `.dev.vars.example` to `.dev.vars` and run `bun run dev:worker`.
5. Deploy with `bun run deploy` or configure Workers Builds with `bun run build` and `bun run wrangler deploy`. Use `bun run wrangler deploy --dry-run` after a build to verify the Worker package without publishing it. Use HTTPS. The app and `/api/*` must share the same origin. The `vite preview` command serves the frontend only.
6. Optional Gmail integration: supply `VITE_GMAIL_FIREBASE_API_KEY`, `VITE_GMAIL_FIREBASE_AUTH_DOMAIN`, and `VITE_GMAIL_FIREBASE_PROJECT_ID` at build time. Register the Worker domain with the separate Firebase Google sign-in setup. That integration handles vendor Gmail only. Warehouse staff login uses Supabase.

## Cutover

The old app stored data per browser. Use `scripts/export-legacy-browser.js` from each source browser on the existing app to export records before replacing the old deployment or clearing its data. Reconcile duplicates and audit which inventory period is authoritative. Recreate staff accounts with fresh passwords. Use the existing item master and outlet request Excel imports for opening stock and open requests. For historical POs and receipts, reconcile and migrate them separately before enabling historical reporting. Import opening balances with the physical count and retain historical movements as a distinct history so they are not posted twice. Existing browser data is never uploaded automatically.

## Stock valuation and vendor email

- New stock issues use the moving weighted average for the SKU at posting time. The ledger records the posted issue cost. Later receipts and edits to the budget price leave that amount intact. Opening value for a new month comes from the approved count at the prior period's carrying cost. Inbound and outbound already posted in the new month retain their recorded values.
- The migration starts from existing stored balances. Reconcile opening stock and old outbound corrections with Finance before relying on historical costs. Legacy shipments may show the original order estimate because they have no recorded issue cost.
- Releasing a Finance-approved PO creates its receiving records and a delivery entry for each vendor in one database transaction. Purchasing can then send from the connected Gmail account to the vendor address in Master Vendor. Each message includes one PDF with that vendor's approved items.
- If Gmail accepts an email but the app cannot record the response, use **Periksa folder Terkirim di Gmail** from the original sender's account to reconcile it. Confirm legacy releases against Gmail before handling them manually. A Gmail draft is recorded as pending review until a sent message is found.

## Pilot acceptance

- Admin creates an outlet account in one browser. That staff member signs in from another browser and submits a request for 2.5 kg. A warehouse account sees it, and a different outlet cannot see it.
- Purchasing sends the PO to Finance. Finance approves each line. Changing the price returns it to Vendor Summary and blocks release until the revision is approved again.
- Receive separate lines of the same SKU, including fractional quantities. For 4 units at Rp100,000 and 6 at Rp120,000, the accumulated value is Rp1,120,000. A concurrent save from a stale browser must receive a conflict and leave stock unchanged.
- Before closing a month, post movements in the next period using opening stock staged for the pilot. Close the prior stock count. Existing next-period inbound and outbound must survive, and rerunning close must not move stock again.
- Run `bun run test` for business rules, mock Worker checks, and both migrations in a disposable PostgreSQL database. Run the complete workflow against staging to validate the real Supabase schema and Cloudflare build before switching production.

## Difference from STOK

This app consolidates requested quantities and produces a draft PO that becomes releasable after Cost Control approval. It retains per-outlet and department allocations, distinct receipt lines, and a monthly stock closing workflow. STOK’s documented workflow first reviews purchase need and rechecks usable stock before creating a purchasing PR. Its buying decision accounts for minimum/target, open PR/PO, pending replacements, and paused items. STOK also uses a distinct approved/awaiting-purchase state, locked SKU prices with exceptions, vendor-grouped POs and an aging warning. These replenishment and document rules are a separate workflow change from this migration.
