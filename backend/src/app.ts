import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { ZodError } from "zod";
import { config, isDev } from "./config";
import { authRouter } from "./routes/auth";
import { categoriesRouter } from "./routes/categories";
import { menuItemsRouter } from "./routes/menuItems";
import { ordersRouter } from "./routes/orders";
import { settingsRouter } from "./routes/settings";
import { whatsappWebhookRouter } from "./routes/webhooksWhatsapp";
import { razorpayWebhookRouter } from "./routes/webhooksRazorpay";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true,
    })
  );
  app.use(morgan(isDev ? "dev" : "combined"));

  app.use(
    "/webhooks/razorpay",
    express.raw({ type: "application/json" }),
    razorpayWebhookRouter
  );

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/webhooks/whatsapp", whatsappWebhookRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/menu-items", menuItemsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/settings", settingsRouter);

  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Invalid input", details: err.errors });
        return;
      }
      const e = err as { message?: string; status?: number };
      console.error(err);
      res.status(e.status || 500).json({ error: e.message || "Server error" });
    }
  );

  return app;
}
