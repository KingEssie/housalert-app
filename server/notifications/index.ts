import twilio from "twilio";
import { sendMatchAlert as sendEmailViaResend } from "../email";
import { log } from "../index";

interface ListingInfo {
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  url?: string | null;
}

function formatMessage(listing: ListingInfo): string {
  const baseUrl = process.env.APP_PUBLIC_BASE_URL || "";
  const link = listing.url || (baseUrl ? `${baseUrl}/dashboard` : "");
  const parts = [
    `Nieuwe match gevonden: ${listing.title}`,
    listing.city,
    listing.price > 0 ? `€${listing.price}/mnd` : null,
    listing.size_m2 > 0 ? `${listing.size_m2}m²` : null,
    listing.bedrooms > 0 ? `${listing.bedrooms} slk.` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return link ? `${parts}\nLink: ${link}` : parts;
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export async function sendEmailMatchAlert(
  userEmail: string,
  listing: ListingInfo
): Promise<boolean> {
  return sendEmailViaResend(userEmail, listing);
}

export async function sendSmsMatchAlert(
  phone: string,
  listing: ListingInfo
): Promise<boolean> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_SMS_FROM;
  if (!client || !from) {
    log("SMS alert skipped — Twilio not configured");
    return false;
  }

  try {
    await client.messages.create({
      body: formatMessage(listing),
      from,
      to: phone,
    });
    log(`SMS alert sent to ${phone} for listing "${listing.title}"`);
    return true;
  } catch (err: any) {
    log(`SMS alert failed to ${phone}: ${err.message}`);
    return false;
  }
}

export async function sendWhatsappMatchAlert(
  phone: string,
  listing: ListingInfo
): Promise<boolean> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!client || !from) {
    log("WhatsApp alert skipped — Twilio not configured");
    return false;
  }

  const to = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;

  try {
    await client.messages.create({
      body: formatMessage(listing),
      from,
      to,
    });
    log(`WhatsApp alert sent to ${phone} for listing "${listing.title}"`);
    return true;
  } catch (err: any) {
    log(`WhatsApp alert failed to ${phone}: ${err.message}`);
    return false;
  }
}

export interface NotificationSettings {
  phone_e164: string | null;
  whatsapp_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
}

export async function sendMatchAlerts(
  userId: string,
  userEmail: string | undefined,
  listing: ListingInfo,
  supabase: any
): Promise<void> {
  const { data: settings } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const emailEnabled = settings?.email_enabled ?? true;
  const smsEnabled = settings?.sms_enabled ?? false;
  const whatsappEnabled = settings?.whatsapp_enabled ?? false;
  const phone = settings?.phone_e164;

  const promises: Promise<boolean>[] = [];

  if (emailEnabled && userEmail) {
    promises.push(sendEmailMatchAlert(userEmail, listing));
  }

  if (smsEnabled && phone) {
    promises.push(sendSmsMatchAlert(phone, listing));
  }

  if (whatsappEnabled && phone) {
    promises.push(sendWhatsappMatchAlert(phone, listing));
  }

  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }
}
