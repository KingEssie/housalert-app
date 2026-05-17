import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Gzip compress all responses. Reduces /api/matches from ~50-100KB to ~15-30KB
// over the wire, cutting network time on slow mobile connections.
app.use(compression());

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const CAPACITOR_ORIGINS = [
  "capacitor://localhost",
  "https://localhost",
  "http://localhost",
  "ionic://localhost",
  "https://app.housalert.com",
  "https://www.housalert.com",
  "https://housalert.com",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CAPACITOR_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
  }
  next();
});

app.use((req, res, next) => {
  const isEmbedRoute =
    req.path === "/onboarding-embed" ||
    req.path.startsWith("/api/onboarding-drafts") ||
    req.path.startsWith("/onboarding/");

  if (isEmbedRoute) {
    res.removeHeader("X-Frame-Options");
    res.setHeader(
      "Content-Security-Policy",
      "frame-ancestors 'self' https://*.housalert.com https://housalert.com https://*.housalert.de https://housalert.de https://*.duda.co https://*.dudaone.com"
    );
  } else {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  }
  next();
});

import { log } from "./log";
export { log };

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Replit (and Vite dev) inject X-Robots-Tag: noindex on every response.
// Strip it here so Lighthouse and crawlers see the correct indexing policy.
app.use((_req, res, next) => {
  res.removeHeader("X-Robots-Tag");
  next();
});

app.get("/robots.txt", (_req, res) => {
  res.type("text/plain");
  res.send("User-agent: *\nAllow: /\n");
});

console.log("BOOT: server init");

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  app.get("/healthz", (_req, res) => {
    console.log("BOOT: health endpoint ready");
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      console.log(`BOOT: server listening on 0.0.0.0:${port}`);
      log(`serving on port ${port}`);

      const BACKGROUND_DELAY_MS = 10_000;
      setTimeout(async () => {
        console.log("BOOT: background jobs starting");

        try {
          const { clearBuffer, getBufferSize, cleanupStaleBuddyData } = await import("./notifications/buffer");
          const bufSize = getBufferSize();
          if (bufSize.listings > 0) {
            console.log(`[SYSTEM] Clearing in-memory buffer: ${bufSize.listings} pending listings for ${bufSize.users} users — PURGED`);
            clearBuffer();
          } else {
            console.log("[SYSTEM] In-memory buffer empty — no stale sends pending");
          }
          await cleanupStaleBuddyData();
        } catch (e: any) {
          console.error("[SYSTEM] Buffer/buddy cleanup error:", e.message);
        }

        import("./migrations/apply").then(({ runStartupMigration }) =>
          runStartupMigration().catch((e) => console.error("Migration error:", e))
        );
        import("./scheduler").then(({ startScheduler }) => {
          startScheduler();
          console.log("BOOT: scheduler started");
        });
      }, BACKGROUND_DELAY_MS);
    },
  );
})();
