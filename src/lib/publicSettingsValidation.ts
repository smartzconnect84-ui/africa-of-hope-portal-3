import { z } from 'zod';
import { CAMPUS_TABS, DEFAULT_CAMPUS_LIFE, DEFAULT_LAYOUT, DEFAULT_PWA } from '@/data/publicPresentation';
import type { WebsiteSettings } from '@/types';

const required = (name: string, max: number) => z.string().trim().min(1, `${name} is required.`).max(max, `${name} must be ${max} characters or fewer.`);
const image = z.string().refine(value => !value || /^(https:\/\/[^\s]+|\/(?!\/)[^\s]*)$/.test(value), 'Use an HTTPS image URL or a local /path.');
const destination = z.string().refine(value => /^(#[^\s]*|\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/.test(value), 'Use #page, a local /path or an HTTPS URL.');
const schema = z.object({
  presentation: z.object({ font: z.enum(['manrope', 'sans', 'serif', 'system']), iconWeight: z.enum(['light', 'normal', 'bold']) }).optional(),
  publicLayout: z.array(z.enum(DEFAULT_LAYOUT as [string, ...string[]])).refine(items => items.length === DEFAULT_LAYOUT.length && new Set(items).size === DEFAULT_LAYOUT.length, 'Include each homepage section exactly once.').optional(),
  pwa: z.object({
    name: required('Application name', 120), shortName: required('Short name', 40),
    description: z.string().max(1000, 'Description must be 1000 characters or fewer.'),
    splashText: z.string().max(120, 'Launch text must be 120 characters or fewer.'),
    icon192: image, icon512: image, maskable: image, touchIcon: image, splashImage: image,
    themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Theme colour must be a #RRGGBB value.'),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Background colour must be a #RRGGBB value.'),
    display: z.enum(['standalone', 'minimal-ui', 'browser', 'fullscreen']),
    orientation: z.enum(['any', 'portrait', 'landscape']),
  }).optional(),
  campusLife: z.object({
    enabled: z.boolean(),
    eyebrow: z.string().max(120, 'Eyebrow must be 120 characters or fewer.'),
    title: required('Campus Life title', 240),
    subtitle: z.string().max(500, 'Subtitle must be 500 characters or fewer.'),
    body: z.string().max(2000, 'Description must be 2000 characters or fewer.'),
    galleryTitle: z.string().max(240, 'Gallery title must be 240 characters or fewer.'),
    galleryNote: z.string().max(500, 'Gallery note must be 500 characters or fewer.'),
    gallery: z.array(z.object({
      id: required('Photo ID', 120),
      caption: required('Photo caption', 240),
      tag: z.string().max(60, 'Tag must be 60 characters or fewer.'),
      image: image.refine(v => !!v, 'Each gallery photo needs an image.'),
    })).max(60, 'Use at most 60 gallery photos.'),
    tabs: z.record(z.string(), z.boolean()),
  }).optional(),
  faviconUrl: image,
  aboutPage: z.object({
    title: required('About title', 240),
    sections: z.array(z.object({ id: required('Section ID', 120), title: required('Section heading', 240), image })).max(50, 'Use at most 50 About sections.').refine(items => new Set(items.map(item => item.id)).size === items.length, 'About section IDs must be unique.'),
    ctas: z.array(z.object({ label: required('Button label', 120), href: destination })).max(12, 'Use at most 12 About buttons.'),
  }).optional(),
});
export type PublicSettingsErrors = Record<string, string>;
export function validatePublicSettings(settings: WebsiteSettings): PublicSettingsErrors {
  const result = schema.safeParse(settings);
  return result.success ? {} : Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.'), issue.message]));
}
export function publicImage(value: string | undefined, fallback: string): string {
  return value && image.safeParse(value).success ? value : fallback;
}
export function publicDestination(value: string): string {
  return destination.safeParse(value).success ? value : '#home';
}
export function resolvedPwa(settings: WebsiteSettings) {
  const pwa = { ...DEFAULT_PWA, ...settings.pwa };
  const color = (v: unknown, fallback: string) => /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : fallback;
  return { ...pwa, name: pwa.name.trim() || DEFAULT_PWA.name, shortName: pwa.shortName.trim() || DEFAULT_PWA.shortName,
    themeColor: color((pwa as { themeColor?: unknown }).themeColor, DEFAULT_PWA.themeColor),
    backgroundColor: color((pwa as { backgroundColor?: unknown }).backgroundColor, DEFAULT_PWA.backgroundColor),
    display: (['standalone', 'minimal-ui', 'browser', 'fullscreen'] as const).includes((pwa as { display?: 'standalone' }).display) ? pwa.display : DEFAULT_PWA.display,
    orientation: (['any', 'portrait', 'landscape'] as const).includes((pwa as { orientation?: 'any' }).orientation) ? pwa.orientation : DEFAULT_PWA.orientation,
    ...Object.fromEntries((['icon192', 'icon512', 'maskable', 'touchIcon', 'splashImage'] as const).map(key => [key, publicImage(pwa[key], DEFAULT_PWA[key])])) };
}

export function resolvedCampusLife(settings: WebsiteSettings) {
  const saved = (settings.campusLife ?? {}) as Partial<typeof DEFAULT_CAMPUS_LIFE>;
  const gallery = Array.isArray(saved.gallery) ? saved.gallery.filter(g => g && typeof g.id === 'string' && typeof g.image === 'string' && g.image) : [];
  const tabs: Record<string, boolean> = {};
  for (const t of CAMPUS_TABS) tabs[t.id] = (saved.tabs as Record<string, boolean> | undefined)?.[t.id] ?? true;
  return {
    enabled: saved.enabled ?? true,
    eyebrow: typeof saved.eyebrow === 'string' && saved.eyebrow ? saved.eyebrow : DEFAULT_CAMPUS_LIFE.eyebrow,
    title: typeof saved.title === 'string' && saved.title.trim() ? saved.title : DEFAULT_CAMPUS_LIFE.title,
    subtitle: typeof saved.subtitle === 'string' ? saved.subtitle : DEFAULT_CAMPUS_LIFE.subtitle,
    body: typeof saved.body === 'string' ? saved.body : DEFAULT_CAMPUS_LIFE.body,
    galleryTitle: typeof saved.galleryTitle === 'string' ? saved.galleryTitle : DEFAULT_CAMPUS_LIFE.galleryTitle,
    galleryNote: typeof saved.galleryNote === 'string' ? saved.galleryNote : DEFAULT_CAMPUS_LIFE.galleryNote,
    gallery: gallery as { id: string; caption: string; tag: string; image: string }[],
    tabs,
  };
}
