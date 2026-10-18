/**
 * Offline fallback for Hope Assistant.
 * Answers common academy questions from live portal data when the
 * OpenAI-backed edge function is not configured yet. Clearly labelled
 * as an offline answer by the caller — never pretends to be AI.
 */

export interface OfflineContext {
  academyName: string;
  programmes: { title: string; category: string; description?: string }[];
  contactEmail: string;
  contactPhone: string;
  address: string;
  intakeStatus: string;
}

const norm = (s: string) => s.toLowerCase();

export function answerLocally(question: string, ctx: OfflineContext): string | null {
  const q = norm(question.trim());
  if (!q) return null;
  const name = ctx.academyName || "Africa of Hope Academy";
  const programmes = ctx.programmes.slice(0, 12);

  const programmeList =
    programmes.length > 0
      ? programmes.map((p) => `- **${p.title}** (${p.category})`).join("\n")
      : "- Programme details are being updated — please contact the office.";

  if (/(hello|hi\b|hey|who are you|what are you|introduce)/.test(q)) {
    return `Hello! I'm **Hope Assistant** (${name}) running in **offline mode** right now — the AI connection isn't configured yet, but I can still help.\n\nAsk me about:\n- Programmes we offer\n- How to apply\n- Fees and payments\n- Certificate verification\n- Contact details`;
  }
  if (/(program|course|offer|study|learn|training)/.test(q)) {
    return `**${name}** currently lists these programmes:\n\n${programmeList}\n\nAdmissions status: **${ctx.intakeStatus || "Open"}**. Ask me "how do I apply?" for next steps.`;
  }
  if (/(apply|admission|enrol|enroll|register|join|requirement)/.test(q)) {
    return `**How to apply to ${name}:**\n\n- Create a portal account with the **Sign up** button\n- Complete your profile and choose a programme\n- Wait for admin approval, then sign in to see cohorts, classes and fees\n\nAdmissions status: **${ctx.intakeStatus || "Open"}**.\n\nNeed help? Email ${ctx.contactEmail || "the school office"} or call ${ctx.contactPhone || "the school office"}.`;
  }
  if (/(fee|tuition|cost|price|pay|owe|balance|money)/.test(q)) {
    return `**Fees and payments:**\n\n- Sign in to the portal and open **Fees** to see what you owe and what you've paid\n- Payments are recorded by the school office after you pay\n- For exact amounts for your programme, contact the office\n\n${ctx.contactEmail ? `Email: ${ctx.contactEmail}\n` : ""}${ctx.contactPhone ? `Phone: ${ctx.contactPhone}` : ""}`;
  }
  if (/(certificate|verify|verification|certify|transcript)/.test(q)) {
    return `**Certificate verification:**\n\n- Open the **Verify Certificate** page from the portal menu\n- Enter the certificate ID exactly as printed\n- A genuine certificate shows the student name, programme and date\n\nIf a certificate doesn't verify, contact the school office directly.`;
  }
  if (/(contact|address|location|phone|email|office|reach|where)/.test(q)) {
    return `**Contact ${name}:**\n\n${ctx.contactEmail ? `- Email: ${ctx.contactEmail}\n` : ""}${ctx.contactPhone ? `- Phone: ${ctx.contactPhone}\n` : ""}${ctx.address ? `- Address: ${ctx.address}` : ""}\n\nThe office can help with admissions, fees and certificates.`;
  }
  if (/(quiz|assignment|attendance|grade|class|cohort|portal|login|password)/.test(q)) {
    return `**Using the portal:**\n\n- Sign in, then use the menu: **Learn** (lessons & quizzes), **Assignments** (hand in work), **Fees**, **Calendar** and **Certificates**\n- Forgot your password? Use **Forgot password** on the sign-in screen\n- Anything missing? Ask your teacher or the school admin office.`;
  }
  if (q.length < 60) {
    return `I'm running in **offline mode** (AI not connected yet), but I can help with:\n\n- "What programmes do you offer?"\n- "How do I apply?"\n- "How do I verify a certificate?"\n- "How do I contact the school?"\n\nFor anything else, please contact the school office.`;
  }
  return null;
}
