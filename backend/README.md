# Backend

Node.js API for the WhatsApp order bot, Razorpay, and the owner dashboard.

```bash
cp .env.sample .env
npm install
npm run seed
npm run dev
```

API: http://localhost:4000/health

MongoDB: `localhost:27017`, or `docker compose up -d` from this folder.

## WhatsApp webhook (Cloudflare)

```bash
npm run dev
npm run tunnel
```

Meta callback URL:

```
https://<trycloudflare-host>/webhooks/whatsapp
```

Verify token: `WHATSAPP_VERIFY_TOKEN` in `.env` (default `wp-bot-verify`). Subscribe to **messages**.

## Razorpay webhook

```
https://<trycloudflare-host>/webhooks/razorpay
```

Events: `payment_link.paid`, `payment.captured`, `payment.failed`

Env names are in `.env.sample`. Product rules: `../SPEC.md`.
