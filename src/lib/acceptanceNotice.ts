import { supabase } from "@/integrations/supabase/client";

/**
 * Item 7 — when an administrator approves an application, the applicant must be
 * told automatically that they are accepted and should sign in to the portal.
 *
 * Email goes through the existing `email_outbox` queue (the same table the
 * outbox UI and the send-email worker already use), so delivery is retried and
 * observable. WhatsApp has no provider credentials in this project, so we build
 * a ready-to-send wa.me deep link for the approving admin instead of pretending
 * a message was delivered.
 */

export interface AcceptanceTarget {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export function acceptanceMessage(user: AcceptanceTarget): string {
  const name = user.name?.trim() || "Applicant";
  return [
    `Hello ${name},`,
    "",
    "Your application to the Africa of Hope Skills Academy has been accepted.",
    "You can now sign in to the student portal with this email address to access your course, timetable and learning materials.",
    "",
    "Please complete your entrance/aptitude test (60% pass mark) before your first lesson if you are enrolled on a 1, 3 or 6 month course.",
    "",
    "Welcome aboard!",
    "Admissions — Africa of Hope Skills Academy",
  ].join("\n");
}

/** Digits only, with a Nigerian default country code when a local number is used. */
export function whatsappNumber(phone?: string): string {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

export function whatsappLink(user: AcceptanceTarget): string {
  const number = whatsappNumber(user.phone);
  const text = encodeURIComponent(acceptanceMessage(user));
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

/**
 * Queue the acceptance email. Never throws: approval must not fail because the
 * mail queue is unavailable, so the caller can show a warning instead.
 */
export async function queueAcceptanceEmail(user: AcceptanceTarget): Promise<string | null> {
  if (!user.email?.includes("@")) return "No email address on the application.";
  const { error } = await supabase.from("email_outbox").insert({
    to_email: user.email,
    to_name: user.name ?? "",
    template: "application-accepted",
    subject: "Your application has been accepted — sign in to your portal",
    payload: {
      name: user.name,
      body: acceptanceMessage(user),
      signInUrl: `${window.location.origin}/?portal=signin`,
    },
    dedupe_key: `accepted:${user.id}`,
    related_user_id: user.id,
  });
  if (error) return error.message;
  return null;
}

/** Convenience wrapper used by the admin approval action. */
export async function sendAcceptanceNotice(user: AcceptanceTarget): Promise<string | null> {
  return queueAcceptanceEmail(user);
}
