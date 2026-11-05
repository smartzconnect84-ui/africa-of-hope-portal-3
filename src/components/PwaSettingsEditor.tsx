import { useMemo, useRef, useState } from 'react';
import type { WebsiteSettings } from '@/types';
import { DEFAULT_PWA } from '@/data/publicPresentation';
import type { PublicSettingsErrors } from '@/lib/publicSettingsValidation';
import { uploadSiteAsset, validateFile, IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/storage';
import { Area, Field, ImageBox } from './CmsPrimitives';

type Pwa = typeof DEFAULT_PWA;
async function iconFile(image: HTMLImageElement, size: number, maskable = false): Promise<File> {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image preparation unavailable.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
  const limit = size * (maskable ? 0.56 : 0.9);
  const ratio = Math.min(limit / image.naturalWidth, limit / image.naturalHeight);
  const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
  ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image preparation unavailable.')), 'image/png'));
  return new File([blob], `aoh-${maskable ? 'maskable-' : ''}${size}.png`, { type: 'image/png' });
}
const DISPLAYS = ['standalone', 'minimal-ui', 'browser', 'fullscreen'] as const;
const ORIENTATIONS = ['any', 'portrait', 'landscape'] as const;
export default function PwaSettingsEditor({ draft, patch, errors = {} }: { draft: WebsiteSettings; patch: (value: Partial<WebsiteSettings>) => void; errors?: PublicSettingsErrors }) {
  const pwa = draft.pwa || DEFAULT_PWA;
  const latest = useRef(pwa); latest.current = pwa;
  const change = (value: Partial<Pwa>) => patch({ pwa: { ...latest.current, ...value } });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const upload = async (file?: File) => {
    if (!file || busy) return;
    setError('');
    const invalid = validateFile(file, IMAGE_TYPES, MAX_IMAGE_BYTES);
    if (invalid) { setError(invalid); if (input.current) input.current.value = ''; return; }
    setBusy(true);
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unreadable image.')); image.src = objectUrl; });
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Image too large.');
      const generated: Partial<Pwa> = {};
      for (const [key, size, maskable] of [['icon192', 192, false], ['icon512', 512, false], ['maskable', 512, true], ['touchIcon', 180, false]] as const) {
        generated[key] = await uploadSiteAsset(`pwa/${key}`, await iconFile(image, size, maskable));
      }
      change(generated);
    } catch { setError('Icons could not be prepared or uploaded. Your previous icons are unchanged. Choose a readable image under 40 megapixels and check your connection and storage access before trying again.'); }
    finally { URL.revokeObjectURL(objectUrl); setBusy(false); if (input.current) input.current.value = ''; }
  };
  const manifestPreview = useMemo(() => JSON.stringify({ name: pwa.name, short_name: pwa.shortName, description: pwa.description, start_url: '/', scope: '/', display: pwa.display, orientation: pwa.orientation, background_color: pwa.backgroundColor, theme_color: pwa.themeColor }, null, 2), [pwa]);
  const downloadManifest = () => {
    const blob = new Blob([manifestPreview], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'manifest-preview.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const installable = pwa.icon192.trim() && pwa.icon512.trim() && pwa.name.trim() && pwa.shortName.trim();
  return <div className="space-y-5 rounded-2xl border bg-white p-5">
    <h2 className="text-lg font-semibold text-slate-900">PWA identity and launch screen — fully configurable</h2>
    <p className="text-sm text-slate-600">Every install field is controlled here. Upload once to prepare contained 192px, 512px, safe maskable and Apple icons. Colours, display mode and orientation apply to the published manifest and theme-color meta after you Publish changes. Browser-controlled install screens may retain an old icon until the app is reinstalled. HTTPS and the active service worker are required for the published manifest.</p>
    {error && <p id="pwa-upload-error" role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="flex flex-wrap items-center gap-4"><img src={pwa.icon192} alt="Current PWA icon" className="h-24 w-24 rounded-2xl border object-contain" /><button type="button" disabled={busy} onClick={() => input.current?.click()} className="min-h-11 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Preparing and uploading icons…' : 'Upload PWA icon'}</button><input ref={input} type="file" accept={IMAGE_TYPES.join(',')} aria-label="PWA icon image" aria-invalid={!!error} aria-describedby={error ? 'pwa-upload-error' : undefined} className="sr-only" onChange={event => void upload(event.target.files?.[0])} /><span className={`rounded-full px-3 py-1 text-xs font-semibold ${installable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{installable ? 'Install-ready' : 'Missing name or icons'}</span></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Application name" maxLength={120} error={errors['pwa.name']} value={pwa.name} onChange={name => change({ name })} /><Field label="Short name" maxLength={40} error={errors['pwa.shortName']} value={pwa.shortName} onChange={shortName => change({ shortName })} /></div>
    <Area label="Application description (up to 1000 characters)" maxLength={1000} error={errors['pwa.description']} value={pwa.description} onChange={description => change({ description })} />
    <Field label="Launch screen text" maxLength={120} error={errors['pwa.splashText']} value={pwa.splashText} onChange={splashText => change({ splashText })} />
    <ImageBox label="Launch screen image" error={errors['pwa.splashImage']} folder="pwa/splash" value={pwa.splashImage} onChange={splashImage => change({ splashImage })} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label htmlFor="pwa-theme" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Theme color</label><div className="flex items-center gap-2"><input id="pwa-theme" type="color" value={/^#[0-9a-fA-F]{6}$/.test(pwa.themeColor) ? pwa.themeColor : '#16803C'} onChange={e => change({ themeColor: e.target.value })} className="h-11 w-14 rounded-xl border" /><Field label="Theme color hex" error={errors['pwa.themeColor']} value={pwa.themeColor} onChange={themeColor => change({ themeColor })} /></div></div>
      <div><label htmlFor="pwa-bg" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Background color</label><div className="flex items-center gap-2"><input id="pwa-bg" type="color" value={/^#[0-9a-fA-F]{6}$/.test(pwa.backgroundColor) ? pwa.backgroundColor : '#FFFFFF'} onChange={e => change({ backgroundColor: e.target.value })} className="h-11 w-14 rounded-xl border" /><Field label="Background color hex" error={errors['pwa.backgroundColor']} value={pwa.backgroundColor} onChange={backgroundColor => change({ backgroundColor })} /></div></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label htmlFor="pwa-display" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Display mode</label><select id="pwa-display" value={pwa.display} onChange={e => change({ display: e.target.value as Pwa['display'] })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">{DISPLAYS.map(d => <option key={d} value={d}>{d}</option>)}</select><p className="mt-1 text-xs text-slate-500">Standalone hides browser chrome for an app feel.</p></div>
      <div><label htmlFor="pwa-orient" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Orientation</label><select id="pwa-orient" value={pwa.orientation} onChange={e => change({ orientation: e.target.value as Pwa['orientation'] })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">{ORIENTATIONS.map(o => <option key={o} value={o}>{o}</option>)}</select><p className="mt-1 text-xs text-slate-500">Any lets the device rotate freely.</p></div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">Live manifest preview</p><button type="button" onClick={downloadManifest} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">Download preview JSON</button></div>
      <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-emerald-100">{manifestPreview}</pre>
      <p className="mt-2 text-xs text-slate-500">Checklist: HTTPS served, 192px + 512px icons present, name + short name filled, service worker active. Install prompt and lock-screen presentation remain controlled by the browser/OS.</p>
    </div>
    <p className="text-xs text-slate-500">Launch branding is remembered on this device for the next startup. A first visit uses the bundled official logo until published settings load. The operating system creates its own native splash from the install icon.</p>
  </div>;
}
