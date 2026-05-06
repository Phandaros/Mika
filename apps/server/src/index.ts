import http from "node:http";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { initSocket } from "./lib/socket.js";
import apiRoutes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const server = http.createServer(app);

initSocket(server, env.CLIENT_URL);

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/v1", apiRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

server.listen(env.PORT, "0.0.0.0", () => {
  console.log(`MK Projetos server running on port ${env.PORT}`);
});

async function shutdown(): Promise<void> {
  await prisma.$disconnect();
  server.close();
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
