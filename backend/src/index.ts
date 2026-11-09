import http from "http";
import path from "path";
import fs from "fs";
import { createApp } from "./app";
import { connectDb } from "./db";
import { config } from "./config";
import { initRealtime } from "./realtime";
import { ensureWabaSubscription } from "./services/whatsapp";
import { whatsappConfigured } from "./config";

async function main() {
  const uploadDir = path.join(__dirname, "..", "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);

  server.listen(config.port, () => {
    console.log(`API on http://localhost:${config.port}`);
    console.log(
      `[wa] ${whatsappConfigured ? "Cloud API ready" : "NOT configured — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID"}`
    );
  });
  await ensureWabaSubscription();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
