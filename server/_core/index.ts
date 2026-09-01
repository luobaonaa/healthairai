import "dotenv/config";
import { createServer } from "http";
import app from "./app.js";
import { serveStatic, setupVite } from "./vite.js";
import { startAirQualityPushScheduler } from "../pushAlerts.js";

async function startServer() {
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  server.once("error", (error) => {
    console.error(`[Server] Failed to listen on port ${preferredPort}. Stop the process using that port or set PORT explicitly.`, error);
    process.exitCode = 1;
  });
  server.listen(preferredPort, () => {
    console.log(`Server running on http://localhost:${preferredPort}/`);
    startAirQualityPushScheduler();
  });
}

startServer().catch(console.error);
