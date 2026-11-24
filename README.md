# Relay CRM

A responsive sales CRM prototype for businesses selling through WhatsApp, Instagram, and Messenger.

## Dashboard language, currency, and social inbox

Use **Settings → Workspace preferences** to save the business name, Arabic or English, currency, reporting time zone, default reporting period, and low-stock threshold in PostgreSQL. It changes how existing amounts are displayed and interpreted without exchange-rate conversion.

The owner dashboard reads actual workspace records. The website ordering and signup routes are closed by default, and the hosted dashboard removes the browser demo and static sample activity. Existing records are retained. Demo seeding is available in local development and disabled in production.

To receive texts from Meta, set a Render secret `META_APP_SECRET` from your Meta app and define a strong private `META_VERIFY_TOKEN`. In Meta's product-specific webhook settings, use the address shown under **Integrations**, ending in `/api/social/webhook`, and the same verification token. Connect your WhatsApp Business number, Instagram professional account, or Facebook Page with the applicable permissions, then subscribe it to message events. The inbox shows signed inbound text and keeps the original message language. Integrations shows the first messages once received and reports counts. Outbound messages and media are outside this integration.

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

This is a single-workspace design prototype, not a production SaaS. Sample customers, stock, and messages are available in demo mode. The dashboard's seven-day activity chart is illustrative. Inbox replies persist locally but are not sent externally. Sample AI responses and classifications are seeded; no LLM is connected. Overview cards and analytics read current conversation status.

Before production: extend owner authentication with account recovery and login rate limits, tenant-scoped authorization and data isolation, secure sessions, rate limits, audit logs, Meta OAuth/webhooks and signature validation, consent and retention controls, real order/payment reconciliation, LLM integration, and subscription billing. Never expose this unauthenticated demo to sensitive customer data. Meta connections require each business's authorization and applicable review. Google Fonts is optional; system fonts work offline.

## GitHub Pages interactive preview

The `Publish CRM preview` workflow publishes `public/` from `main`. In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, then rerun the workflow if necessary. The expected URL is `https://gehad77.github.io/ai_again/` once deployment succeeds.

On GitHub Pages, the app uses sample JSON and browser local storage instead of the Node API. Replies and status changes stay in that browser, with no real messages sent. Clear site storage to reset the demo. To exercise this mode locally, open the site with `?demo=1`. The Node/PostgreSQL backend remains available for local development; Pages does not host it.

## Sales and inventory analytics

Analytics now includes current stock, paid units sold, paid item revenue, gross profit from recorded line costs, paid order count, average paid order value, current retail stock value, and low-stock warnings (10 units or fewer). Product and channel breakdowns reconcile to the sample order ledger; CSV export respects sales period/channel filters. Current inventory remains global regardless of sales filters. Inquiry, price concern, and inactive-chat counts use all conversation history for the selected channel because chat timestamps are not yet recorded.

Order fixtures are dated November 4–13, 2026. Paid order totals exclude pending, cancelled, and refunded records. This prototype does not model refund cash flow, shipping or taxes. Chat status changes do not create orders or update stock. An initial sample order ledger is seeded only when `SEED_DEMO=1`; GitHub Pages users keep their local replies and statuses while receiving the new sample ledger.


## PostgreSQL connection and existing data

The local database is named `relay_crm`, on `127.0.0.1:5432`, with user `relay`. Its complete connection URL is in ignored `.env` under `DATABASE_URL`; never publish that file or put the URL in frontend code. The port is bound only to loopback. Docker retains data in the `relay_postgres` volume; do not run `docker compose down -v` unless you intend to delete the database. `docker compose up -d --wait` restarts the database in future sessions. PostgreSQL must be reachable before starting the backend.

To import the old SQLite database into an empty PostgreSQL destination, disable `SEED_DEMO` and run `npm run db:import-sqlite -- /absolute/path/to/crm.sqlite`. The import is transactional, preserves IDs and messages, refuses a populated destination, and leaves the original SQLite file untouched. Once imported, leave `SEED_DEMO=0`. Demo seed initialization is repeatable without overwriting existing records. API tests use a temporary PostgreSQL schema and clean up only that schema; the configured database user needs schema creation permission. `node --test tests/analytics.test.js` runs database-independent analytics tests.

For a hosted database, create a PostgreSQL project in your own Neon, Supabase, or other provider account. Set its connection URL securely as `DATABASE_URL` on a backend hosting service (never in GitHub Pages JavaScript). Use the provider's documented TLS settings with certificate verification enabled; do not disable verification. The provider supplies a private connection URL and a separate browser dashboard URL. No hosted account or hosted database has been provisioned by this repository. GitHub Pages continues to serve the browser-only preview; deploying this backend is a separate step.

## Owner sign-in, products, and orders

On a development backend, the first visit prompts you to create the single workspace owner account (email and a password of 12–128 characters). Production owner setup uses the hosting shell as described below. Later visits use sign-in; sign-out revokes the current session. Passwords use salted scrypt hashes, and seven-day sessions use HttpOnly, SameSite cookies. Use HTTPS and NODE_ENV=production for secure cookies when deploying. Account recovery and multiple user accounts are not yet supported. Initialize the owner before exposing a new instance publicly.

Use **Add product** on the dashboard or Products page to enter a name, category, price, and stock. In **Inbox**, select a conversation and use **Create order from chat** to choose a product, quantity, selling price, cost, channel, and status. Customers can also request orders themselves from `/shop`. Orders receive the current timestamp. Paid orders atomically reduce stock and reject insufficient inventory; other statuses do not change stock. The order ledger and analytics refresh after saving. Existing seeded ledger entries do not retroactively deduct stock.

GitHub Pages and `?demo=1` offer an explicitly labeled demo entry screen instead of real authentication. Product and order changes in this mode stay in browser storage. Real sign-in and PostgreSQL persistence require the Node backend. Workspace API access requires a signed-in owner.

## Customer chat and ordering

Share `https://ai-again.onrender.com/shop` with customers. Customers create their own account using a name, email, and password (12–128 characters), then browse the catalog, send messages, and request product quantities directly in their chat. This is website chat with fixed order acknowledgements, not an LLM or a WhatsApp/Instagram connection. Customer accounts and sessions are separate from the owner's account; each customer sees only their own conversation and orders. Customer chat checks for replies every five seconds.

In the owner dashboard, open **Inbox → Refresh inbox**, select the customer, and reply. Linked orders appear in the conversation. **Confirm payment** requires you to have received payment separately and enter the unit cost for profit reporting; it marks the order Paid and deducts stock atomically. Pending orders do not reserve stock. The owner can also use **Create order from chat** for a customer-assisted sale. Product prices for customer requests come from the database, not customer input. Repeated requests with the same request key return the same order.

The existing database is upgraded additively on startup; existing owner credentials, products, messages, and orders are retained. Customers must register themselves; no default or shared customer password is provided. GitHub Pages links customers to the hosted store because it cannot host private chat accounts. Owner and customer account recovery, email verification, payment processing, and Meta integrations remain outside this feature.


## Warehouse and business profile

The owner can open **Overview → Warehouse & sales** to see available quantities by product, withdrawals recorded this month, low stock, and net result. In **Business profile**, use **Add product** or **Edit product** for catalog details and unit cost. Use **Adjust stock** for restocks, count corrections, and damaged or lost inventory. A paid sale deducts stock and records the movement together. A write-off uses the unit cost recorded at the time of the adjustment. Stock already present before this feature is included in the available balance. Movement history starts with new activity.

Select a year and a month, calendar quarter, or full year under **Profit & loss**. Net result subtracts product costs, recorded operating expenses, and inventory write-offs from paid item revenue. New payments count on their confirmation date in Cairo time. Older paid orders use their existing order date. Figures use the workspace's existing USD currency and exclude tax, shipping, and refund cash flow.

Set a revenue target for any month or quarter in the selected year. Each period tracks its own paid revenue. Enter zero to clear a target.

Direct links are `/shop?account=signup` for a new customer, `/shop?account=signin` for a returning customer, and `/#profile` for the owner's business profile after sign-in.

## Owner access, password recovery, and PostgreSQL

**Customers** in the signed-in owner dashboard lists the accounts registered through the shop. This list comes from PostgreSQL. For accounts created before registration timestamps were stored, the date is unavailable.

For production, set `NODE_ENV=production`, `OWNER_EMAIL`, `RESEND_API_KEY` and `RECOVERY_FROM_EMAIL` in the hosting service's environment settings. Resend requires a verified sender domain. Use **Forgot password?** with the existing owner's registered email. The eight-digit code expires after ten minutes, has five verification attempts, and can be replaced after one minute. Resetting the password ends existing owner sessions.

For a new production database, run `npm run owner:setup` in the hosting shell with those settings configured, then use **Forgot password?** to set the first password. This command creates the owner only if the database has none. The settings do not change the email of an existing owner. An authorized database administrator can check the current owner email from a private SQL session using `SELECT email FROM users WHERE id = 1;`.

In Render, open the web service and check **Environment → DATABASE_URL**. It identifies the PostgreSQL instance the live service uses. For a Render-managed database, open that database service and use **Connect** for its connection details. For a database hosted elsewhere, open its provider dashboard for access and backups. Treat all connection URLs as secrets. The local Compose database is `relay_crm` on `127.0.0.1:5432` and contains development data.

If email delivery is unavailable and you control the hosting environment, set `OWNER_EMAIL` to your intended owner email and `OWNER_ACCESS_CODE` to a fresh 32–128-character random value using only letters, digits, underscores, or hyphens. After deployment, open `/?recover=hosting`, enter the one-time code, and choose a password. The page shows which recovery setting needs attention when the code cannot be used. A successful reset updates the single owner, ends previous owner sessions, and opens the dashboard in the current browser. The same code cannot be reused. Remove `OWNER_ACCESS_CODE` from the hosting environment after completing the reset.

The **Expenses** page tracks spending by category and product for the selected month, quarter, or year. Choose a category or type your own, then enter the amount, date, and optional related product. Select **Already included in product cost** only if the amount is already accounted for in product costs used for profit reporting. Such entries count toward total recorded spending, with no extra profit deduction. Existing expenses appear as **Uncategorized** and retain their original effect on profit.


In **Expenses → Sales targets**, save a monthly or quarterly revenue goal and unit goal. The dashboard measures progress using paid orders. Estimates use average paid prices and unit margins, or the selected product price and cost. Break-even and first-profit estimates include recorded operating expenses and inventory write-offs. **Profit by product** deducts linked expenses and write-offs, and the business net result also deducts general expenses.
