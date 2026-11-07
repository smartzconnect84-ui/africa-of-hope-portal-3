-- Pin trigger/helper function search paths to prevent search-path hijacking.
alter function public._blog_payments_touch() set search_path = pg_catalog, public;
alter function public._normalize_training_material_status() set search_path = pg_catalog, public;
alter function public._quizzes_touch() set search_path = pg_catalog, public;
alter function public._touch_academic_row() set search_path = pg_catalog, public;
alter function public.programs_sync_title_name() set search_path = pg_catalog, public;
