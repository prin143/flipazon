# Flipazon — Phase 3 full-stack development prototype

Flipazon is a responsive Next.js + React + TypeScript shopping prototype with a PostgreSQL backend. The Phase 3 version keeps the existing navy/yellow/white storefront and adds:

- Customer signup/login and secure server-side sessions
- PostgreSQL product catalog, stock, cart and wishlist
- Checkout form with address validation
- Cash on Delivery order placement with server-side price/stock checks in a transaction
- Customer order history and order confirmation
- Admin order list and controlled status transitions
- Stock restoration when an eligible COD order is cancelled

## Run locally

See `START-HERE-HINDI.md` for the Windows/Hinglish walkthrough.

```powershell
npm install
Copy-Item .env.example .env.local
docker compose up -d
npm run db:setup
npm run dev
```

Open http://localhost:3000.

## Phase 3 business rules

- COD is the only supported payment method. No payment gateway or money movement is connected.
- Shipping is free for subtotal >= ₹999; otherwise it costs ₹49.
- Product prices, order totals and inventory are calculated/checked server-side; the client does not supply prices.
- Checkout requires an authenticated account.
- An order reserves/decrements stock at placement. Admin cancellation of placed/confirmed orders restores stock.
- Order status progression: placed → confirmed → shipped → delivered. Placed/confirmed orders may instead be cancelled.
- `db/schema.sql` uses `CREATE TABLE IF NOT EXISTS`; rerunning `npm run db:setup` adds the Phase 3 tables without wiping existing data.

## API endpoints

- `POST /api/checkout`
- `GET /api/orders`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id`

## Not production-ready yet

Online payments, verified payment webhooks, seller accounts, shipping-provider integration, email notifications, password reset, saved address book, returns/refunds, production rate limiting, monitoring, backup/restore drills, load testing and a formal security review remain future work. Do not use real customer data or launch publicly before those are addressed.
