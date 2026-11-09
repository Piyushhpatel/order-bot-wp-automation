import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export const config = {
  port: Number(env("PORT", "4000")),
  nodeEnv: env("NODE_ENV", "development"),
  mongoUri: env("MONGODB_URI", "mongodb://127.0.0.1:27017/wp-bot"),
  jwtSecret: env("JWT_SECRET", "dev-only-change-me"),
  frontendOrigin: env("FRONTEND_ORIGIN", "http://localhost:5173"),
  owner: {
    email: env("OWNER_EMAIL", "owner@demo.local").toLowerCase(),
    password: env("OWNER_PASSWORD", "changeme"),
    name: env("OWNER_NAME", "Owner"),
  },
  whatsapp: {
    accessToken: env("WHATSAPP_ACCESS_TOKEN"),
    appId: env("WHATSAPP_APP_ID"),
    phoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID"),
    businessAccountId: env("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    verifyToken: env("WHATSAPP_VERIFY_TOKEN", "wp-bot-verify"),
    appSecret: env("WHATSAPP_APP_SECRET"),
    displayNumber: env("WHATSAPP_DISPLAY_NUMBER"),
    apiVersion: env("WHATSAPP_API_VERSION", "v25.0"),
  },
  razorpay: {
    keyId: env("RAZORPAY_KEY_ID"),
    keySecret: env("RAZORPAY_KEY_SECRET"),
    webhookSecret: env("RAZORPAY_WEBHOOK_SECRET"),
  },
};

export const isDev = config.nodeEnv !== "production";
export const whatsappConfigured = Boolean(
  config.whatsapp.accessToken && config.whatsapp.phoneNumberId
);
export const razorpayConfigured = Boolean(
  config.razorpay.keyId && config.razorpay.keySecret
);
