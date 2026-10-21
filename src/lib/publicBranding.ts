import type { WebsiteSettings } from '@/types';
import { resolvedPwa } from './publicSettingsValidation';

const STORAGE_KEY = 'aoh-public-launch-v1';
const safeImage = (value: string) => {
  try { const url = new URL(value, location.origin); return url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === location.origin) ? url.href : ''; } catch { return ''; }
};
/** Public identity only; never stores account data. Called before React paints. */
export function restorePublicLaunch() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return;
    const image = document.querySelector<HTMLImageElement>('#aoh-splash img');
    if (image && typeof saved.image === 'string' && safeImage(saved.image)) image.src = safeImage(saved.image);
    const text = document.querySelector('#aoh-splash .aoh-splash-name');
    if (text && typeof saved.text === 'string') text.textContent = saved.text.slice(0, 120);
  } catch { /* Static launch identity remains available. */ }
}
export function applyPublicBranding(w: WebsiteSettings) {
  const pwa = resolvedPwa(w);
  const link = (rel: string, href: string) => {
    const elements = [...document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)];
    const element = elements.shift() || document.createElement('link');
    // Remove static alternate-size favicon links so the uploaded favicon wins.
    elements.forEach(item => item.remove());
    element.rel = rel;
    element.href = safeImage(href) || '/favicon.png';
    element.removeAttribute('sizes'); element.removeAttribute('type');
    if (!element.isConnected) document.head.appendChild(element);
  };
  link('icon', w.faviconUrl || '/favicon.png');
  link('apple-touch-icon', pwa.touchIcon);
  for (const name of ['application-name', 'apple-mobile-web-app-title']) {
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!meta) { meta = document.createElement('meta'); meta.name = name; document.head.appendChild(meta); }
    meta.content = pwa.shortName;
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ image: safeImage(pwa.splashImage), text: pwa.splashText })); } catch { /* Storage is optional. */ }
  restorePublicLaunch();
  if (!('serviceWorker' in navigator)) return;
  let cancelled = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const ports = new Set<MessagePort>();
  const manifest = {
    id: '/', name: pwa.name, short_name: pwa.shortName, description: pwa.description,
    start_url: '/', scope: '/', display: 'standalone', orientation: 'any',
    background_color: '#FFFFFF', theme_color: '#16803C', lang: 'en',
    icons: [
      { src: safeImage(pwa.icon192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: safeImage(pwa.icon512), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: safeImage(pwa.maskable), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [['Programmes', 'programmes'], ['Admissions', 'admissions'], ['Get involved', 'support'], ['Blog', 'blog']].map(([name, hash]) => ({ name, url: `/#${hash}` })),
  };
  const sync = () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller || cancelled) return;
    const channel = new MessageChannel();
    ports.add(channel.port1);
    const timer = setTimeout(() => { channel.port1.close(); ports.delete(channel.port1); timers.delete(timer); }, 5000);
    timers.add(timer);
    channel.port1.onmessage = event => {
      clearTimeout(timer); timers.delete(timer); channel.port1.close(); ports.delete(channel.port1);
      if (event.data?.ok && !cancelled) {
        const element = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (element) {
          // Change only when branding changes; the manifest keeps a stable app ID.
          const identity = JSON.stringify(manifest);
          let revision = 0;
          for (let i = 0; i < identity.length; i++) revision = (Math.imul(31, revision) + identity.charCodeAt(i)) | 0;
          const href = `/manifest.webmanifest?cms=${revision >>> 0}`;
          if (element.getAttribute('href') !== href) element.href = href;
        }
      }
    };
    try { controller.postMessage({ type: 'PUBLIC_MANIFEST', manifest }, [channel.port2]); } catch { /* Static manifest remains usable. */ }
  };
  sync();
  navigator.serviceWorker.addEventListener('controllerchange', sync);
  return () => { cancelled = true; timers.forEach(clearTimeout); ports.forEach(port => port.close()); navigator.serviceWorker.removeEventListener('controllerchange', sync); };
}
