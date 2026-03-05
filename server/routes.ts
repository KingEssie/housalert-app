import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendMatchAlert } from "./email";

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

  return httpServer;
}
