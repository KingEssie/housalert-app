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

    const listingRows = listings.map((l) => {
      const details = [
        l.price > 0 ? `\u20AC${l.price}/mnd` : null,
        l.bedrooms > 0 ? `${l.bedrooms} kamers` : null,
        l.size_m2 > 0 ? `${l.size_m2} m\u00B2` : null,
      ]
        .filter(Boolean)
        .join(" \u2022 ");
      return { ...l, details };
    });

    const textBody = listingRows
      .map(
        (l, i) =>
          `${i + 1}. ${l.title}\n   ${l.details}\n   ${l.city}${l.url ? `\n   ${l.url}` : ""}`
      )
      .join("\n\n");

    const htmlListItems = listingRows
      .map(
        (l) => `
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:12px 0;">
          <h3 style="margin:0 0 4px 0;color:#222;font-size:15px;">${l.title}</h3>
          <p style="margin:0;color:#555;font-size:14px;">${l.details} &mdash; ${l.city}</p>
          ${l.url ? `<a href="${l.url}" style="color:#0066cc;font-size:13px;display:inline-block;margin-top:6px;">Bekijk de woning &rarr;</a>` : ""}
        </div>`
      )
      .join("");

    const { error } = await client.emails.send({
      from: fromEmail || "HousAlert <onboarding@resend.dev>",
      to: userEmail,
      subject: `${listings.length} nieuwe matches gevonden`,
      text: `Hoi!\n\nEr ${listings.length === 1 ? "is 1 nieuwe woning" : `zijn ${listings.length} nieuwe woningen`} gevonden die ${listings.length === 1 ? "past" : "passen"} bij je zoekopdracht:\n\n${textBody}\n\nGroet,\nHousAlert`,
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#333;margin-bottom:4px;">${listings.length} nieuwe matches gevonden!</h2>
        <p style="color:#666;margin-top:0;">Er ${listings.length === 1 ? "is een woning" : `zijn ${listings.length} woningen`} gevonden die ${listings.length === 1 ? "past" : "passen"} bij je zoekopdracht.</p>
        ${htmlListItems}
        <p style="color:#999;font-size:13px;margin-top:20px;">Je ontvangt deze e-mail omdat je een zoekopdracht hebt ingesteld op HousAlert.</p>
      </div>`,
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

export async function sendMatchAlert(
  userEmail: string,
  listing: ListingInfo
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const details = [
      `Stad: ${listing.city}`,
      listing.price > 0 ? `Prijs: \u20AC${listing.price}/mnd` : null,
      listing.bedrooms > 0 ? `Slaapkamers: ${listing.bedrooms}` : null,
      listing.size_m2 > 0 ? `Oppervlakte: ${listing.size_m2} m\u00B2` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const linkLine = listing.url
      ? `\n\nBekijk de woning: ${listing.url}`
      : "";

    const htmlDetails = [
      `<strong>Stad:</strong> ${listing.city}`,
      listing.price > 0 ? `<strong>Prijs:</strong> \u20AC${listing.price}/mnd` : null,
      listing.bedrooms > 0 ? `<strong>Slaapkamers:</strong> ${listing.bedrooms}` : null,
      listing.size_m2 > 0 ? `<strong>Oppervlakte:</strong> ${listing.size_m2} m\u00B2` : null,
    ]
      .filter(Boolean)
      .join("<br/>");

    const linkHtml = listing.url
      ? `<br/><br/><a href="${listing.url}" style="color:#0066cc;">Bekijk de woning &rarr;</a>`
      : "";

    const { error } = await client.emails.send({
      from: fromEmail || "HousAlert <onboarding@resend.dev>",
      to: userEmail,
      subject: `Nieuwe match: ${listing.title}`,
      text: `Hoi!\n\nEr is een nieuwe woning gevonden die past bij je zoekopdracht:\n\n${listing.title}\n${details}${linkLine}\n\nGroet,\nHousAlert`,
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#333;margin-bottom:4px;">Nieuwe match gevonden!</h2>
        <p style="color:#666;margin-top:0;">Er is een woning gevonden die past bij je zoekopdracht.</p>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:16px 0;">
          <h3 style="margin:0 0 8px 0;color:#222;">${listing.title}</h3>
          <p style="margin:0;color:#555;line-height:1.6;">${htmlDetails}</p>
          ${linkHtml}
        </div>
        <p style="color:#999;font-size:13px;">Je ontvangt deze e-mail omdat je een zoekopdracht hebt ingesteld op HousAlert.</p>
      </div>`,
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
