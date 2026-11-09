# WhatsApp Restaurant Order Bot — Spec

Living source of truth for what we are building. If something is not in this file, it is not in scope until we add it.

---

## 1. Product

A **WhatsApp-only ordering system for one restaurant**, plus an **owner dashboard**.

- Customer scans a QR → WhatsApp chat → browses menu → cart → pays on Razorpay → gets a queue number.
- Owner sees orders live, edits the menu, marks food ready → customer gets a WhatsApp message.

This is **not** an AI chatbot. It is a button-driven state machine.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Customer UI | Stay inside WhatsApp. No customer website / web menu. |
| Restaurants | One restaurant in v1 |
| Menu complexity | Simple items + quantity. No variants, sizes, or add-ons. |
| Database | MongoDB (Mongoose) |
| Backend | Node.js + TypeScript |
| Owner UI | React dashboard |
| WhatsApp | Meta Cloud API (official) |
| Payments | Razorpay. Webhook is the source of truth. |
| Currency | INR, amounts stored as integer paise |
| Language | English |
| Tax | Prices treated as tax-inclusive. No GST breakup in v1. |
| Fulfillment | Parcel or dine-in only. No delivery address. |
| Contact | WhatsApp number is the phone. Still collect customer name. |
| Dine-in | Requires table number. |
| QR (v1) | One restaurant-wide `wa.me` link. Table-specific QRs later. |

---

## 3. Customer flow

```
Scan QR
  → WhatsApp opens, customer sends first message
  → Intro + buttons (Menu, My Cart, Help)
  → Menu: pick category → pick item (View more if needed) → quantity → cart
  → Place order
  → Parcel or Dine in (dine-in: table number)
  → Name
  → Summary + Pay
  → Razorpay / UPI on the phone
  → Webhook confirms payment (once)
  → Receipt + queue token (#42)
  → Owner marks ready
  → "Order #42 is ready — please collect"
```

Payment is the **only** step that leaves WhatsApp. That is expected (UPI / Razorpay checkout). Browsing, cart, and receipt stay in chat.

---

## 4. WhatsApp UX (stay in chat)

WhatsApp limits: **3 reply buttons** per message, or a **list of 10 rows**. The whole menu cannot appear on one screen. Navigation is the product.

### 4.1 Welcome

Body: short restaurant intro.

Buttons:

- `Menu`
- `My Cart`
- `Help`

### 4.2 Menu → categories

List of categories (Starters, Mains, Breads, …).

- Max 9 categories per page.
- Row 10 = `More categories` when needed.
- A row for `View cart` is allowed when it fits.

### 4.3 Category → items

List of items in that category.

- Row title: item name (24 chars max — keep names short or truncate).
- Row description: `₹220 · tap to add`
- Last row: `View more` or `Back to menu`

### 4.4 Item selected

Message: name, price, short description.

Buttons:

- `Add 1`
- `Choose qty`
- `Back`

Quantity list: 1–9. Optional `10+` later if needed.

`Add 1` / chosen qty appends to the cart (same item → increment qty).

### 4.5 Cart

Text list of lines + total.

Buttons:

- `Place order`
- `Add more`
- `Edit cart`

Edit cart: pick a line → `+1` / `-1` / `Remove`.

Empty cart: tell them, send them to Menu.

### 4.6 Checkout

1. Buttons: `Dine in` · `Parcel` · `Cancel`
2. Dine-in → customer types table number
3. Customer types name
4. Summary (items, qty, total, fulfillment, table, name)
5. Buttons: `Pay now` · `Cancel`

`Pay now` sends a Razorpay payment link in the chat.

### 4.7 After payment

Receipt in chat:

- Token `#42`
- Items + total
- Parcel / dine-in + table
- Status: paid, being prepared

Button: `New order` (clears cart, back to welcome/menu).

### 4.8 Order ready

When owner marks ready:

> Order #42 is ready. Please collect it at the counter.

If the 24-hour WhatsApp session is still open, send a session message. Also register a template `order_ready` so it still sends if the session expired.

---

## 5. Owner dashboard

Web app, desktop-first, usable on phone.

### 5.1 Auth

Email + password login. One owner user in v1.

### 5.2 Live orders

Statuses:

`paid` → `preparing` → `ready` → `completed`

(Orders in `awaiting_payment` are not shown as kitchen tickets.)

Owner can:

- See new paid orders without a full page refresh
- Open an order (items, name, phone, parcel/dine-in, table, token, total)
- Mark **Preparing** / **Ready** / **Completed**
- **Ready** sends the customer WhatsApp message (once)

### 5.3 Menu editor

Categories and items:

- Add, view, edit, hide, delete
- Item fields: name, price, description, photo, available flag, category, sort order
- Hidden / unavailable items disappear from the WhatsApp menu immediately

---

## 6. Architecture

```
QR  →  WhatsApp Cloud API  →  Node.js server  →  MongoDB
                                   │
                                   ├─ Razorpay (create payment link)
                                   ├─ Razorpay webhook (payment.captured)
                                   └─ React dashboard (orders + menu)
```

### 6.1 Repo layout (planned)

```
wp-bot/
  SPEC.md                 ← this file (shared product spec)
  backend/                Node.js API, WhatsApp, Razorpay, MongoDB
  frontend/               React owner dashboard (Vite + Tailwind)
```

Each app has its own `package.json`, `node_modules`, and README. Run them separately from inside the folder.

### 6.2 Server responsibilities

- WhatsApp webhook (verify + inbound messages)
- Conversation state machine
- Menu APIs for dashboard
- Order APIs for dashboard
- Razorpay: create link, receive webhook
- Auth for owner
- Push new orders to dashboard (websocket or SSE)

---

## 7. MongoDB collections

Amounts in **paise** (₹220.00 → `22000`).

### `categories`

- `name`
- `sortOrder`
- `isActive`

### `menuItems`

- `categoryId`
- `name`
- `description`
- `pricePaise`
- `imageUrl`
- `isAvailable`
- `sortOrder`

### `sessions`

One document per WhatsApp number.

- `waPhone` (unique)
- `state` — e.g. `welcome` | `browsing_categories` | `browsing_items` | `item_detail` | `cart` | `checkout_fulfillment` | `checkout_table` | `checkout_name` | `checkout_confirm` | `awaiting_payment`
- `categoryId`, `page`
- `selectedItemId`
- `cart[]` — `{ itemId, name, pricePaise, qty }`
- `checkout` — `{ fulfillment, tableNumber, customerName, pendingOrderId }`
- `updatedAt`

Cart lives here until payment. After pay, cart is cleared.

### `orders`

Snapshot of the cart at checkout. Later menu edits must not change a placed order.

- `tokenNumber` — assigned **only after payment**
- `businessDate` — restaurant day, e.g. `2026-09-18`
- unique index on `(businessDate, tokenNumber)`
- `waPhone`, `customerName`
- `fulfillment` — `dine_in` | `parcel`
- `tableNumber` — required if dine-in
- `items[]` — `{ itemId, name, pricePaise, qty }`
- `totalPaise`
- `status` — `awaiting_payment` | `paid` | `preparing` | `ready` | `completed` | `cancelled` | `payment_failed`
- `razorpayPaymentLinkId`
- `razorpayPaymentId` — unique, sparse
- `paidAt`, `readyAt`, `completedAt`
- `readyNotifiedAt` — so “order ready” is sent once

### `processedEvents`

Idempotency log.

- `eventId` (unique) — Razorpay `x-razorpay-event-id` or WhatsApp message id (`wamid`)
- `source` — `razorpay` | `whatsapp`
- `processedAt`

### `counters`

Daily queue.

- `_id` — `queue:YYYY-MM-DD`
- `seq` — last issued token

### `users`

- `email` (unique)
- `passwordHash`
- `name`
- `role` — `owner` in v1

### `settings` (single restaurant doc)

- `name`
- `whatsappPhoneNumberId` / display number
- `timezone`
- `dayStartHour` — when the token counter resets (default 06:00)
- Razorpay keys live in env, not in this document

---

## 8. Payment + idempotency

Webhook is the only thing that marks an order paid. The Razorpay browser redirect is **not** trusted.

### 8.1 Place order

1. Freeze cart onto a new `orders` doc, status `awaiting_payment`.
2. Create Razorpay payment link for **exact** `totalPaise`, put our `order_id` in notes.
3. Save `razorpayPaymentLinkId` on the order.
4. Send the link in WhatsApp.
5. Session state → `awaiting_payment`.

### 8.2 Webhook `payment.captured`

1. Verify HMAC on the **raw** request body (`X-Razorpay-Signature`).
2. Insert `x-razorpay-event-id` into `processedEvents`. Duplicate key → ignore, return 200.
3. Match our order via notes / payment link / Razorpay order id.
4. Reject if `payment.amount` !== `order.totalPaise`.
5. `findOneAndUpdate` the order **only if** `status === awaiting_payment` and `razorpayPaymentId` is empty:
   - set `razorpayPaymentId`, `status: paid`, `paidAt`
   - assign next token (see §9)
6. If modified count is 0, this payment was already applied → stop.
7. Unique index on `razorpayPaymentId` blocks two orders claiming the same payment.
8. Clear the WhatsApp cart, send receipt + token.
9. Push the order to the dashboard.

Respond **200 quickly**. Do the WhatsApp send after the DB write. Razorpay retries on non-2xx; retries must be safe.

### 8.3 Failed payment

Order stays `awaiting_payment` (or `payment_failed` if we choose to flag it). Bot can send **Pay again** with the same or a new link. Never mark paid from the client.

### 8.4 Inbound WhatsApp dedupe

Store WhatsApp `wamid` in `processedEvents`. The same tap retried by Meta must not add the item twice.

---

## 9. Queue / token number

- Resets each restaurant day (default 06:00 local time).
- Assigned **only when payment succeeds**, inside the paid transition.
- First paid order of the day is `#1`.

Atomic increment:

```
counters.findOneAndUpdate(
  { _id: "queue:YYYY-MM-DD" },
  { $inc: { seq: 1 } },
  { upsert: true, returnDocument: "after" }
)
```

Write `seq` onto the order as `tokenNumber`. Unique index `(businessDate, tokenNumber)` is the safety net.

Unpaid carts never consume a token.

---

## 10. Conversation state machine

Customer is keyed by `waPhone`. Every inbound message is handled by the current `sessions.state`.

| State | Input | Next |
|---|---|---|
| (new / welcome) | any text / Menu | show welcome or categories |
| browsing_categories | category row | browsing_items |
| browsing_categories | More categories | next page |
| browsing_items | item row | item_detail |
| browsing_items | View more | next page |
| item_detail | Add 1 / qty | cart (or stay + confirm) |
| cart | Place order | checkout_fulfillment |
| checkout_fulfillment | Dine in / Parcel | table or name |
| checkout_table | number | checkout_name |
| checkout_name | text | checkout_confirm |
| checkout_confirm | Pay now | awaiting_payment |
| awaiting_payment | webhook success | welcome + receipt |

Global shortcuts (work from most states): `Menu`, `My Cart`, `Help`.

---

## 11. WhatsApp constraints we must respect

| Thing | Limit |
|---|---|
| Reply buttons | 3, title ≤ 20 chars |
| List rows | 10 total per message |
| List row title | 24 chars |
| List row description | 72 chars |
| Interactive messages | Only inside 24-hour customer session |
| Outbound after 24h | Approved template only |

That is why menu is **category → page of items → view more**, not one giant list.

---

## 12. Out of scope for v1

- Customer-facing website or web catalog
- Item variants (half/full, extra cheese, spice level)
- Delivery to an address
- Multi-restaurant / multi-branch
- Table-specific QR codes
- GST invoice PDF
- Swiggy / Zomato
- Unofficial WhatsApp libraries
- LLM / free-text ordering

---

## 13. Build order

Do these in order. Do not skip ahead.

1. **Foundation** — `backend` + `frontend` apps, MongoDB, env, owner auth.
2. **Menu** — collections + APIs + dashboard CRUD (add / edit / hide / delete).
3. **WhatsApp bot** — webhook verify, welcome, categories, paginated items, quantity, cart.
4. **Checkout + pay** — name, parcel/dine-in, table, Razorpay link, idempotent webhook, receipt + token.
5. **Kitchen** — live orders on dashboard, mark preparing/ready/completed, “order ready” WhatsApp.
6. **QR + harden** — generate the `wa.me` QR, unavailable items, pay-again, session expiry, message dedupe.

---

## 14. Env vars (backend)

```
PORT
MONGODB_URI
JWT_SECRET
FRONTEND_ORIGIN
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_DISPLAY_NUMBER
WHATSAPP_API_VERSION
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

Never commit secrets. Never put Razorpay/WhatsApp keys in the dashboard bundle.

---

## 15. Definition of done (v1)

A stranger can scan the QR, order two items entirely in WhatsApp, pay on Razorpay, receive token `#N`, show up on the owner dashboard, get “order ready” when the owner taps Ready, and a second identical Razorpay webhook does **not** create a second order or a second token.

Menu changes in the dashboard show up in the next WhatsApp Menu tap.
