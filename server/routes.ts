import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendMatchAlert } from "./email";
import { ingestWgGesucht } from "./ingest-wg-gesucht";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/match-alert", async (req, res) => {
    const { userEmail, listing } = req.body;

    if (!userEmail || !listing || !listing.title || !listing.city) {
      return res.status(400).json({ error: "Missing userEmail or listing data" });
    }

    const sent = await sendMatchAlert(userEmail, listing);
    return res.json({ sent });
  });

  app.post("/api/ingest/wg-gesucht", async (req, res) => {
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const result = await ingestWgGesucht();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
