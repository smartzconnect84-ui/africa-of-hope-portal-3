export interface Enquiry {
  id: string;
  name: string;
  contact: string;
  program: string;
  message: string;
  createdAt: string;
  replied: boolean;
}

const KEY = "aoh-enquiries-v1";

export function loadEnquiries(): Enquiry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Enquiry[]) : [];
  } catch {
    return [];
  }
}

export function saveEnquiry(input: Omit<Enquiry, "id" | "createdAt" | "replied">): Enquiry {
  const entry: Enquiry = {
    ...input,
    id: `enq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    replied: false,
  };
  try {
    const list = loadEnquiries();
    localStorage.setItem(KEY, JSON.stringify([entry, ...list].slice(0, 500)));
  } catch {
    // Private mode — the WhatsApp handoff below still delivers the message.
  }
  return entry;
}

export function updateEnquiry(id: string, patch: Partial<Enquiry>) {
  try {
    const list = loadEnquiries().map((e) => (e.id === id ? { ...e, ...patch } : e));
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function removeEnquiry(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadEnquiries().filter((e) => e.id !== id)));
  } catch {
    /* ignore */
  }
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
