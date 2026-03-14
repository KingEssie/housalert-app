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
  primaryDark: "#0B5ED7",
  dark: "#111827",
  text: "#374151",
  muted: "#6B7280",
  light: "#9CA3AF",
  bg: "#F3F4F6",
  cardBg: "#FFFFFF",
  divider: "#E5E7EB",
  accent: "#EFF6FF",
  success: "#10B981",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeSubject(str: string): string {
  return str.replace(/[\r\n\t\x00-\x1f]/g, " ").trim().substring(0, 200);
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
  const baseUrl = getAppBaseUrl();
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${BRAND.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>HousAlert</title>
<!--[if mso]><style>table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bg};">
<tr><td align="center" style="padding:24px 16px 32px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<tr><td style="padding:0 0 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background-color:${BRAND.primary};width:36px;height:36px;border-radius:10px;text-align:center;vertical-align:middle;">
          <span style="font-size:18px;font-weight:800;color:#FFFFFF;line-height:36px;">H</span>
        </td>
        <td style="padding-left:12px;">
          <span style="font-size:20px;font-weight:800;color:${BRAND.dark};letter-spacing:-0.02em;">HousAlert</span>
          <br><span style="font-size:11px;color:${BRAND.muted};letter-spacing:0.02em;">Huurkansen, direct in je inbox</span>
        </td>
      </tr>
      </table>
    </td>
    <td align="right" style="vertical-align:middle;">
      <a href="${baseUrl}/instellingen" target="_blank" style="font-size:13px;color:${BRAND.muted};text-decoration:none;">Instellingen</a>
    </td>
  </tr>
  </table>
</td></tr>

<tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.cardBg};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.06);">
  <tr><td style="padding:32px 28px 28px;">
    ${content}
  </td></tr>
  </table>
</td></tr>

<tr><td style="padding:28px 4px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center">
    <p style="margin:0 0 6px;font-size:12px;color:${BRAND.light};line-height:1.6;">
      Je ontvangt deze e-mail omdat je een zoekprofiel hebt ingesteld bij HousAlert.<br>
      <a href="${baseUrl}/instellingen" target="_blank" style="color:${BRAND.muted};text-decoration:underline;">Meldingen aanpassen</a>
    </p>
    <p style="margin:0;font-size:11px;color:${BRAND.light};">
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

function detailChip(icon: string, label: string): string {
  return `<td style="padding:0 12px 0 0;white-space:nowrap;">
    <span style="font-size:13px;color:${BRAND.muted};line-height:1;">${icon}&nbsp;${escapeHtml(label)}</span>
  </td>`;
}

function listingCard(listing: ListingInfo, showButtons = false, cardNumber?: number): string {
  const safeUrl = sanitizeUrl(listing.url);
  const baseUrl = getAppBaseUrl();
  const applyUrl = listing.listing_id ? `${baseUrl}/apply/${listing.listing_id}` : null;
  const safeImageUrl = sanitizeUrl(listing.image_url);

  const imageHtml = safeImageUrl
    ? `<tr><td style="padding:0;">
        <a href="${escapeHtml(safeUrl || applyUrl || '#')}" target="_blank" style="text-decoration:none;">
          <img src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(listing.title)}" width="100%" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;border-radius:12px 12px 0 0;" />
        </a>
      </td></tr>`
    : "";

  const chips: string[] = [];
  if (listing.bedrooms > 0) chips.push(detailChip("\u{1F6CF}\uFE0F", `${listing.bedrooms} kamer${listing.bedrooms > 1 ? "s" : ""}`));
  if (listing.size_m2 > 0) chips.push(detailChip("\u{1F4D0}", `${listing.size_m2} m\u00B2`));
  if (listing.city) chips.push(detailChip("\u{1F4CD}", listing.city));

  const chipsHtml = chips.length > 0
    ? `<tr><td style="padding:8px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${chips.join("")}</tr></table>
      </td></tr>`
    : "";

  const priceHtml = listing.price > 0
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><span style="font-size:22px;font-weight:800;color:${BRAND.dark};line-height:1;">${formatPrice(listing.price)}</span></td>
        <td style="padding-left:4px;"><span style="font-size:13px;font-weight:400;color:${BRAND.muted};line-height:1;">/mnd</span></td>
      </tr></table>`
    : "";

  const applyButtonHtml = showButtons && applyUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
        <tr><td align="center">
          <a href="${escapeHtml(applyUrl)}" target="_blank" style="display:block;background-color:${BRAND.primary};color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 24px;border-radius:999px;text-align:center;mso-padding-alt:14px 24px;">Reageer direct \u2192</a>
        </td></tr>
      </table>`
    : "";

  const viewButtonHtml = showButtons && safeUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <a href="${escapeHtml(safeUrl)}" target="_blank" style="display:block;border:1.5px solid ${BRAND.divider};background-color:${BRAND.cardBg};color:${BRAND.dark};font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:999px;text-align:center;">Bekijk woning</a>
        </td></tr>
      </table>`
    : "";

  const buttonsHtml = (applyButtonHtml || viewButtonHtml)
    ? `<tr><td style="padding:16px 0 0;">
        ${applyButtonHtml}${viewButtonHtml}
      </td></tr>`
    : "";

  const cardPadding = safeImageUrl ? "16px 20px 20px" : "20px";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bg};border-radius:12px;overflow:hidden;margin:12px 0;border:1px solid ${BRAND.divider};">
${imageHtml}
<tr><td style="padding:${cardPadding};">
  ${cardNumber ? `<span style="display:inline-block;font-size:11px;font-weight:700;color:${BRAND.primary};background-color:${BRAND.accent};border-radius:4px;padding:2px 8px;margin-bottom:6px;">Woning ${cardNumber}</span><br>` : ""}
  <h3 style="margin:0 0 6px;font-size:16px;font-weight:700;color:${BRAND.dark};line-height:1.35;">${escapeHtml(listing.title)}</h3>
  ${priceHtml}
  ${chipsHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${chipsHtml}</table>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${buttonsHtml}</table>
</td></tr>
</table>`;
}

export async function sendMatchAlert(
  userEmail: string,
  listing: ListingInfo
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const subject = sanitizeSubject(`\u{1F3E0} Nieuwe match: ${listing.title}`);
    const preheader = `${listing.title} \u2014 ${formatPrice(listing.price)}/mnd in ${listing.city}`;

    const detailsText = [
      `Stad: ${listing.city}`,
      listing.price > 0 ? `Huur: ${formatPrice(listing.price)}/mnd` : null,
      listing.bedrooms > 0 ? `Kamers: ${listing.bedrooms}` : null,
      listing.size_m2 > 0 ? `Oppervlakte: ${listing.size_m2} m\u00B2` : null,
    ].filter(Boolean).join("\n");

    const textBody = `Hallo,\n\nWe hebben een nieuwe woning gevonden die bij jouw zoekprofiel past:\n\n${listing.title}\n${detailsText}${listing.url ? `\n\nBekijk woning: ${listing.url}` : ""}\n\nMet vriendelijke groet,\nHet HousAlert-team`;

    const htmlContent = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td>
  <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${BRAND.primary};text-transform:uppercase;letter-spacing:0.05em;">Nieuwe match</p>
  <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.dark};line-height:1.25;">Er is een woning gevonden!</h1>
  <p style="margin:0 0 20px;font-size:15px;color:${BRAND.text};line-height:1.55;">We hebben een nieuwe woning gevonden die bij jouw zoekprofiel past. Bekijk de details en reageer snel.</p>
</td></tr>
</table>
${listingCard(listing, true)}`;

    const { error } = await client.emails.send({
      from: fromEmail || "HousAlert <onboarding@resend.dev>",
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader),
    });

    if (error) {
      log(`[EMAIL FAIL] to=${userEmail} listing="${listing.title}" error=${error.message} name=${(error as any).name || "unknown"} statusCode=${(error as any).statusCode || "N/A"}`);
      return false;
    }

    log(`[EMAIL OK] to=${userEmail} listing="${listing.title}"`);
    return true;
  } catch (err: any) {
    log(`[EMAIL ERROR] to=${userEmail} err=${err.message} stack=${err.stack?.split("\n")[1]?.trim() || "N/A"}`);
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

    const subject = sanitizeSubject(`\u{1F3E0} ${listings.length} nieuwe woningen gevonden`);
    const preheader = `${listings.length} nieuwe matches voor jouw zoekprofiel \u2014 bekijk ze nu.`;

    const textListings = listings.map((l, i) => {
      const safeUrl = sanitizeUrl(l.url);
      const priceStr = l.price > 0 ? `${formatPrice(l.price)}/mnd \u2014 ` : "";
      return `${i + 1}. ${l.title}\n   ${priceStr}${l.city}${safeUrl ? `\n   ${safeUrl}` : ""}`;
    }).join("\n\n");

    const textBody = `Hallo,\n\nWe hebben ${listings.length} nieuwe woningen gevonden die bij jouw zoekprofiel passen:\n\n${textListings}\n\nMet vriendelijke groet,\nHet HousAlert-team`;

    const htmlListings = listings.map((l, i) => listingCard(l, true, i + 1)).join("");

    const htmlContent = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
  <tr>
    <td style="background-color:${BRAND.accent};border-radius:999px;padding:5px 14px;">
      <span style="font-size:13px;font-weight:700;color:${BRAND.primary};">${listings.length} nieuwe matches</span>
    </td>
  </tr>
  </table>
  <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.dark};line-height:1.25;">We hebben nieuwe woningen voor je!</h1>
  <p style="margin:0 0 20px;font-size:15px;color:${BRAND.text};line-height:1.55;">Er ${listings.length === 1 ? "is" : "zijn"} ${listings.length} ${listings.length === 1 ? "woning" : "woningen"} gevonden die ${listings.length === 1 ? "past" : "passen"} bij jouw zoekprofiel. Reageer snel voor de beste kans.</p>
</td></tr>
</table>
${htmlListings}`;

    const { error } = await client.emails.send({
      from: fromEmail || "HousAlert <onboarding@resend.dev>",
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader),
    });

    if (error) {
      log(`[EMAIL FAIL] batch to=${userEmail} count=${listings.length} error=${error.message} name=${(error as any).name || "unknown"} statusCode=${(error as any).statusCode || "N/A"}`);
      return false;
    }

    log(`[EMAIL OK] batch to=${userEmail} count=${listings.length}`);
    return true;
  } catch (err: any) {
    log(`[EMAIL ERROR] batch to=${userEmail} err=${err.message} stack=${err.stack?.split("\n")[1]?.trim() || "N/A"}`);
    return false;
  }
}
