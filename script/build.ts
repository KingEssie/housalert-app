import "dotenv/config"; // loads .env from project root before anything else
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

// All VITE_ env vars used by the frontend — collected from client/src.
// These are injected explicitly via Vite's `define` so the values are
// hard-coded into the bundle at build time, regardless of how the vars
// ended up in process.env (Replit secrets, dotenv .env file, shell exports).
const VITE_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_MAPBOX_TOKEN",
  "VITE_USE_MAPBOX_MAPS",
  "VITE_USE_MAPBOX_GEOCODER",
  "VITE_APP_URL",
  "VITE_VAPID_PUBLIC_KEY",
] as const;

async function buildAll() {
  // Build-time env check — logs presence only, never values
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  console.log("[build] VITE_SUPABASE_URL   :", supabaseUrl   ? "✓ set" : "✗ MISSING — app will fail to connect to Supabase");
  console.log("[build] VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✓ set" : "✗ MISSING — app will fail to connect to Supabase");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "\n[build] WARNING: One or more VITE_ env vars are missing.\n" +
      "  → For local Android builds: ensure .env exists in the project root\n" +
      "    with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running this build.\n" +
      "  → See .env.example for the required variable names.\n"
    );
  }

  // Build an explicit `define` map that hard-codes every VITE_ var into the
  // Vite bundle. This is belt-and-suspenders alongside vite.config.ts envDir —
  // it guarantees injection even if Vite's .env file resolution misses them.
  const defineEnv: Record<string, string> = {};
  for (const key of VITE_ENV_VARS) {
    const value = process.env[key];
    if (value !== undefined) {
      // Vite exposes these under import.meta.env, so we define both paths.
      defineEnv[`import.meta.env.${key}`] = JSON.stringify(value);
    }
  }
  console.log("[build] Injecting into bundle:", Object.keys(defineEnv).join(", ") || "(none)");

  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild({ define: defineEnv });

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
