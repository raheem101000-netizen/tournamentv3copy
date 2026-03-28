console.log("[API] api/index.ts is running");

import { createApp } from "../server/app.js";
import { registerRoutes } from "../server/routes.js";
import type { Request, Response } from "express";

const app = createApp();

// Ensure routes are registered before handling any request.
// registerRoutes is async — without awaiting it, Vercel can receive
// requests before routes exist (race condition = old cached code runs).
let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = registerRoutes(app).then(() => {
      // Error handler must be added after routes
      app.use((err: any, _req: Request, res: Response, _next: any) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        console.error("Request error:", err);
        res.status(status).json({ message });
      });
    }).catch(err => {
      console.error("Failed to register routes:", err);
      initPromise = null; // allow retry on next request
    });
  }
  return initPromise!;
}

export default async function handler(req: Request, res: Response) {
  await ensureInitialized();
  app(req, res);
}
