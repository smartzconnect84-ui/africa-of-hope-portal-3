import type { WebsiteSettings } from "@/types";

/** Owner-approved public profile only; never derived from private staff accounts. */
export const FOUNDER_PROFILE: WebsiteSettings["team"]["members"][number] = {
  id: "founder-shedrick-nungehn",
  name: "Amb. Shedrick K. Nungehn",
  role: "Founder/CEO",
  bio: "Educator, Advocate and Multimedia Journalist from Liberia.",
  image: "https://files.monstarx.app/54c3deukza/public/uploads/chat/1owwaae5m6/WhatsApp_Image_2026-04-04_at_1.19.06_AM.jpeg",
};

export const DEFAULT_TEAM: WebsiteSettings["team"] = {
  enabled: true,
  title: "Meet our team",
  description: "Meet the people behind AFRICA OF HOPE and our mission.",
  members: [FOUNDER_PROFILE],
};
