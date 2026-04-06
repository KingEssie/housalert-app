import { Resend } from "resend";
import { createHmac } from "crypto";
import { log } from "./log";
import { t, type ServerLocale } from "./i18n";

function getEmailConfig() {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("[EMAIL CONFIG] RESEND_API_KEY is not set — cannot send emails");
  }
  if (!fromEmail) {
    throw new Error("[EMAIL CONFIG] RESEND_FROM_EMAIL is not set — cannot send emails");
  }
  if (!replyTo) {
    throw new Error("[EMAIL CONFIG] RESEND_REPLY_TO is not set — cannot send emails");
  }

  return {
    from: `HousAlert <${fromEmail}>`,
    replyTo,
    apiKey,
  };
}

interface FinalSendParams {
  to: string;
  subject: string;
  text: string;
  html: string;
  category?: string;
}

async function finalEmailDispatch(client: Resend, params: FinalSendParams, category: string = "unknown"): Promise<{ data: any; error: any }> {
  const recipient = params.to.toLowerCase();
  const config = getEmailConfig();

  let testMode = false;
  try {
    const { EMAIL_TEST_MODE } = await import("./notifications/buffer");
    testMode = EMAIL_TEST_MODE;
  } catch {}

  if (testMode) {
    log(`[EMAIL TEST MODE] INTERCEPTED — would send to=${recipient} from="${config.from}" reply_to="${config.replyTo}" category=${category} subject="${params.subject.substring(0, 60)}" — NOT sending (test mode)`);
    return { data: { id: `test-mode-${Date.now()}` }, error: null };
  }

  log(`[FINAL SEND DISPATCH] recipient=${recipient} from="${config.from}" reply_to="${config.replyTo}" category=${category} subject="${params.subject.substring(0, 60)}" result=SEND`);

  return client.emails.send({
    from: config.from,
    reply_to: config.replyTo,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

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

const C = {
  white: "#FFFFFF",
  bg: "#FFFFFF",
  text: "#111827",
  textSecondary: "#6B7280",
  border: "#E5E7EB",
  primary: "#d91a68",
  primaryHover: "#b31556",
  lightBg: "#F9FAFB",
};

const FONT_STACK = "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

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

async function getResendClient() {
  const config = getEmailConfig();
  return new Resend(config.apiKey);
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

function pinIconSvg(): string {
  return `<img src="https://app.housalert.com/icon-192.png" alt="HousAlert" width="28" height="28" style="display:block;width:28px;height:28px;border-radius:6px;" />`;
}

function emailWrapper(content: string, preheader?: string, lang: ServerLocale = "nl", footerOverride?: string, buddyUnsubscribeUrl?: string): string {
  const baseUrl = getAppBaseUrl();
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${C.white};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>HousAlert</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<!--[if mso]><style>table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.white};font-family:${FONT_STACK};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.white};">
<tr><td align="center" style="padding:0;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<!-- HEADER -->
<tr><td style="padding:28px 24px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="vertical-align:middle;width:36px;">
      ${pinIconSvg()}
    </td>
    <td style="vertical-align:middle;padding-left:10px;">
      <a href="${baseUrl}" target="_blank" style="text-decoration:none;font-size:18px;font-weight:600;color:${C.text};font-family:${FONT_STACK};letter-spacing:-0.01em;">housalert</a>
    </td>
    <td align="right" style="vertical-align:middle;">
      <a href="${baseUrl}/instellingen" target="_blank" style="font-size:13px;color:${C.textSecondary};text-decoration:none;font-family:${FONT_STACK};">${escapeHtml(t(lang, "email.settings"))}</a>
    </td>
  </tr>
  </table>
</td></tr>

<!-- TAGLINE -->
<tr><td style="padding:4px 24px 20px 70px;">
  <p style="margin:0;font-size:12px;color:${C.textSecondary};letter-spacing:0.01em;font-family:${FONT_STACK};">${escapeHtml(t(lang, "email.tagline"))}</p>
</td></tr>

<!-- DIVIDER -->
<tr><td style="padding:0 24px;"><div style="border-top:1px solid ${C.border};"></div></td></tr>

<!-- CONTENT -->
<tr><td style="padding:28px 24px;">
  ${content}
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:0 24px;"><div style="border-top:1px solid ${C.border};"></div></td></tr>
<tr><td style="padding:20px 24px 32px;">
  <p style="margin:0 0 4px;font-size:12px;color:${C.textSecondary};line-height:1.6;font-family:${FONT_STACK};">
    ${escapeHtml(footerOverride || t(lang, "email.footer"))}
  </p>
  ${footerOverride ? "" : `<a href="${baseUrl}/instellingen" target="_blank" style="font-size:12px;color:${C.primary};text-decoration:none;font-family:${FONT_STACK};">${escapeHtml(t(lang, "email.manageNotifs"))}</a>`}
  ${buddyUnsubscribeUrl ? `<br><a href="${buddyUnsubscribeUrl}" target="_blank" style="font-size:11px;color:${C.textSecondary};text-decoration:underline;font-family:${FONT_STACK};">${lang === "de" ? "Suchbuddy-Benachrichtigungen abmelden" : lang === "nl" ? "Afmelden voor zoekbuddy-meldingen" : "Unsubscribe from Search Buddy alerts"}</a>` : ""}
  <p style="margin:16px 0 0;font-size:11px;color:${C.border};font-family:${FONT_STACK};">
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

function ctaButton(href: string, label: string, primary: boolean): string {
  const bg = primary ? C.primary : C.white;
  const fg = primary ? C.white : C.primary;
  const borderColor = C.primary;
  return `<tr><td align="center" style="padding:0 0 ${primary ? "10px" : "0"};">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(href)}" style="height:50px;v-text-anchor:middle;width:100%;" arcsize="24%" strokecolor="${borderColor}" fillcolor="${bg}"><w:anchorlock/><center style="color:${fg};font-family:Arial,sans-serif;font-size:15px;font-weight:600;">${escapeHtml(label)}</center></v:roundrect><![endif]-->
          <!--[if !mso]><!-->
          <a href="${escapeHtml(href)}" target="_blank" style="display:block;background-color:${bg};color:${fg} !important;-webkit-text-fill-color:${fg};mso-line-height-rule:exactly;font-size:15px;font-weight:600;text-decoration:none;padding:15px 24px;border-radius:12px;text-align:center;mso-hide:all;-webkit-text-size-adjust:none;font-family:${FONT_STACK};${primary ? "" : `border:2px solid ${borderColor};`}"><span style="color:${fg} !important;-webkit-text-fill-color:${fg};">${escapeHtml(label)}</span></a>
          <!--<![endif]-->
        </td></tr>`;
}

function listingCard(listing: ListingInfo, showButton = false, cardNumber?: number, lang: ServerLocale = "nl"): string {
  const safeUrl = sanitizeUrl(listing.url);
  const baseUrl = getAppBaseUrl();
  const applyUrl = listing.listing_id ? `${baseUrl}/apply/${listing.listing_id}` : null;
  const rawImageUrl = sanitizeUrl(listing.image_url);
  const safeImageUrl = rawImageUrl ? upgradeImageUrl(rawImageUrl) : null;
  const linkTarget = safeUrl || applyUrl || "#";

  const imageHtml = safeImageUrl
    ? `<tr><td style="padding:0;line-height:0;font-size:0;">
        <a href="${escapeHtml(linkTarget)}" target="_blank" style="text-decoration:none;">
          <img src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(listing.title)}" width="100%" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;" />
        </a>
      </td></tr>`
    : "";

  const priceLine = listing.price > 0
    ? `<p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${C.text};line-height:1.2;font-family:${FONT_STACK};">${formatPrice(listing.price)}<span style="font-size:13px;font-weight:400;color:${C.textSecondary};margin-left:3px;">${escapeHtml(t(lang, "email.perMonth"))}</span></p>`
    : "";

  const metaParts: string[] = [];
  if (listing.city) metaParts.push(escapeHtml(listing.city));
  if (listing.bedrooms > 0) metaParts.push(`${listing.bedrooms} ${t(lang, listing.bedrooms > 1 ? "email.rooms_plural" : "email.room")}`);
  if (listing.size_m2 > 0) metaParts.push(`${listing.size_m2} m\u00B2`);

  const metaHtml = metaParts.length > 0
    ? `<p style="margin:0 0 4px;font-size:13px;color:${C.textSecondary};line-height:1.5;font-family:${FONT_STACK};">${metaParts.join(`<span style="color:${C.border};"> &middot; </span>`)}</p>`
    : "";

  const ctaRows: string[] = [];
  if (showButton) {
    if (safeUrl) {
      ctaRows.push(ctaButton(safeUrl, t(lang, "email.viewProperty"), true));
    } else if (applyUrl) {
      ctaRows.push(ctaButton(applyUrl, t(lang, "email.viewProperty"), true));
    }
  }

  const buttonHtml = ctaRows.length > 0
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
        ${ctaRows.join("\n        ")}
      </table>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.white};border-radius:16px;overflow:hidden;margin:0 0 24px;border:1px solid ${C.border};">
${imageHtml}
<tr><td style="padding:20px 20px 24px;">
  ${cardNumber ? `<p style="margin:0 0 8px;font-size:11px;font-weight:600;color:${C.textSecondary};text-transform:uppercase;letter-spacing:0.05em;font-family:${FONT_STACK};">${escapeHtml(t(lang, "email.listingLabel"))} ${cardNumber}</p>` : ""}
  <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:${C.text};line-height:1.3;font-family:${FONT_STACK};">${escapeHtml(listing.title)}</h3>
  ${priceLine}
  ${metaHtml}
  ${buttonHtml}
</td></tr>
</table>`;
}

export async function sendMatchAlert(
  userEmail: string,
  listing: ListingInfo,
  lang: ServerLocale = "nl",
  buddyUnsubscribeUrl?: string
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

    const safeUrl = sanitizeUrl(listing.url);
    const textBody = `${t(lang, "email.greeting")},\n\n${t(lang, "email.singleIntro")}\n\n${listing.title}\n${detailsText}${safeUrl ? `\n\n${t(lang, "email.viewProperty")}: ${safeUrl}` : ""}\n\n${t(lang, "email.closing")}`;

    const htmlContent = `
<p style="margin:0 0 6px;font-size:11px;font-weight:600;color:${C.primary};text-transform:uppercase;letter-spacing:0.06em;font-family:${FONT_STACK};">${escapeHtml(t(lang, "email.newMatch"))}</p>
<p style="margin:0 0 20px;font-size:14px;color:${C.textSecondary};line-height:1.6;font-family:${FONT_STACK};">${escapeHtml(t(lang, "email.matchFound"))}</p>
${listingCard(listing, true, undefined, lang)}`;

    const senderConfig = getEmailConfig();
    log(`[EMAIL SEND] from="${senderConfig.from}" reply_to="${senderConfig.replyTo}" to="${userEmail}" subject="${subject}" lang=${lang} image=${listing.image_url ? listing.image_url.substring(0, 80) : "NO_IMAGE"}`);

    const { data, error } = await finalEmailDispatch(client, {
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader, lang, undefined, buddyUnsubscribeUrl),
    }, buddyUnsubscribeUrl ? "buddy-match" : "user-match");

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
  lang: ServerLocale = "nl",
  emailCategory: string = "user-match",
  buddyUnsubscribeUrl?: string
): Promise<boolean> {
  if (listings.length === 0) return false;

  if (listings.length === 1) {
    return sendMatchAlert(userEmail, listings[0], lang, buddyUnsubscribeUrl);
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
<p style="margin:0 0 6px;font-size:11px;font-weight:600;color:${C.primary};text-transform:uppercase;letter-spacing:0.06em;font-family:${FONT_STACK};">${escapeHtml(matchesLabel)}</p>
<p style="margin:0 0 20px;font-size:14px;color:${C.textSecondary};line-height:1.6;font-family:${FONT_STACK};">${escapeHtml(matchesDesc)}</p>
${htmlListings}`;

    const imageStats = listings.map((l, i) => `${i + 1}:${l.image_url ? l.image_url.substring(0, 80) : "NO_IMAGE"}`).join(" | ");
    const senderConfig = getEmailConfig();
    log(`[EMAIL SEND] batch from="${senderConfig.from}" reply_to="${senderConfig.replyTo}" to="${userEmail}" count=${listings.length} lang=${lang} subject="${subject}"`);
    log(`[EMAIL IMAGES] ${imageStats}`);

    const { data, error } = await finalEmailDispatch(client, {
      to: userEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheader, lang, undefined, buddyUnsubscribeUrl),
    }, emailCategory);

    if (error) {
      log(`[EMAIL FAIL] batch to=${userEmail} count=${listings.length} lang=${lang} category=${emailCategory} error=${error.message} name=${(error as any).name || "unknown"} statusCode=${(error as any).statusCode || "N/A"}`);
      return false;
    }

    log(`[EMAIL OK] batch to=${userEmail} count=${listings.length} lang=${lang} category=${emailCategory} id=${(data as any)?.id || "N/A"}`);
    return true;
  } catch (err: any) {
    log(`[EMAIL ERROR] batch to=${userEmail} lang=${lang} category=${emailCategory} err=${err.message} stack=${err.stack?.split("\n")[1]?.trim() || "N/A"}`);
    return false;
  }
}

export async function sendBuddyInvitationEmail(
  buddyEmail: string,
  inviterName: string,
  lang: ServerLocale = "nl"
): Promise<boolean> {
  try {
    const client = await getResendClient();
    const baseUrl = getAppBaseUrl();

    const subjects: Record<ServerLocale, string> = {
      nl: `\u{1F3E0} ${inviterName} heeft je toegevoegd als Zoekbuddy op HousAlert`,
      de: `\u{1F3E0} ${inviterName} hat dich als Suchbuddy bei HousAlert hinzugef\u00FCgt`,
      en: `\u{1F3E0} ${inviterName} added you as a Search Buddy on HousAlert`,
    };

    const htmlBodies: Record<ServerLocale, string> = {
      nl: `
<p style="margin:0 0 6px;font-size:22px;font-weight:700;color:${C.text};line-height:1.3;font-family:${FONT_STACK};">Hey! \u{1F44B}</p>
<p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.6;font-family:${FONT_STACK};">
  <strong>${escapeHtml(inviterName)}</strong> heeft je toegevoegd als <strong>Zoekbuddy</strong> op HousAlert.
</p>
<p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.6;font-family:${FONT_STACK};">
  Dit betekent dat je voortaan dezelfde woningmeldingen ontvangt als ${escapeHtml(inviterName)}. Zo kunnen jullie samen sneller reageren en de kans op een woning vergroten!
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="${baseUrl}" target="_blank" style="display:inline-block;background-color:${C.primary};color:${C.white} !important;font-size:15px;font-weight:600;text-decoration:none;padding:15px 32px;border-radius:12px;font-family:${FONT_STACK};">Bekijk HousAlert</a>
  </td></tr>
</table>
<p style="margin:0;font-size:13px;color:${C.textSecondary};line-height:1.6;font-family:${FONT_STACK};">
  Veel succes met de zoektocht!
</p>`,
      de: `
<p style="margin:0 0 6px;font-size:22px;font-weight:700;color:${C.text};line-height:1.3;font-family:${FONT_STACK};">Hey! \u{1F44B}</p>
<p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.6;font-family:${FONT_STACK};">
  <strong>${escapeHtml(inviterName)}</strong> hat dich als <strong>Suchbuddy</strong> bei HousAlert hinzugef\u00FCgt.
</p>
<p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.6;font-family:${FONT_STACK};">
  Das bedeutet, dass du ab jetzt dieselben Wohnungsmeldungen erh\u00E4ltst wie ${escapeHtml(inviterName)}. So k\u00F6nnt ihr zusammen schneller reagieren und eure Chancen auf eine Wohnung erh\u00F6hen!
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="${baseUrl}" target="_blank" style="display:inline-block;background-color:${C.primary};color:${C.white} !important;font-size:15px;font-weight:600;text-decoration:none;padding:15px 32px;border-radius:12px;font-family:${FONT_STACK};">HousAlert ansehen</a>
  </td></tr>
</table>
<p style="margin:0;font-size:13px;color:${C.textSecondary};line-height:1.6;font-family:${FONT_STACK};">
  Viel Erfolg bei der Wohnungssuche!
</p>`,
      en: `
<p style="margin:0 0 6px;font-size:22px;font-weight:700;color:${C.text};line-height:1.3;font-family:${FONT_STACK};">Hey! \u{1F44B}</p>
<p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.6;font-family:${FONT_STACK};">
  <strong>${escapeHtml(inviterName)}</strong> added you as a <strong>Search Buddy</strong> on HousAlert.
</p>
<p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.6;font-family:${FONT_STACK};">
  This means you\u2019ll receive the same listing alerts as ${escapeHtml(inviterName)}. Together, you can react faster and improve your chances of finding a home!
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="${baseUrl}" target="_blank" style="display:inline-block;background-color:${C.primary};color:${C.white} !important;font-size:15px;font-weight:600;text-decoration:none;padding:15px 32px;border-radius:12px;font-family:${FONT_STACK};">View HousAlert</a>
  </td></tr>
</table>
<p style="margin:0;font-size:13px;color:${C.textSecondary};line-height:1.6;font-family:${FONT_STACK};">
  Good luck with the search!
</p>`,
    };

    const textBodies: Record<ServerLocale, string> = {
      nl: `Hey!\n\n${inviterName} heeft je toegevoegd als Zoekbuddy op HousAlert.\n\nDit betekent dat je voortaan dezelfde woningmeldingen ontvangt. Zo kunnen jullie samen sneller reageren!\n\nBekijk HousAlert: ${baseUrl}\n\nVeel succes!`,
      de: `Hey!\n\n${inviterName} hat dich als Suchbuddy bei HousAlert hinzugef\u00FCgt.\n\nDas bedeutet, dass du ab jetzt dieselben Wohnungsmeldungen erh\u00E4ltst. So k\u00F6nnt ihr zusammen schneller reagieren!\n\nHousAlert ansehen: ${baseUrl}\n\nViel Erfolg!`,
      en: `Hey!\n\n${inviterName} added you as a Search Buddy on HousAlert.\n\nThis means you'll receive the same listing alerts. Together, you can react faster!\n\nView HousAlert: ${baseUrl}\n\nGood luck!`,
    };

    const subject = sanitizeSubject(subjects[lang] || subjects.nl);
    const htmlContent = htmlBodies[lang] || htmlBodies.nl;
    const textBody = textBodies[lang] || textBodies.nl;

    const senderConfig = getEmailConfig();
    log(`[EMAIL SEND] buddy-invite from="${senderConfig.from}" reply_to="${senderConfig.replyTo}" to="${buddyEmail}" inviter="${inviterName}" lang=${lang}`);

    const preheaders: Record<ServerLocale, string> = {
      nl: `${inviterName} heeft je toegevoegd als Zoekbuddy`,
      de: `${inviterName} hat dich als Suchbuddy hinzugef\u00FCgt`,
      en: `${inviterName} added you as a Search Buddy`,
    };

    const { data, error } = await finalEmailDispatch(client, {
      to: buddyEmail,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, preheaders[lang] || preheaders.nl, lang),
    }, "buddy-invite");

    if (error) {
      log(`[EMAIL FAIL] buddy-invite to=${buddyEmail} error=${error.message}`);
      return false;
    }

    log(`[EMAIL OK] buddy-invite to=${buddyEmail} id=${(data as any)?.id || "N/A"}`);
    return true;
  } catch (err: any) {
    log(`[EMAIL ERROR] buddy-invite to=${buddyEmail} err=${err.message}`);
    return false;
  }
}

function getBuddyUnsubscribeSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return null;
  }
  return secret;
}

export function generateBuddyUnsubscribeToken(ownerUserId: string, buddyEmail: string): string | null {
  const secret = getBuddyUnsubscribeSecret();
  if (!secret) {
    log("[BUDDY UNSUB] Cannot generate token — SESSION_SECRET not configured");
    return null;
  }

  const email = buddyEmail.toLowerCase().trim();
  const payload = `${ownerUserId}:${email}`;
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  const data = Buffer.from(JSON.stringify({ u: ownerUserId, e: email })).toString("base64url");
  return `${data}.${signature}`;
}

export function verifyBuddyUnsubscribeToken(token: string): { ownerUserId: string; buddyEmail: string } | null {
  const secret = getBuddyUnsubscribeSecret();
  if (!secret) return null;

  try {
    const [data, signature] = token.split(".");
    if (!data || !signature) return null;
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    const ownerUserId = parsed.u;
    const buddyEmail = parsed.e;
    if (!ownerUserId || !buddyEmail) return null;
    const payload = `${ownerUserId}:${buddyEmail.toLowerCase().trim()}`;
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const expected = hmac.digest("hex");
    if (signature !== expected) return null;
    return { ownerUserId, buddyEmail: buddyEmail.toLowerCase().trim() };
  } catch {
    return null;
  }
}

export const validateBuddyUnsubscribeToken = verifyBuddyUnsubscribeToken;

export function getBuddyUnsubscribeUrl(ownerUserId: string, buddyEmail: string): string | null {
  const token = generateBuddyUnsubscribeToken(ownerUserId, buddyEmail);
  if (!token) return null;
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/api/buddy-unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  lang: ServerLocale = "nl"
): Promise<boolean> {
  try {
    const client = await getResendClient();

    const subject = sanitizeSubject(t(lang, "email.resetPassword.subject"));
    const title = t(lang, "email.resetPassword.title");
    const intro = t(lang, "email.resetPassword.intro");
    const cta = t(lang, "email.resetPassword.cta");
    const fallback = t(lang, "email.resetPassword.fallback");
    const ignore = t(lang, "email.resetPassword.ignore");

    const safeUrl = sanitizeUrl(resetUrl) || resetUrl;

    const htmlContent = `
<p style="margin:0 0 6px;font-size:22px;font-weight:700;color:${C.text};line-height:1.3;font-family:${FONT_STACK};">${escapeHtml(title)}</p>
<p style="margin:0 0 24px;font-size:15px;color:${C.text};line-height:1.6;font-family:${FONT_STACK};">
  ${escapeHtml(intro)}
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr><td align="center">
    <a href="${safeUrl}" target="_blank" style="display:inline-block;background-color:${C.primary};color:${C.white} !important;font-size:15px;font-weight:600;text-decoration:none;padding:15px 32px;border-radius:12px;font-family:${FONT_STACK};">${escapeHtml(cta)}</a>
  </td></tr>
</table>
<p style="margin:0 0 12px;font-size:13px;color:${C.textSecondary};line-height:1.6;font-family:${FONT_STACK};">
  ${escapeHtml(fallback)}<br />
  <a href="${safeUrl}" target="_blank" style="color:${C.primary};text-decoration:underline;word-break:break-all;font-size:13px;font-family:${FONT_STACK};">${safeUrl}</a>
</p>
<p style="margin:0;font-size:13px;color:${C.textSecondary};line-height:1.6;font-family:${FONT_STACK};">
  ${escapeHtml(ignore)}
</p>`;

    const textBody = `${title}\n\n${intro}\n\n${cta}: ${safeUrl}\n\n${fallback}\n${safeUrl}\n\n${ignore}`;

    log(`[EMAIL SEND] password-reset to="${email}" lang=${lang}`);

    const footer = t(lang, "email.resetPassword.footer");
    const { data, error } = await finalEmailDispatch(client, {
      to: email,
      subject,
      text: textBody,
      html: emailWrapper(htmlContent, intro, lang, footer),
    }, "password-reset");

    if (error) {
      log(`[EMAIL FAIL] password-reset to=${email} error=${error.message}`);
      return false;
    }

    log(`[EMAIL OK] password-reset to=${email} id=${(data as any)?.id || "N/A"}`);
    return true;
  } catch (err: any) {
    log(`[EMAIL ERROR] password-reset to=${email} err=${err.message}`);
    return false;
  }
}

export async function sendControlledTestEmail(
  toEmail: string
): Promise<{ success: boolean; from: string; replyTo: string; to: string; resendId?: string; error?: string }> {
  const config = getEmailConfig();

  log(`[ADMIN TEST EMAIL] Sending controlled test email — from="${config.from}" reply_to="${config.replyTo}" to="${toEmail}"`);

  const client = await getResendClient();

  const { data, error } = await client.emails.send({
    from: config.from,
    reply_to: config.replyTo,
    to: toEmail,
    subject: "HousAlert email test",
    text: "This is a controlled production email test.",
    html: emailWrapper(
      `<p style="margin:0 0 6px;font-size:22px;font-weight:700;color:${C.text};line-height:1.3;font-family:${FONT_STACK};">Email Test</p>
       <p style="margin:0 0 16px;font-size:15px;color:${C.text};line-height:1.6;font-family:${FONT_STACK};">This is a controlled production email test.</p>
       <p style="margin:0;font-size:13px;color:${C.textSecondary};line-height:1.6;font-family:${FONT_STACK};">If you received this email, your Resend integration is working correctly.</p>`,
      "HousAlert email test",
      "en"
    ),
  });

  if (error) {
    log(`[ADMIN TEST EMAIL] FAILED — error=${(error as any).message} statusCode=${(error as any).statusCode || "N/A"}`);
    return { success: false, from: config.from, replyTo: config.replyTo, to: toEmail, error: (error as any).message };
  }

  const resendId = (data as any)?.id || "N/A";
  log(`[ADMIN TEST EMAIL] SUCCESS — resend_id=${resendId} from="${config.from}" reply_to="${config.replyTo}" to="${toEmail}" — Resend accepted the send`);
  return { success: true, from: config.from, replyTo: config.replyTo, to: toEmail, resendId };
}
