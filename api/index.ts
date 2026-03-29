console.log("[API] api/index.ts is running");

import { createApp } from "../server/app.js";
import { registerRoutes } from "../server/routes.js";
import { runStartupMigrations } from "../server/db.js";
import type { Request, Response } from "express";

const app = createApp();

// Ensure migrations and routes are fully initialized before handling any request.
// Order: migrations first (schema must exist) → routes (use the schema).
let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = runStartupMigrations()
      .then(() => registerRoutes(app))
      .then(() => {
        // Error handler must be added after routes
        app.use((err: any, _req: Request, res: Response, _next: any) => {
          const status = err.status || err.statusCode || 500;
          const message = err.message || "Internal Server Error";
          console.error("Request error:", err);
          res.status(status).json({ message });
        });
      })
      .catch(err => {
        console.error("Failed to initialize:", err);
        initPromise = null; // allow retry on next request
      });
  }
  return initPromise!;
}

export default async function handler(req: Request, res: Response) {
  await ensureInitialized();
  app(req, res);
}
