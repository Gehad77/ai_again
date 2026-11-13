# Relay CRM

A responsive sales CRM prototype for businesses selling through WhatsApp, Instagram, and Messenger.

## Run

Requires Node.js 24 or newer and PostgreSQL 17 (Docker Compose is provided). Install packages with `npm ci`.

```sh
cd /workspace/ai_again
npm ci
cp .env.example .env
# Edit .env: replace both password placeholders. Set SEED_DEMO=1 for sample data.
docker compose up -d --wait
npm start
```

The server listens on port 3000 (override with `PORT`). `npm run dev` enables server watch mode. Run `npm test` for API and persistence tests.

## Included

- Dashboard, shared inbox, customer list, catalog, channel and product analytics, integration and workspace settings previews.
- PostgreSQL persistence configured through `DATABASE_URL`; sample data is opt-in with `SEED_DEMO=1`.
- Send local replies, update conversation status, search and filter conversations, and export CSV.
- REST endpoints: `GET /api/overview`, `GET /api/conversations/:id`, `POST /api/conversations/:id/messages` (`body`), `PATCH /api/conversations/:id` (`status`).

## Prototype boundaries

This is a single-workspace design prototype, not a production SaaS. All customers, stock, and messages are samples. The dashboard's seven-day activity chart is illustrative. Inbox replies persist locally but are not sent externally. Sample AI responses and classifications are seeded; no LLM is connected. Overview cards and analytics read current conversation status.

Before production: implement authentication, tenant-scoped authorization and data isolation, secure sessions, rate limits, audit logs, Meta OAuth/webhooks and signature validation, consent and retention controls, real order/payment reconciliation, LLM integration, and subscription billing. Never expose this unauthenticated demo to sensitive customer data. Meta connections require each business's authorization and applicable review. Google Fonts is optional; system fonts work offline.

## GitHub Pages interactive preview

The `Publish CRM preview` workflow publishes `public/` from `main`. In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, then rerun the workflow if necessary. The expected URL is `https://gehad77.github.io/ai_again/` once deployment succeeds.

On GitHub Pages, the app uses sample JSON and browser local storage instead of the Node API. Replies and status changes stay in that browser, with no real messages sent. Clear site storage to reset the demo. To exercise this mode locally, open the site with `?demo=1`. The Node/PostgreSQL backend remains available for local development; Pages does not host it.

## Sales and inventory analytics

Analytics now includes current stock, paid units sold, paid item revenue, gross profit from recorded line costs, paid order count, average paid order value, current retail stock value, and low-stock warnings (10 units or fewer). Product and channel breakdowns reconcile to the sample order ledger; CSV export respects sales period/channel filters. Current inventory remains global regardless of sales filters. Inquiry, price concern, and inactive-chat counts use all conversation history for the selected channel because chat timestamps are not yet recorded.

Order fixtures are dated November 4–13, 2026. Paid order totals exclude pending, cancelled, and refunded records. This prototype does not model refund cash flow, stock movements, shipping, taxes, or operating expenses. Chat status changes do not create orders or update stock. An initial sample order ledger is seeded only when `SEED_DEMO=1`; GitHub Pages users keep their local replies and statuses while receiving the new sample ledger.


## PostgreSQL connection and existing data

The local database is named `relay_crm`, on `127.0.0.1:5432`, with user `relay`. Its complete connection URL is in ignored `.env` under `DATABASE_URL`; never publish that file or put the URL in frontend code. The port is bound only to loopback. Docker retains data in the `relay_postgres` volume; do not run `docker compose down -v` unless you intend to delete the database. `docker compose up -d --wait` restarts the database in future sessions. PostgreSQL must be reachable before starting the backend.

To import the old SQLite database into an empty PostgreSQL destination, disable `SEED_DEMO` and run `npm run db:import-sqlite -- /absolute/path/to/crm.sqlite`. The import is transactional, preserves IDs and messages, refuses a populated destination, and leaves the original SQLite file untouched. Once imported, leave `SEED_DEMO=0`. Demo seed initialization is repeatable without overwriting existing records. API tests use a temporary PostgreSQL schema and clean up only that schema; the configured database user needs schema creation permission. `node --test tests/analytics.test.js` runs database-independent analytics tests.

For a hosted database, create a PostgreSQL project in your own Neon, Supabase, or other provider account. Set its connection URL securely as `DATABASE_URL` on a backend hosting service (never in GitHub Pages JavaScript). Use the provider's documented TLS settings with certificate verification enabled; do not disable verification. The provider supplies a private connection URL and a separate browser dashboard URL. No hosted account or hosted database has been provisioned by this repository. GitHub Pages continues to serve the browser-only preview; deploying this backend is a separate step.
