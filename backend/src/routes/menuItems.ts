import { Router } from "express";
import path from "path";
import multer from "multer";
import { z } from "zod";
import { MenuItem } from "../models/MenuItem";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { rupeesToPaise } from "../utils/money";

const boolish = z.preprocess((v) => {
  if (v === "false" || v === "0" || v === false) return false;
  if (v === "true" || v === "1" || v === true) return true;
  return v;
}, z.boolean().optional());

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "..", "..", "uploads"),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only jpeg, png, webp images"));
    }
  },
});

export const menuItemsRouter = Router();
menuItemsRouter.use(requireAuth);

menuItemsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q: Record<string, unknown> = {};
    if (req.query.categoryId) q.categoryId = req.query.categoryId;
    const rows = await MenuItem.find(q).sort({ sortOrder: 1, name: 1 });
    res.json(rows);
  })
);

const itemBody = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  priceRupees: z.coerce.number().positive(),
  isAvailable: boolish,
  sortOrder: z.coerce.number().int().optional(),
});

menuItemsRouter.post(
  "/",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const body = itemBody.parse(req.body);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";
    const row = await MenuItem.create({
      categoryId: body.categoryId,
      name: body.name,
      description: body.description || "",
      pricePaise: rupeesToPaise(body.priceRupees),
      isAvailable: body.isAvailable ?? true,
      sortOrder: body.sortOrder ?? 0,
      imageUrl,
    });
    res.status(201).json(row);
  })
);

menuItemsRouter.patch(
  "/:id",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const body = itemBody.partial().parse(req.body);
    const update: Record<string, unknown> = {};
    if (body.categoryId) update.categoryId = body.categoryId;
    if (body.name) update.name = body.name;
    if (body.description !== undefined) update.description = body.description;
    if (body.priceRupees !== undefined)
      update.pricePaise = rupeesToPaise(body.priceRupees);
    if (body.isAvailable !== undefined) update.isAvailable = body.isAvailable;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
    if (req.file) update.imageUrl = `/uploads/${req.file.filename}`;
    const row = await MenuItem.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  })
);

menuItemsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await MenuItem.findByIdAndDelete(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  })
);
