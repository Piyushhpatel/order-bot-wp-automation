import { Router } from "express";
import { z } from "zod";
import { Order, OrderStatus } from "../models/Order";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { emitOrder } from "../realtime";
import { sendButtons, sendTemplate } from "../services/whatsapp";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "");
    const q: Record<string, unknown> = {};
    if (status) {
      q.status = { $in: status.split(",").filter(Boolean) };
    } else {
      q.status = { $in: ["paid", "preparing", "ready", "completed"] };
    }
    const rows = await Order.find(q).sort({ paidAt: -1, createdAt: -1 }).limit(200);
    res.json(rows);
  })
);

ordersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await Order.findById(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  })
);

ordersRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        status: z.enum(["paid", "preparing", "ready", "completed"]),
      })
      .parse(req.body);

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const allowed: Record<string, OrderStatus[]> = {
      paid: ["preparing", "ready"],
      preparing: ["ready"],
      ready: ["completed"],
      completed: [],
    };
    const next = body.status as OrderStatus;
    if (order.status === next) {
      res.json(order);
      return;
    }
    if (!allowed[order.status]?.includes(next)) {
      res.status(400).json({ error: `Cannot move ${order.status} → ${next}` });
      return;
    }

    order.status = next;
    if (next === "ready") order.readyAt = new Date();
    if (next === "completed") order.completedAt = new Date();
    await order.save();

    if (next === "ready" && !order.readyNotifiedAt) {
      const token = order.tokenNumber ?? "";
      const bodyText = `Order #${token} is ready. Please collect it at the counter.`;
      try {
        await sendButtons(order.waPhone, bodyText, [
          { id: "NEW_ORDER", title: "New order" },
          { id: "HELP", title: "Help" },
        ]);
        order.readyNotifiedAt = new Date();
        await order.save();
      } catch {
        try {
          await sendTemplate(order.waPhone, "order_ready", "en", [String(token)]);
          order.readyNotifiedAt = new Date();
          await order.save();
        } catch (err) {
          console.error("Ready notify failed", err);
        }
      }
    }

    emitOrder("order:updated", order);
    res.json(order);
  })
);
