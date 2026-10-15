import type { Program } from "@/types";

/**
 * Bundled, royalty-free programme photography (Unsplash licence) served from
 * /public/programs. An admin-uploaded `program.imageUrl` always wins; otherwise
 * the first keyword rule that matches the programme title picks the photo.
 * Rules run in order, so put the more specific phrases first.
 */
const RULES: [RegExp, string][] = [
  [/event/i, "event-planning"],
  [/counsel|guidance/i, "counseling"],
  [/mobile\s*multimedia/i, "mobile-multimedia"],
  [/mobile\s*graphic/i, "mobile-graphics"],
  [/media\s*&?\s*(and\s*)?communication|journalism/i, "media-communication"],
  [/multimedia/i, "professional-multimedia"],
  [/social\s*media/i, "social-media"],
  [/public\s*relation|\bpr\b/i, "public-relations"],
  [/entrepreneur|business/i, "entrepreneurship"],
  [/proposal/i, "proposal-writing"],
  [/project\s*management/i, "project-management"],
  [/monitoring|evaluation|\bm\s*&\s*e\b/i, "monitoring-evaluation"],
  [/school\s*admin/i, "school-administration"],
  [/teacher|education|teaching/i, "teacher-education"],
  [/computer|ict|it\s*basics/i, "computer-basics"],
  [/\bhr\b|human\s*resource/i, "human-resources"],
  [/tv|television|broadcast/i, "tv-production"],
  [/video\s*podcast/i, "video-podcasting"],
  [/podcast/i, "podcasting"],
  [/video|film/i, "video-production"],
  [/graphic|design/i, "graphics-design"],
  [/quick\s*book/i, "quickbooks"],
  [/book\s*keeping|bookkeeping|account/i, "bookkeeping"],
  [/public\s*speaking|speech\s*making/i, "public-speaking"],
  [/writing|article|speech/i, "writing"],
  [/audio|radio|sound/i, "audio-production"],
  [/digital\s*marketing|marketing/i, "digital-marketing"],
  [/leadership|management/i, "leadership"],
  [/customer|reception|front\s*desk/i, "customer-care"],
  [/science|studies/i, "professional-studies"],
];

export const DEFAULT_PROGRAM_IMAGE = "/programs/default.webp";

export function stockImageFor(title: string): string {
  const match = RULES.find(([pattern]) => pattern.test(title));
  return match ? `/programs/${match[1]}.webp` : DEFAULT_PROGRAM_IMAGE;
}

export function programImage(program: Pick<Program, "title" | "imageUrl">): string {
  return program.imageUrl || stockImageFor(program.title);
}
