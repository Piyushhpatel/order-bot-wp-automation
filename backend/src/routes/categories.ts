import { Router } from "express";
import { z } from "zod";
import { Category } from "../models/Category";
import { MenuItem } from "../models/MenuItem";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await Category.find().sort({ sortOrder: 1, name: 1 });
    res.json(rows);
  })
);

categoriesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(40),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);
    const row = await Category.create(body);
    res.status(201).json(row);
  })
);

categoriesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(40).optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);
    const row = await Category.findByIdAndUpdate(req.params.id, body, {
      new: true,
    });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  })
);

categoriesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await MenuItem.deleteMany({ categoryId: req.params.id });
    const row = await Category.findByIdAndDelete(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  })
);
