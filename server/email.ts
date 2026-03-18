import { Resend } from "resend";
import { log } from "./log";
import { t, type ServerLocale } from "./i18n";

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

function emailWrapper(content: string, preheader?: string, lang: ServerLocale = "de"): string {
  const baseUrl = getAppBaseUrl();
  const logoUrl = getLogoUrl();
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${C.white};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="${lang}">
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
        <td style="vertical-align:middle;padding-right:8px;">
          <a href="${baseUrl}" target="_blank" style="text-decoration:none;">
            <img src="${logoUrl}" alt="HousAlert" width="36" height="36" style="display:block;width:36px;height:36px;border-radius:8px;border:0;outline:none;" />
          </a>
        </td>
        <td style="vertical-align:middle;">
          <a href="${baseUrl}" target="_blank" style="text-decoration:none;font-size:17px;font-weight:700;color:${C.navy};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">HousAlert</a>
        </td>
      </tr>
      </table>
    </td>
    <td align="right" style="vertical-align:middle;">
      <a href="${baseUrl}/instellingen" target="_blank" style="font-size:13px;color:${C.muted};text-decoration:none;">${escapeHtml(t(lang, "email.settings"))}</a>
    </td>
  </tr>
  </table>
</td></tr>

<!-- TAGLINE -->
<tr><td style="padding:4px 20px 16px;">
  <p style="margin:0;font-size:12px;color:${C.lightMuted};letter-spacing:0.01em;">${escapeHtml(t(lang, "email.tagline"))}</p>
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
    ${escapeHtml(t(lang, "email.footer"))}
  </p>
  <a href="${baseUrl}/instellingen" target="_blank" style="font-size:12px;color:${C.blue};text-decoration:none;">${escapeHtml(t(lang, "email.manageNotifs"))}</a>
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

function upgradeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("immowelt") && parsed.searchParams.has("h")) {
      parsed.searchParams.set("h", "400");
      return parsed.toString();
    }
  } catch {}
  return url;
}

function listingCard(listing: ListingInfo, showButton = false, cardNumber?: number, lang: ServerLocale = "de"): string {
  const safeUrl = sanitizeUrl(listing.url);
  const baseUrl = getAppBaseUrl();
  const applyUrl = listing.listing_id ? `${baseUrl}/apply/${listing.listing_id}` : null;
  const rawImageUrl = sanitizeUrl(listing.image_url);
  const safeImageUrl = rawImageUrl ? upgradeImageUrl(rawImageUrl) : null;
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
    ? `<p style="margin:0 0 6px;font-size:20px;font-weight:800;color:${C.navy};line-height:1.2;">${formatPrice(listing.price)}<span style="font-size:12px;font-weight:500;color:${C.muted};margin-left:2px;">${escapeHtml(t(lang, "email.perMonth"))}</span></p>`
    : "";

  const metaParts: string[] = [];
  if (listing.city) metaParts.push(escapeHtml(listing.city));
  if (listing.bedrooms > 0) metaParts.push(`${listing.bedrooms} ${t(lang, listing.bedrooms > 1 ? "email.rooms_plural" : "email.room")}`);
  if (listing.size_m2 > 0) metaParts.push(`${listing.size_m2} m\u00B2`);

  const metaHtml = metaParts.length > 0
    ? `<p style="margin:0 0 6px;font-size:13px;color:${C.dark};line-height:1.5;">${metaParts.join(`<span style="color:${C.border};"> &middot; </span>`)}</p>`
    : "";

  const buttonHtml = showButton && linkTarget !== "#"
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
        <tr><td>
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(linkTarget)}" style="height:44px;v-text-anchor:middle;width:100%;" arcsize="50%" strokecolor="${C.blue}" fillcolor="${C.blue}"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${escapeHtml(t(lang, "email.viewListing"))}</center></v:roundrect><![endif]-->
          <!--[if !mso]><!-->
          <a href="${escapeHtml(linkTarget)}" target="_blank" style="display:block;background-color:${C.blue};color:${C.white} !important;-webkit-text-fill-color:${C.white};mso-line-height-rule:exactly;font-size:14px;font-weight:700;text-decoration:none;padding:0;height:44px;line-height:44px;border-radius:999px;text-align:center;mso-hide:all;"><span style="color:${C.white} !important;-webkit-text-fill-color:${C.white};">${escapeHtml(t(lang, "email.viewListing"))}</span></a>
          <!--<![endif]-->
        </td></tr>
      </table>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.white};border-radius:16px;overflow:hidden;margin:0 0 16px;border:1px solid ${C.border};">
${imageHtml}
<tr><td style="padding:16px;">
  ${cardNumber ? `<p style="margin:0 0 8px;font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(t(lang, "email.listingLabel"))} ${cardNumber}</p>` : ""}
  <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:${C.navy};line-height:1.3;">${escapeHtml(listing.title)}</h3>
  ${priceLine}
  ${metaHtml}
  ${buttonHtml}
</td></tr>
</table>`;
}

export async function sendMatchAlert(
  userEmail: string,
  listing: ListingInfo,
  lang: ServerLocale = "de"
): Promise<boolean> {
  try {
    const client = await getResendClient();

    const subject = sanitizeSubject(t(lang, "email.subject.single", { title: listing.title }));
    const pricePart = listing.price > 0 ? `${formatPrice(listing.price)}${t(lang, "email.perMonth")} \u2014 ` : "";
    const preheader = `${listing.title} \u2014 ${pricePart}${listing.city}`;

    const detailsText = [
      `${t(lang, "email.city")}: ${listing.city}`,
      listing.price > 0 ? `${t(lang, "email.rent")}: ${formatPrice(listing.price)}${t(lang, "email.perMonth")}` : null,
      listing.bedrooms > 0 ? `${t(lang, "email.rooms")}: ${listing.bedrooms}` : null,
      listing.size_m2 > 0 ? `${t(lang, "email.area")}: ${listing.size_m2} m\u00B2` : null,
    ].filter(Boolean).join("\n");

    const textBody = `${t(lang, "email.greeting")},\n\n${t(lang, "email.singleIntro")}\n\n${listing.title}\n${detailsText}${listing.url ? `\n\n${t(lang, "email.viewListing")}: ${listing.url}` : ""}\n\n${t(lang, "email.closing")}`;

    const htmlContent = `
<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${C.blue};text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(t(lang, "email.newMatch"))}</p>
<p style="margin:0 0 16px;font-size:14px;color:${C.muted};line-height:1.5;">${escapeHtml(t(lang, "email.matchFound"))}</p>
${listingCard(listing, true, undefined, lang)}`;

    log(`[EMAIL SEND] from="${VERIFIED_FROM}" to="${userEmail}" subject="${subject}" lang=${lang} image=${listing.image_url ? listing.image_url.substring(0, 80) : "NO_IMAGE"}`);

    const { data, error } = await client.emails.send({
      from: VERIFIED_FROM,
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader, lang),
    });

    if (error) {
      log(`[EMAIL FAIL] to=${userEmail} listing="${listing.title}" lang=${lang} error=${error.message} name=${(error as any).name || "unknown"} statusCode=${(error as any).statusCode || "N/A"}`);
      return false;
    }

    log(`[EMAIL OK] to=${userEmail} listing="${listing.title}" lang=${lang} id=${(data as any)?.id || "N/A"}`);
    return true;
  } catch (err: any) {
    log(`[EMAIL ERROR] to=${userEmail} lang=${lang} err=${err.message} stack=${err.stack?.split("\n")[1]?.trim() || "N/A"}`);
    return false;
  }
}

export async function sendBatchMatchAlert(
  userEmail: string,
  listings: ListingInfo[],
  lang: ServerLocale = "de"
): Promise<boolean> {
  if (listings.length === 0) return false;

  if (listings.length === 1) {
    return sendMatchAlert(userEmail, listings[0], lang);
  }

  try {
    const client = await getResendClient();

    const subject = sanitizeSubject(t(lang, "email.subject.batch", { count: listings.length }));
    const preheader = t(lang, "email.preheader.batch", { count: listings.length });

    const textListings = listings.map((l, i) => {
      const safeUrl = sanitizeUrl(l.url);
      const priceStr = l.price > 0 ? `${formatPrice(l.price)}${t(lang, "email.perMonth")} \u2014 ` : "";
      return `${i + 1}. ${l.title}\n   ${priceStr}${l.city}${safeUrl ? `\n   ${safeUrl}` : ""}`;
    }).join("\n\n");

    const textBody = `${t(lang, "email.greeting")},\n\n${t(lang, "email.batchIntro", { count: listings.length })}\n\n${textListings}\n\n${t(lang, "email.closing")}`;

    const htmlListings = listings.map((l, i) => listingCard(l, true, i + 1, lang)).join("");

    const matchesLabel = t(lang, "email.newMatches", { count: listings.length });
    const matchesDesc = t(lang, "email.matchesFound", {
      count: listings.length,
      verb: lang === "nl" ? (listings.length === 1 ? "is" : "zijn") : (lang === "de" ? (listings.length === 1 ? "wurde" : "wurden") : (listings.length === 1 ? "was" : "were")),
      noun: lang === "en" ? (listings.length === 1 ? "listing" : "listings") : (lang === "nl" ? (listings.length === 1 ? "woning" : "woningen") : (listings.length === 1 ? "Wohnung" : "Wohnungen")),
      verbPast: lang === "nl" ? (listings.length === 1 ? "past" : "passen") : "",
    });

    const htmlContent = `
<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${C.blue};text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(matchesLabel)}</p>
<p style="margin:0 0 16px;font-size:14px;color:${C.muted};line-height:1.5;">${escapeHtml(matchesDesc)}</p>
${htmlListings}`;

    const imageStats = listings.map((l, i) => `${i + 1}:${l.image_url ? l.image_url.substring(0, 80) : "NO_IMAGE"}`).join(" | ");
    log(`[EMAIL SEND] batch from="${VERIFIED_FROM}" to="${userEmail}" count=${listings.length} lang=${lang} subject="${subject}"`);
    log(`[EMAIL IMAGES] ${imageStats}`);

    const { data, error } = await client.emails.send({
      from: VERIFIED_FROM,
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader, lang),
    });

    if (error) {
      log(`[EMAIL FAIL] batch to=${userEmail} count=${listings.length} lang=${lang} error=${error.message} name=${(error as any).name || "unknown"} statusCode=${(error as any).statusCode || "N/A"}`);
      return false;
    }

    log(`[EMAIL OK] batch to=${userEmail} count=${listings.length} lang=${lang} id=${(data as any)?.id || "N/A"}`);
    return true;
  } catch (err: any) {
    log(`[EMAIL ERROR] batch to=${userEmail} lang=${lang} err=${err.message} stack=${err.stack?.split("\n")[1]?.trim() || "N/A"}`);
    return false;
  }
}
