import { supabase } from "@/integrations/supabase/client";

export interface Enquiry {
  id: string;
  name: string;
  contact: string;
  program: string;
  message: string;
  createdAt: string;
  replied: boolean;
}

export type EnquirySource = "contact" | "faq" | "whatsapp";

export interface EnquiryInput {
  name: string;
  contact: string;
  program: string;
  message: string;
  source?: EnquirySource;
}

type EnquiryRow = {
  id: string;
  name: string;
  contact: string;
  program: string;
  message: string;
  created_at: string;
  replied: boolean;
};

function mapEnquiry(row: EnquiryRow): Enquiry {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    program: row.program,
    message: row.message,
    createdAt: row.created_at,
    replied: row.replied,
  };
}

export async function loadEnquiries(): Promise<Enquiry[]> {
  const { data, error } = await supabase
    .from("website_enquiries")
    .select("id,name,contact,program,message,created_at,replied")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data ?? []).map((row) => mapEnquiry(row as EnquiryRow));
}

export async function saveEnquiry(input: EnquiryInput): Promise<void> {
  const { error } = await supabase.from("website_enquiries").insert({
    name: input.name.trim(),
    contact: input.contact.trim(),
    program: input.program.trim() || "General enquiry",
    message: input.message.trim(),
    source: input.source ?? "whatsapp",
    replied: false,
  });

  if (error) throw error;
}

export async function updateEnquiry(id: string, patch: Pick<Partial<Enquiry>, "replied">): Promise<void> {
  const { error } = await supabase
    .from("website_enquiries")
    .update({ replied: patch.replied })
    .eq("id", id);

  if (error) throw error;
}

export async function removeEnquiry(id: string): Promise<void> {
  const { error } = await supabase.from("website_enquiries").delete().eq("id", id);
  if (error) throw error;
}

/** Extract a dialable WhatsApp number from the free-form contact setting. */
export function schoolWhatsAppNumber(contactPhone: string): string {
  const match = contactPhone.match(/\+\d[\d\s\-/]*/);
  if (match) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 9) return digits;
  }
  const fallback = contactPhone.replace(/\D/g, "");
  if (fallback.length >= 9) return fallback.slice(0, 15);
  return "231776679963";
}

export function buildWhatsAppLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function enquiryMessage(e: { name: string; contact: string; program: string; message: string }): string {
  const prog = e.program && e.program !== "General enquiry" ? ` (interested in ${e.program})` : "";
  return `Hello AFRICA OF HOPE, my name is ${e.name}${prog}. ${e.message} — You can reach me on ${e.contact}.`;
}
