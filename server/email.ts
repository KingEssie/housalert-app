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

const VERIFIED_FROM = "HousAlert <new@housalert.com>";

const C = {
  white: "#FFFFFF",
  bg: "#F9FAFB",
  navy: "#111C3D",
  dark: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
  blue: "#0D6EFD",
  blueHover: "#0B5ED7",
  lightMuted: "#9CA3AF",
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
  };
}

async function getResendClient() {
  const { apiKey } = await getCredentials();
  return new Resend(apiKey);
}

function formatPrice(price: number): string {
  return price > 0 ? `\u20AC${price.toLocaleString("de-DE")}` : "";
}

function getAppBaseUrl(): string {
  const raw = process.env.APP_PUBLIC_BASE_URL || "https://app.housalert.com";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.origin;
    }
  } catch {}
  return "https://app.housalert.com";
}

function getLogoUrl(): string {
  return `${getAppBaseUrl()}/housalert-logo.png`;
}

function emailWrapper(content: string, preheader?: string): string {
  const baseUrl = getAppBaseUrl();
  const logoUrl = getLogoUrl();
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${C.white};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>HousAlert</title>
<!--[if mso]><style>table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.white};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.white};">
<tr><td align="center" style="padding:0;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<!-- HEADER -->
<tr><td style="padding:20px 20px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="vertical-align:middle;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align:middle;">
          <a href="${baseUrl}" target="_blank" style="text-decoration:none;">
            <img src="${logoUrl}" alt="HousAlert" width="160" height="40" style="display:block;width:160px;height:40px;border:0;outline:none;font-size:18px;font-weight:bold;color:${C.navy};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;" />
          </a>
        </td>
      </tr>
      </table>
    </td>
    <td align="right" style="vertical-align:middle;">
      <a href="${baseUrl}/instellingen" target="_blank" style="font-size:13px;color:${C.muted};text-decoration:none;">Instellingen</a>
    </td>
  </tr>
  </table>
</td></tr>

<!-- TAGLINE -->
<tr><td style="padding:4px 20px 16px;">
  <p style="margin:0;font-size:12px;color:${C.lightMuted};letter-spacing:0.01em;">Huuraanbod, direct in je inbox</p>
</td></tr>

<!-- DIVIDER -->
<tr><td style="padding:0 20px;"><div style="border-top:1px solid ${C.border};"></div></td></tr>

<!-- CONTENT -->
<tr><td style="padding:20px;">
  ${content}
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:0 20px;"><div style="border-top:1px solid ${C.border};"></div></td></tr>
<tr><td style="padding:16px 20px 24px;">
  <p style="margin:0 0 4px;font-size:12px;color:${C.lightMuted};line-height:1.6;">
    Je ontvangt deze e-mail omdat je een zoekprofiel hebt ingesteld bij HousAlert.
  </p>
  <a href="${baseUrl}/instellingen" target="_blank" style="font-size:12px;color:${C.blue};text-decoration:none;">Meldingen aanpassen</a>
  <p style="margin:12px 0 0;font-size:11px;color:${C.border};">
    \u00A9 ${new Date().getFullYear()} HousAlert
  </p>
</td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

function listingCard(listing: ListingInfo, showButton = false, cardNumber?: number): string {
  const safeUrl = sanitizeUrl(listing.url);
  const baseUrl = getAppBaseUrl();
  const applyUrl = listing.listing_id ? `${baseUrl}/apply/${listing.listing_id}` : null;
  const safeImageUrl = sanitizeUrl(listing.image_url);
  const linkTarget = safeUrl || applyUrl || "#";

  const imageHtml = safeImageUrl
    ? `<tr><td style="padding:0;line-height:0;font-size:0;position:relative;">
        <a href="${escapeHtml(linkTarget)}" target="_blank" style="text-decoration:none;">
          <img src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(listing.title)}" width="100%" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;" />
        </a>
      </td></tr>`
    : "";

  const priceOnImage = safeImageUrl && listing.price > 0
    ? ""
    : "";

  const priceLine = listing.price > 0
    ? `<p style="margin:0 0 6px;font-size:20px;font-weight:800;color:${C.navy};line-height:1.2;">${formatPrice(listing.price)}<span style="font-size:12px;font-weight:500;color:${C.muted};margin-left:2px;">/mnd</span></p>`
    : "";

  const metaParts: string[] = [];
  if (listing.city) metaParts.push(escapeHtml(listing.city));
  if (listing.bedrooms > 0) metaParts.push(`${listing.bedrooms} kamer${listing.bedrooms > 1 ? "s" : ""}`);
  if (listing.size_m2 > 0) metaParts.push(`${listing.size_m2} m\u00B2`);

  const metaHtml = metaParts.length > 0
    ? `<p style="margin:0 0 6px;font-size:13px;color:${C.dark};line-height:1.5;">${metaParts.join(`<span style="color:${C.border};"> &middot; </span>`)}</p>`
    : "";

  const buttonHtml = showButton && linkTarget !== "#"
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
        <tr><td>
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(linkTarget)}" style="height:44px;v-text-anchor:middle;width:100%;" arcsize="50%" strokecolor="${C.blue}" fillcolor="${C.blue}"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">Bekijk</center></v:roundrect><![endif]-->
          <!--[if !mso]><!-->
          <a href="${escapeHtml(linkTarget)}" target="_blank" style="display:block;background-color:${C.blue};color:${C.white} !important;-webkit-text-fill-color:${C.white};mso-line-height-rule:exactly;font-size:14px;font-weight:700;text-decoration:none;padding:0;height:44px;line-height:44px;border-radius:999px;text-align:center;mso-hide:all;"><span style="color:${C.white} !important;-webkit-text-fill-color:${C.white};">Bekijk</span></a>
          <!--<![endif]-->
        </td></tr>
      </table>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.white};border-radius:16px;overflow:hidden;margin:0 0 16px;border:1px solid ${C.border};">
${imageHtml}
<tr><td style="padding:16px;">
  ${cardNumber ? `<p style="margin:0 0 8px;font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.04em;">Woning ${cardNumber}</p>` : ""}
  <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:${C.navy};line-height:1.3;">${escapeHtml(listing.title)}</h3>
  ${priceLine}
  ${metaHtml}
  ${buttonHtml}
</td></tr>
</table>`;
}

export async function sendMatchAlert(
  userEmail: string,
  listing: ListingInfo
): Promise<boolean> {
  try {
    const client = await getResendClient();

    const subject = sanitizeSubject(`\u{1F3E0} Nieuwe match: ${listing.title}`);
    const pricePart = listing.price > 0 ? `${formatPrice(listing.price)}/mnd \u2014 ` : "";
    const preheader = `${listing.title} \u2014 ${pricePart}${listing.city}`;

    const detailsText = [
      `Stad: ${listing.city}`,
      listing.price > 0 ? `Huur: ${formatPrice(listing.price)}/mnd` : null,
      listing.bedrooms > 0 ? `Kamers: ${listing.bedrooms}` : null,
      listing.size_m2 > 0 ? `Oppervlakte: ${listing.size_m2} m\u00B2` : null,
    ].filter(Boolean).join("\n");

    const textBody = `Hallo,\n\nWe hebben een nieuwe woning gevonden die bij jouw zoekprofiel past:\n\n${listing.title}\n${detailsText}${listing.url ? `\n\nBekijk woning: ${listing.url}` : ""}\n\nMet vriendelijke groet,\nHet HousAlert-team`;

    const htmlContent = `
<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${C.blue};text-transform:uppercase;letter-spacing:0.05em;">Nieuwe match</p>
<p style="margin:0 0 16px;font-size:14px;color:${C.muted};line-height:1.5;">We hebben een woning gevonden die bij jouw zoekprofiel past.</p>
${listingCard(listing, true)}`;

    log(`[EMAIL SEND] from="${VERIFIED_FROM}" to="${userEmail}" subject="${subject}"`);

    const { data, error } = await client.emails.send({
      from: VERIFIED_FROM,
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader),
    });

    if (error) {
      log(`[EMAIL FAIL] to=${userEmail} listing="${listing.title}" error=${error.message} name=${(error as any).name || "unknown"} statusCode=${(error as any).statusCode || "N/A"}`);
      return false;
    }

    log(`[EMAIL OK] to=${userEmail} listing="${listing.title}" id=${(data as any)?.id || "N/A"}`);
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
    const client = await getResendClient();

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
<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${C.blue};text-transform:uppercase;letter-spacing:0.05em;">${listings.length} nieuwe matches</p>
<p style="margin:0 0 16px;font-size:14px;color:${C.muted};line-height:1.5;">Er ${listings.length === 1 ? "is" : "zijn"} ${listings.length} ${listings.length === 1 ? "woning" : "woningen"} gevonden die ${listings.length === 1 ? "past" : "passen"} bij jouw zoekprofiel.</p>
${htmlListings}`;

    log(`[EMAIL SEND] batch from="${VERIFIED_FROM}" to="${userEmail}" count=${listings.length} subject="${subject}"`);

    const { data, error } = await client.emails.send({
      from: VERIFIED_FROM,
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader),
    });

    if (error) {
      log(`[EMAIL FAIL] batch to=${userEmail} count=${listings.length} error=${error.message} name=${(error as any).name || "unknown"} statusCode=${(error as any).statusCode || "N/A"}`);
      return false;
    }

    log(`[EMAIL OK] batch to=${userEmail} count=${listings.length} id=${(data as any)?.id || "N/A"}`);
    return true;
  } catch (err: any) {
    log(`[EMAIL ERROR] batch to=${userEmail} err=${err.message} stack=${err.stack?.split("\n")[1]?.trim() || "N/A"}`);
    return false;
  }
}
