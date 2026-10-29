import { z } from 'zod';
import { DEFAULT_LAYOUT, DEFAULT_PWA } from '@/data/publicPresentation';
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
  return { ...pwa, name: pwa.name.trim() || DEFAULT_PWA.name, shortName: pwa.shortName.trim() || DEFAULT_PWA.shortName,
    ...Object.fromEntries((['icon192', 'icon512', 'maskable', 'touchIcon', 'splashImage'] as const).map(key => [key, publicImage(pwa[key], DEFAULT_PWA[key])])) };
}
