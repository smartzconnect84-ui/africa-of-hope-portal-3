-- Backend-driven appearance settings (colors, fonts, icon style, alignment,
-- corner radius, light/dark mode) edited from Admin > System Settings >
-- Appearance and consumed as CSS variables across the authenticated portal.
alter table public.system_settings
  add column if not exists theme_settings jsonb not null default jsonb_build_object(
    'mode', 'light',
    'primaryColor', '#065f46',
    'accentColor', '#f59e0b',
    'fontFamily', 'sans',
    'iconStyle', 'outline',
    'contentAlignment', 'left',
    'borderRadius', 'rounded'
  );
