import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { createCorsOptions } from "./lib/cors.js";
import { normalizeAllProjectSections } from "./lib/canonicalSections.js";
import { prisma } from "./lib/prisma.js";
import { initSocket } from "./lib/socket.js";
import apiRoutes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import mikeAuthRoutes from "./modules/mike/auth/mike-auth.router.js";
import { startWeeklyReportJob } from "./lib/weeklyReportJob.js";
import { repairStoredAttachmentFilenames } from "./lib/attachmentFilename.js";

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../client/dist");

initSocket(server, env.CLIENT_URL);

app.use(cors(createCorsOptions(env.CLIENT_URL)));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDistPath));
}

app.use(
  "/binaries/desktop/win",
  express.static(path.resolve(env.DESKTOP_RELEASE_DIR), {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("latest.yml")) {
        res.setHeader("Cache-Control", "no-store");
        return;
      }

      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  })
);

app.use("/binaries/desktop/win", (_req, res) => {
  res.status(404).json({ error: "Binary not found" });
});

app.use("/api/v1", apiRoutes);
app.use("/api/mike/auth", mikeAuthRoutes);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

if (process.env.NODE_ENV === "production") {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

await normalizeAllProjectSections(prisma);
const repairedAttachmentNames = await repairStoredAttachmentFilenames(prisma);
if (repairedAttachmentNames > 0) {
  console.log(`${repairedAttachmentNames} nome(s) de anexo legado(s) reparado(s)`);
}

server.listen(env.PORT, "0.0.0.0", () => {
  console.log(`MK Projetos server running on port ${env.PORT}`);
  startWeeklyReportJob();
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
