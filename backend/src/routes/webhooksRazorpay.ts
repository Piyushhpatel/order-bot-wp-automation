import { Router, Request, Response } from "express";
import { claimEvent } from "../models/ProcessedEvent";
import { Order } from "../models/Order";
import {
  markOrderPaid,
  notifyPaymentFailed,
  verifyRazorpaySignature,
} from "../services/payments";

export const razorpayWebhookRouter = Router();

razorpayWebhookRouter.post("/", async (req: Request, res: Response) => {
  const raw = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body || {}));

  if (!verifyRazorpaySignature(raw, req.header("x-razorpay-signature"))) {
    res.status(400).json({ error: "invalid signature" });
    return;
  }

  let event: RazorEvent;
  try {
    event = JSON.parse(raw.toString("utf8")) as RazorEvent;
  } catch {
    res.status(400).json({ error: "invalid json" });
    return;
  }

  const eventId =
    req.header("x-razorpay-event-id") || event.id || `body-${Date.now()}`;

  res.status(200).json({ ok: true });

  try {
    const claimed = await claimEvent(eventId, "razorpay");
    if (!claimed) return;

    if (event.event === "payment_link.paid") {
      const link = event.payload?.payment_link?.entity;
      const payment = event.payload?.payment?.entity;
      if (!link && !payment) return;
      const orderId =
        link?.notes?.orderId ||
        payment?.notes?.orderId ||
        link?.reference_id;
      await markOrderPaid({
        orderId,
        paymentLinkId: link?.id,
        paymentId: payment?.id || `plink_${link?.id}`,
        amountPaise: payment?.amount ?? link?.amount_paid ?? link?.amount ?? 0,
      });
      return;
    }

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const payment = event.payload?.payment?.entity;
      if (!payment) return;
      const orderId =
        (payment.notes && (payment.notes.orderId || payment.notes.order_id)) ||
        undefined;
      await markOrderPaid({
        orderId,
        paymentLinkId: payment.payment_link_id,
        paymentId: payment.id,
        amountPaise: payment.amount,
      });
      return;
    }

    if (event.event === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      if (!payment) return;
      const orderId = payment.notes?.orderId;
      const order = orderId
        ? await Order.findById(orderId)
        : payment.payment_link_id
          ? await Order.findOne({
              razorpayPaymentLinkId: payment.payment_link_id,
            })
          : null;
      if (order && order.status === "awaiting_payment") {
        await notifyPaymentFailed(order);
      }
    }
  } catch (err) {
    console.error("Razorpay webhook handler error", err);
  }
});

type Notes = { orderId?: string; order_id?: string };

type RazorEvent = {
  id?: string;
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id: string;
        amount: number;
        notes?: Notes;
        payment_link_id?: string;
      };
    };
    payment_link?: {
      entity?: {
        id: string;
        amount: number;
        amount_paid?: number;
        reference_id?: string;
        notes?: Notes;
      };
    };
  };
};
