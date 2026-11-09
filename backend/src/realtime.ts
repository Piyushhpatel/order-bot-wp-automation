import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "./config";
import type { OrderDoc } from "./models/Order";

let io: Server | null = null;

export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: config.frontendOrigin, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || "");
      jwt.verify(token, config.jwtSecret);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("owners");
  });

  return io;
}

export function emitOrder(event: "order:new" | "order:updated", order: OrderDoc) {
  io?.to("owners").emit(event, order.toObject ? order.toObject() : order);
}
