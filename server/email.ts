import { Resend } from "resend";
import { log } from "./log";

interface ListingInfo {
  listing_id?: string;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  url?: string | null;
  image_url?: string | null;
}

const BRAND = {
  name: "HousAlert",
  primary: "#0D6EFD",
  dark: "#1A1A1A",
  text: "#333333",
  muted: "#6B7280",
  bg: "#F8F9FA",
  cardBg: "#FFFFFF",
  divider: "#E5E7EB",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
    return null;
  } catch {
    return null;
  }
}

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data: any) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected");
  }
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email,
  };
}

async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

function formatPrice(price: number): string {
  return price > 0 ? `\u20AC${price.toLocaleString("de-DE")}` : "";
}

function getAppBaseUrl(): string {
  return process.env.APP_PUBLIC_BASE_URL || "https://housalert.replit.app";
}

function emailWrapper(content: string, preheader?: string): string {
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${BRAND.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${BRAND.cardBg};border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

<tr><td style="background-color:${BRAND.dark};padding:24px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td>
      <span style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:0.02em;">HousAlert</span>
    </td>
  </tr>
  </table>
</td></tr>

<tr><td style="padding:28px;">
${content}
</td></tr>

<tr><td style="padding:0 28px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="border-top:1px solid ${BRAND.divider};padding-top:20px;">
    <p style="margin:0;font-size:12px;color:${BRAND.muted};line-height:1.5;">
      Je ontvangt deze e-mail omdat je een zoekprofiel hebt ingesteld bij HousAlert. Je kunt je meldingen op elk moment aanpassen in je accountinstellingen.
    </p>
    <p style="margin:8px 0 0;font-size:12px;color:${BRAND.muted};">
      \u00A9 ${new Date().getFullYear()} HousAlert
    </p>
  </td></tr>
  </table>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function listingCard(listing: ListingInfo, showButtons = false): string {
  const safeUrl = sanitizeUrl(listing.url);
  const baseUrl = getAppBaseUrl();
  const applyUrl = listing.listing_id ? `${baseUrl}/apply/${listing.listing_id}` : null;
  const safeImageUrl = sanitizeUrl(listing.image_url);

  const imageHtml = safeImageUrl
    ? `<tr><td style="padding:0;">
        <img src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(listing.title)}" width="100%" style="display:block;width:100%;height:auto;max-height:200px;object-fit:cover;border-radius:8px 8px 0 0;" />
      </td></tr>`
    : "";

  const priceHtml = listing.price > 0
    ? `<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:${BRAND.dark};">${formatPrice(listing.price)} <span style="font-size:14px;font-weight:400;color:${BRAND.muted};">/mnd</span></p>`
    : "";

  const cityHtml = listing.city
    ? `<p style="margin:0 0 12px;font-size:14px;color:${BRAND.muted};">\u{1F4CD} ${escapeHtml(listing.city)}</p>`
    : "";

  const applyButtonHtml = showButtons && applyUrl
    ? `<a href="${escapeHtml(applyUrl)}" target="_blank" style="display:inline-block;background-color:${BRAND.primary};color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 18px;border-radius:999px;text-align:center;mso-padding-alt:14px 18px;">Reageer direct</a>`
    : "";

  const viewButtonHtml = showButtons && safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" style="display:inline-block;border:1px solid ${BRAND.divider};background-color:#FFFFFF;color:#111827;font-size:15px;font-weight:600;text-decoration:none;padding:14px 18px;border-radius:999px;text-align:center;margin-left:8px;">Bekijk woning</a>`
    : "";

  const buttonsHtml = (applyButtonHtml || viewButtonHtml)
    ? `<tr><td style="padding:16px 20px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td>${applyButtonHtml}</td><td>${viewButtonHtml}</td></tr></table>
      </td></tr>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};border-radius:8px;overflow:hidden;margin:16px 0;">
${imageHtml}
<tr><td style="padding:16px 20px 4px;">
  <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:${BRAND.dark};line-height:1.3;">${escapeHtml(listing.title)}</h3>
  ${priceHtml}
  ${cityHtml}
</td></tr>
${buttonsHtml}
<tr><td style="padding:0 0 16px;"></td></tr>
</table>`;
}

export async function sendMatchAlert(
  userEmail: string,
  listing: ListingInfo
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const subject = `Nieuwe match voor jouw zoekprofiel`;
    const preheader = `${listing.title} \u2014 ${listing.city}`;

    const detailsText = [
      `Stad: ${listing.city}`,
      listing.price > 0 ? `Huur: ${formatPrice(listing.price)}/mnd` : null,
      listing.bedrooms > 0 ? `Kamers: ${listing.bedrooms}` : null,
      listing.size_m2 > 0 ? `Oppervlakte: ${listing.size_m2} m\u00B2` : null,
    ].filter(Boolean).join("\n");

    const textBody = `Hallo,\n\nWe hebben een nieuwe woning gevonden die bij jouw zoekprofiel past:\n\n${listing.title}\n${detailsText}${listing.url ? `\n\nBekijk woning: ${listing.url}` : ""}\n\nMet vriendelijke groet,\nHet HousAlert-team`;

    const htmlContent = `
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${BRAND.dark};">Nieuwe match gevonden</h2>
<p style="margin:0 0 4px;font-size:15px;color:${BRAND.text};line-height:1.5;">We hebben een nieuwe woning gevonden die bij jouw zoekprofiel past.</p>
${listingCard(listing, true)}`;

    const { error } = await client.emails.send({
      from: fromEmail || "HousAlert <onboarding@resend.dev>",
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader),
    });

    if (error) {
      log(`Failed to send match alert to ${userEmail}: ${error.message}`);
      return false;
    }

    log(`Match alert sent to ${userEmail} for listing "${listing.title}"`);
    return true;
  } catch (err: any) {
    log(`Error sending match alert: ${err.message}`);
    return false;
  }
}

export async function sendBatchMatchAlert(
  userEmail: string,
  listings: ListingInfo[]
): Promise<boolean> {
  if (listings.length === 0) return false;

  if (listings.length === 1) {
    return sendMatchAlert(userEmail, listings[0]);
  }

  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const subject = `${listings.length} nieuwe woningen die bij jouw zoekprofiel passen`;
    const preheader = `${listings.length} nieuwe matches voor jouw zoekprofiel.`;

    const textListings = listings.map((l, i) => {
      const safeUrl = sanitizeUrl(l.url);
      return `${i + 1}. ${l.title}\n   ${formatPrice(l.price)}/mnd \u2014 ${l.city}${safeUrl ? `\n   ${safeUrl}` : ""}`;
    }).join("\n\n");

    const textBody = `Hallo,\n\nWe hebben ${listings.length} nieuwe woningen gevonden die bij jouw zoekprofiel passen:\n\n${textListings}\n\nMet vriendelijke groet,\nHet HousAlert-team`;

    const htmlListings = listings.map(l => listingCard(l, true)).join("");

    const htmlContent = `
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${BRAND.dark};">${listings.length} nieuwe matches</h2>
<p style="margin:0 0 4px;font-size:15px;color:${BRAND.text};line-height:1.5;">We hebben ${listings.length} nieuwe woningen gevonden die bij jouw zoekprofiel passen.</p>
${htmlListings}`;

    const { error } = await client.emails.send({
      from: fromEmail || "HousAlert <onboarding@resend.dev>",
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader),
    });

    if (error) {
      log(`Failed to send batch alert to ${userEmail}: ${error.message}`);
      return false;
    }

    log(`Batch alert sent to ${userEmail} with ${listings.length} listings`);
    return true;
  } catch (err: any) {
    log(`Error sending batch alert: ${err.message}`);
    return false;
  }
}
