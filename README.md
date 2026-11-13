# Relay CRM

A responsive sales CRM prototype for businesses selling through WhatsApp, Instagram, and Messenger.

## Run

Requires Node.js 24 or newer. No external runtime packages or API keys are needed.

```sh
cd /workspace/ai_again
npm start
```

The server listens on port 3000 (override with `PORT`). `npm run dev` enables server watch mode. Run `npm test` for API and persistence tests.

## Included

- Dashboard, shared inbox, customer list, catalog, channel and product analytics, integration and workspace settings previews.
- SQLite persistence in ignored `data/crm.sqlite`; initial sample customers, messages, and products seed on first start.
- Send local replies, update conversation status, search and filter conversations, and export CSV.
- REST endpoints: `GET /api/overview`, `GET /api/conversations/:id`, `POST /api/conversations/:id/messages` (`body`), `PATCH /api/conversations/:id` (`status`).

## Prototype boundaries

This is a single-workspace design prototype, not a production SaaS. All customers, stock, and messages are samples. The dashboard's seven-day activity chart is illustrative. Inbox replies persist locally but are not sent externally. Sample AI responses and classifications are seeded; no LLM is connected. Overview cards and analytics read current conversation status.

Before production: implement authentication, tenant-scoped authorization and data isolation, secure sessions, rate limits, audit logs, Meta OAuth/webhooks and signature validation, consent and retention controls, real order/payment reconciliation, LLM integration, and subscription billing. Never expose this unauthenticated demo to sensitive customer data. Meta connections require each business's authorization and applicable review. Google Fonts is optional; system fonts work offline.

## GitHub Pages interactive preview

The `Publish CRM preview` workflow publishes `public/` from `main`. In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, then rerun the workflow if necessary. The expected URL is `https://gehad77.github.io/ai_again/` once deployment succeeds.

On GitHub Pages, the app uses sample JSON and browser local storage instead of the Node API. Replies and status changes stay in that browser, with no real messages sent. Clear site storage to reset the demo. To exercise this mode locally, open the site with `?demo=1`. The Node/SQLite backend remains available for local development; Pages does not host it.
