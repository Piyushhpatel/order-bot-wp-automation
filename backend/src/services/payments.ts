import Razorpay from "razorpay";
import { config, razorpayConfigured } from "../config";
import { Order, OrderDoc } from "../models/Order";
import { Session } from "../models/Session";
import { nextToken } from "../models/Counter";
import { getSettings } from "../models/Settings";
import { businessDate } from "../utils/businessDate";
import { emitOrder } from "../realtime";
import { sendButtons, sendText, toWaUser } from "./whatsapp";
import { formatInr } from "../utils/money";

function client(): Razorpay {
  return new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });
}

/** Official razorpay-node helper. HMAC over the raw webhook body. */
export function verifyRazorpaySignature(
  rawBody: Buffer,
  signature: string | undefined
): boolean {
  if (!config.razorpay.webhookSecret || !signature) return false;
  try {
    return Razorpay.validateWebhookSignature(
      rawBody.toString("utf8"),
      signature,
      config.razorpay.webhookSecret
    );
  } catch {
    return false;
  }
}

export async function createPaymentLink(
  order: OrderDoc
): Promise<{ id: string; shortUrl: string } | null> {
  if (!razorpayConfigured) return null;
  const rzp = client();
  const link = await rzp.paymentLink.create({
    amount: order.totalPaise,
    currency: "INR",
    accept_partial: false,
    reference_id: String(order.id),
    description: `Order ${order.id}`,
    customer: {
      name: order.customerName,
      contact: toWaUser(order.waPhone),
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { orderId: String(order.id) },
  });
  return { id: link.id, shortUrl: link.short_url };
}

export async function markOrderPaid(opts: {
  orderId?: string;
  paymentLinkId?: string;
  paymentId: string;
  amountPaise: number;
}): Promise<OrderDoc | null> {
  const { paymentId, amountPaise } = opts;

  const existingByPayment = await Order.findOne({ razorpayPaymentId: paymentId });
  if (existingByPayment) {
    return ensureToken(existingByPayment);
  }

  let order: OrderDoc | null = null;
  if (opts.orderId) {
    order = await Order.findById(opts.orderId);
  }
  if (!order && opts.paymentLinkId) {
    order = await Order.findOne({ razorpayPaymentLinkId: opts.paymentLinkId });
  }
  if (!order) return null;

  if (order.totalPaise !== amountPaise) {
    console.error("Payment amount mismatch", {
      orderId: String(order.id),
      expected: order.totalPaise,
      got: amountPaise,
    });
    return null;
  }

  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: "awaiting_payment",
      $or: [
        { razorpayPaymentId: { $exists: false } },
        { razorpayPaymentId: null },
        { razorpayPaymentId: "" },
      ],
    },
    {
      $set: {
        status: "paid",
        razorpayPaymentId: paymentId,
        paidAt: new Date(),
      },
    },
    { new: true }
  );

  if (!claimed) {
    const again = await Order.findById(order._id);
    return again ? ensureToken(again) : null;
  }

  const paid = await ensureToken(claimed);
  await afterPaid(paid);
  return paid;
}

async function ensureToken(order: OrderDoc): Promise<OrderDoc> {
  if (order.tokenNumber && order.businessDate) return order;
  const settings = await getSettings();
  const date = businessDate(settings.timezone, settings.dayStartHour);
  const token = await nextToken(date);
  order.tokenNumber = token;
  order.businessDate = date;
  try {
    await order.save();
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e.code === 11000) {
      const fresh = await Order.findById(order._id);
      if (fresh?.tokenNumber) return fresh;
    }
    throw err;
  }
  return order;
}

async function afterPaid(order: OrderDoc): Promise<void> {
  await Session.findOneAndUpdate(
    { waPhone: order.waPhone },
    {
      $set: {
        state: "welcome",
        cart: [],
        checkout: {},
        selectedItemId: undefined,
        editingItemId: undefined,
      },
    }
  );

  emitOrder("order:new", order);

  const lines = order.items
    .map((i) => `• ${i.name} × ${i.qty} — ${formatInr(i.pricePaise * i.qty)}`)
    .join("\n");
  const where =
    order.fulfillment === "dine_in"
      ? `Dine in · Table ${order.tableNumber}`
      : "Parcel";

  const body = [
    `Paid. Your token is *#${order.tokenNumber}*`,
    "",
    where,
    order.customerName,
    "",
    lines,
    "",
    `*Total ${formatInr(order.totalPaise)}*`,
    "",
    "We will message you when it is ready.",
  ].join("\n");

  try {
    await sendButtons(order.waPhone, body, [
      { id: "NEW_ORDER", title: "New order" },
      { id: "HELP", title: "Help" },
    ]);
  } catch (err) {
    console.error("Receipt send failed", err);
    try {
      await sendText(order.waPhone, body);
    } catch (e2) {
      console.error("Receipt text failed", e2);
    }
  }
}

export async function notifyPaymentFailed(order: OrderDoc): Promise<void> {
  order.status = "payment_failed";
  await order.save();
  try {
    await sendButtons(
      order.waPhone,
      "Payment did not go through. You can try again — your cart is saved on this order.",
      [
        { id: "PAY_AGAIN", title: "Pay again" },
        { id: "CANCEL", title: "Cancel" },
        { id: "HELP", title: "Help" },
      ]
    );
  } catch (err) {
    console.error("Failed-payment notice failed", err);
  }
}
