/** Limited local references only. The caller always labels these as non-AI replies. */
export interface OfflineContext {
  academyName: string;
  programmes: { title: string; category: string; description?: string }[];
  contactEmail: string;
  contactPhone: string;
  address: string;
  intakeStatus: string;
}

export function answerLocally(question: string, ctx: OfflineContext): string | null {
  const q = question.trim().toLowerCase();
  if (!q) return null;
  const name = ctx.academyName || "AFRICA OF HOPE";
  const contact = [
    ctx.contactEmail && `- Email: ${ctx.contactEmail}`,
    ctx.contactPhone && `- Phone: ${ctx.contactPhone}`,
    ctx.address && `- Address: ${ctx.address}`,
  ].filter(Boolean).join("\n") || "Contact the AFRICA OF HOPE office through the website's contact page.";

  if (/\b(hello|hi|hey)\b|who are you|what are you|introduce/.test(q)) {
    return `I'm **AOH AI**, affiliated with **AFRICA OF HOPE**. The AI connection is currently unavailable. This limited local mode can only show available school references; general questions, writing and study help require the AI connection.`;
  }
  if (/program|course|offer|study|learn|training/.test(q)) {
    const programmes = ctx.programmes.slice(0, 12);
    return programmes.length
      ? `**${name}** lists these programmes in the portal:\n\n${programmes.map((p) => `- **${p.title}** (${p.category})`).join("\n")}\n\nConfirm current availability, fees and requirements with the office.`
      : `I cannot confirm the current programme list in local mode.\n\n${contact}`;
  }
  if (/apply|admission|enrol|enroll|register|join|requirement/.test(q)) {
    return `See the website's **Admissions** page for published application information. I cannot confirm current intake status, admission requirements or approval procedures in local mode.\n\n${contact}`;
  }
  if (/fee|tuition|cost|price|pay|owe|balance|money/.test(q)) {
    return `For your recorded payments and balance, sign in and open **Fees**. I cannot access your personal balance or confirm payment methods in local mode. Confirm programme fees and payment instructions with the office.\n\n${contact}`;
  }
  if (/certificate|verify|verification|certify|transcript/.test(q)) {
    return `Use the website's **Verify Certificate** page and the certificate's serial number to check the school's verification record. Local mode cannot verify a certificate or confirm accreditation or recognition.\n\n${contact}`;
  }
  if (/contact|address|location|phone|email|office|reach|where/.test(q)) {
    return `**Contact ${name}:**\n\n${contact}`;
  }
  if (/quiz|assignment|attendance|grade|class|cohort|portal|login|password/.test(q)) {
    return "Sign in to access the portal features available to your account, such as lessons, assignments, fees and certificates. If you cannot sign in, use **Forgot password** on the sign-in screen or contact the school office. Local mode cannot read or change private account records.";
  }
  return null;
}
