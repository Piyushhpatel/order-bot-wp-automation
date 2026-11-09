# wp-bot

WhatsApp ordering bot for one restaurant, plus an owner dashboard.

Customers scan a QR, browse the menu in WhatsApp, and pay with Razorpay. The owner edits the menu and marks orders ready from the dashboard. Ready orders send a WhatsApp message. This is a button-driven flow, not an AI chatbot.

Product rules live in [SPEC.md](SPEC.md).

## Layout

```
backend/    Node.js + TypeScript API (WhatsApp, Razorpay, MongoDB)
frontend/   React owner dashboard (Vite + Tailwind)
SPEC.md     What we are building
```

Each app has its own `package.json`. Run them from their own folders.

## Run locally

You need Node.js, and MongoDB on `localhost:27017` (or `docker compose up -d` inside `backend/`).

```bash
# API
cd backend
cp .env.sample .env
npm install
npm run seed
npm run dev
```

```bash
# Dashboard
cd frontend
npm install
npm run dev
```

- API: http://localhost:4000/health
- Dashboard: http://localhost:5173
- Seeded login: `owner@demo.local` / `changeme`

The dashboard proxies `/api` to the API. Start the backend first.

WhatsApp and Razorpay keys go in `backend/.env` only. Names are listed in `backend/.env.sample`. Meta cannot call localhost, so expose the API with `npm run tunnel` from `backend/` and point the webhooks at the public host. Details are in [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).
