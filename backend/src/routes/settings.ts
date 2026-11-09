import { Router } from "express";
import QRCode from "qrcode";
import { z } from "zod";
import { getSettings } from "../models/Settings";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { config } from "../config";
import { normalizePhone } from "../utils/phone";
import { razorpayConfigured, whatsappConfigured } from "../config";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const s = await getSettings();
    const display =
      s.whatsappDisplayNumber || config.whatsapp.displayNumber || "";
    const digits = normalizePhone(display);
    const waLink = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent("Hi")}`
      : "";
    const qrDataUrl = waLink
      ? await QRCode.toDataURL(waLink, { width: 512, margin: 1 })
      : "";
    res.json({
      name: s.name,
      intro: s.intro,
      whatsappDisplayNumber: display,
      timezone: s.timezone,
      dayStartHour: s.dayStartHour,
      waLink,
      qrDataUrl,
      whatsappConfigured,
      razorpayConfigured,
    });
  })
);

settingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(80).optional(),
        intro: z.string().min(1).max(500).optional(),
        whatsappDisplayNumber: z.string().max(20).optional(),
        timezone: z.string().min(1).optional(),
        dayStartHour: z.number().int().min(0).max(23).optional(),
      })
      .parse(req.body);
    const s = await getSettings();
    Object.assign(s, body);
    await s.save();
    res.json(s);
  })
);
