import { Router, Request, Response } from "express";
import { config } from "../config";
import { claimEvent } from "../models/ProcessedEvent";
import { handleIncoming, ParsedInbound } from "../bot";
import { markAsRead, verifyWhatsAppSignature } from "../services/whatsapp";
import { normalizePhone } from "../utils/phone";

export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get("/", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    console.log("[wa] webhook verified");
    res.status(200).send(String(challenge || ""));
    return;
  }
  console.warn("[wa] webhook verify failed");
  res.sendStatus(403);
});

whatsappWebhookRouter.post("/", async (req: Request, res: Response) => {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (raw && !verifyWhatsAppSignature(raw, req.header("x-hub-signature-256"))) {
    console.warn("[wa] bad X-Hub-Signature-256 — check WHATSAPP_APP_SECRET");
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);

  try {
    const body = req.body as WaPayload;
    if (body.object && body.object !== "whatsapp_business_account") {
      console.log("[wa] ignored object", body.object);
      return;
    }
    const messages = extractMessages(body);
    if (!messages.length) {
      console.log("[wa] webhook with no inbound messages (status/echo)");
      return;
    }
    for (const m of messages) {
      console.log("[wa] inbound", m.from, m.type, m.text?.body || m.interactive?.type || "");
      const claimed = await claimEvent(m.id, "whatsapp");
      if (!claimed) {
        console.log("[wa] duplicate", m.id);
        continue;
      }
      const parsed = parseMessage(m);
      if (!parsed) continue;
      await handleIncoming(normalizePhone(m.from), parsed);
      await markAsRead(m.id);
    }
  } catch (err) {
    console.error("[wa] webhook handler error", err);
  }
});

type WaPayload = {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        messages?: WaMessage[];
      };
    }[];
  }[];
};

type WaMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
};

function extractMessages(body: WaPayload): WaMessage[] {
  const out: WaMessage[] = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const m of change.value?.messages || []) {
        out.push(m);
      }
    }
  }
  return out;
}

function parseMessage(m: WaMessage): ParsedInbound | null {
  if (m.type === "text") {
    return { kind: "text", text: m.text?.body || "" };
  }
  if (m.type === "interactive") {
    if (m.interactive?.type === "button_reply") {
      return {
        kind: "button",
        id: m.interactive.button_reply?.id,
        text: m.interactive.button_reply?.title,
      };
    }
    if (m.interactive?.type === "list_reply") {
      return {
        kind: "list",
        id: m.interactive.list_reply?.id,
        text: m.interactive.list_reply?.title,
      };
    }
  }
  return { kind: "text", text: "" };
}
