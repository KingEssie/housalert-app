import { Resend } from "resend";
import { log } from "./log";

interface ListingInfo {
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  url?: string | null;
}

const BRAND = {
  name: "HousAlert",
  color: "#2DD4BF",
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
  return price > 0 ? `\u20AC${price.toLocaleString("de-DE")}/Monat` : "";
}

function buildDetailPills(listing: ListingInfo): string {
  const pills: string[] = [];
  if (listing.price > 0) pills.push(formatPrice(listing.price));
  if (listing.bedrooms > 0) pills.push(`${listing.bedrooms} ${listing.bedrooms === 1 ? "Zimmer" : "Zimmer"}`);
  if (listing.size_m2 > 0) pills.push(`${listing.size_m2} m\u00B2`);
  return pills.join(" \u00A0\u2022\u00A0 ");
}

function buildDetailRows(listing: ListingInfo): string {
  const rows: string[] = [];
  const td1 = `style="color:${BRAND.muted};padding:4px 12px 4px 0;font-size:14px;white-space:nowrap;"`;
  const td2 = `style="color:${BRAND.dark};padding:4px 0;font-size:14px;font-weight:600;"`;
  if (listing.city) rows.push(`<tr><td ${td1}>Stadt</td><td ${td2}>${escapeHtml(listing.city)}</td></tr>`);
  if (listing.price > 0) rows.push(`<tr><td ${td1}>Miete</td><td ${td2}>${formatPrice(listing.price)}</td></tr>`);
  if (listing.bedrooms > 0) rows.push(`<tr><td ${td1}>Zimmer</td><td ${td2}>${listing.bedrooms}</td></tr>`);
  if (listing.size_m2 > 0) rows.push(`<tr><td ${td1}>Fl\u00E4che</td><td ${td2}>${listing.size_m2} m\u00B2</td></tr>`);
  return rows.join("");
}

function emailWrapper(content: string, preheader?: string): string {
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${BRAND.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="de">
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
      Du erh\u00E4ltst diese E-Mail, weil du ein Suchprofil bei HousAlert eingerichtet hast. Du kannst deine Benachrichtigungen jederzeit in deinen Kontoeinstellungen anpassen.
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

function ctaButton(url: string, label: string): string {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
<tr><td align="center">
  <a href="${escapeHtml(safeUrl)}" target="_blank" style="display:inline-block;background-color:${BRAND.color};color:${BRAND.dark};font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;text-align:center;">${escapeHtml(label)}</a>
</td></tr>
</table>`;
}

function listingCard(listing: ListingInfo, showCtaButton = false): string {
  const detailRows = buildDetailRows(listing);
  const safeUrl = sanitizeUrl(listing.url);
  const linkHtml = safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:600;color:${BRAND.color};text-decoration:none;">Inserat ansehen &rarr;</a>`
    : "";
  const ctaHtml = showCtaButton && safeUrl ? ctaButton(safeUrl, "Wohnung ansehen") : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};border-radius:8px;overflow:hidden;margin:16px 0;">
<tr><td style="padding:16px 20px;">
  <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:${BRAND.dark};line-height:1.3;">${escapeHtml(listing.title)}</h3>
  <table role="presentation" cellpadding="0" cellspacing="0">${detailRows}</table>
  ${linkHtml}
  ${ctaHtml}
</td></tr>
</table>`;
}

export async function sendMatchAlert(
  userEmail: string,
  listing: ListingInfo
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const subject = `Neue Wohnung gefunden in ${listing.city}`;
    const preheader = `${listing.title} \u2014 ${listing.city}`;
    const safeUrl = sanitizeUrl(listing.url);

    const detailsText = [
      `Stadt: ${listing.city}`,
      listing.price > 0 ? `Miete: ${formatPrice(listing.price)}` : null,
      listing.bedrooms > 0 ? `Zimmer: ${listing.bedrooms}` : null,
      listing.size_m2 > 0 ? `Fl\u00E4che: ${listing.size_m2} m\u00B2` : null,
    ].filter(Boolean).join("\n");

    const textBody = `Hallo,\n\nWir haben eine neue Wohnung gefunden, die zu deinem Suchprofil passt:\n\n${listing.title}\n${detailsText}${safeUrl ? `\n\nInserat ansehen: ${safeUrl}` : ""}\n\nViele Gr\u00FC\u00DFe,\nDein HousAlert-Team`;

    const htmlContent = `
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${BRAND.dark};">Neue passende Wohnung gefunden</h2>
<p style="margin:0 0 4px;font-size:15px;color:${BRAND.text};line-height:1.5;">Wir haben eine neue Wohnung gefunden, die zu deinem Suchprofil passt.</p>
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

    const firstCity = listings[0]?.city;
    const allSameCity = listings.every(l => l.city === firstCity);
    const subject = allSameCity
      ? `${listings.length} neue Wohnungen gefunden in ${firstCity}`
      : `${listings.length} neue Wohnungen f\u00FCr deine Suche`;
    const preheader = allSameCity
      ? `${listings.length} neue Wohnungen in ${firstCity} passen zu deinem Suchprofil.`
      : `${listings.length} neue Wohnungen passen zu deinem Suchprofil.`;

    const textListings = listings.map((l, i) => {
      const pills = buildDetailPills(l);
      const safeUrl = sanitizeUrl(l.url);
      return `${i + 1}. ${l.title}\n   ${pills} \u2014 ${l.city}${safeUrl ? `\n   ${safeUrl}` : ""}`;
    }).join("\n\n");

    const textBody = `Hallo,\n\nWir haben ${listings.length} neue Wohnungen gefunden, die zu deinem Suchprofil passen:\n\n${textListings}\n\nViele Gr\u00FC\u00DFe,\nDein HousAlert-Team`;

    const htmlListings = listings.map(l => listingCard(l, true)).join("");

    const htmlContent = `
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${BRAND.dark};">${listings.length} neue passende Wohnungen</h2>
<p style="margin:0 0 4px;font-size:15px;color:${BRAND.text};line-height:1.5;">Wir haben ${listings.length} neue Wohnungen gefunden, die zu deinem Suchprofil passen.</p>
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
