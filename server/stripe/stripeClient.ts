import Stripe from 'stripe';

let cachedCredentials: { publishableKey: string; secretKey: string } | null = null;

async function fetchConnectorForEnv(
  hostname: string,
  xReplitToken: string,
  env: string
): Promise<{ publishableKey: string; secretKey: string } | null> {
  try {
    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set('include_secrets', 'true');
    url.searchParams.set('connector_names', 'stripe');
    url.searchParams.set('environment', env);

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const cs = data.items?.[0];
    if (!cs || !cs.settings?.secret) return null;
    return { publishableKey: cs.settings.publishable || '', secretKey: cs.settings.secret };
  } catch {
    return null;
  }
}

async function getConnectorCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector environment not available');
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const primaryEnv = isProduction ? 'production' : 'development';
  const fallbackEnv = isProduction ? 'development' : 'production';

  const creds = await fetchConnectorForEnv(hostname, xReplitToken, primaryEnv);
  if (creds) return creds;

  const fallback = await fetchConnectorForEnv(hostname, xReplitToken, fallbackEnv);
  if (fallback) return fallback;

  throw new Error(`Stripe connection not found in ${primaryEnv} or ${fallbackEnv}`);
}

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  if (cachedCredentials) return cachedCredentials;

  try {
    cachedCredentials = await getConnectorCredentials();
    const keyPrefix = cachedCredentials.secretKey?.substring(0, 7) || "EMPTY";
    console.log(`[stripe-creds] Connector credentials loaded (key prefix: ${keyPrefix}...)`);
    return cachedCredentials;
  } catch (connErr: any) {
    console.log(`[stripe-creds] Connector failed: ${connErr.message} — falling back to env vars`);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!secretKey) {
    console.error("[stripe-creds] STRIPE_SECRET_KEY is NOT set and connector failed. Stripe unavailable.");
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY environment variable or connect Stripe via the Replit integration."
    );
  }

  const keyPrefix = secretKey.substring(0, 7);
  console.log(`[stripe-creds] Using STRIPE_SECRET_KEY env var (prefix: ${keyPrefix}...)`);

  cachedCredentials = {
    secretKey,
    publishableKey: publishableKey || "",
  };
  return cachedCredentials;
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as any,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}
