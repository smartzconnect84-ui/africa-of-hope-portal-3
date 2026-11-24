-- Messaging is gated on `chat.use`, and the client reads the permission matrix
-- from these tables (src/data/liveData.ts) rather than from the code defaults.
-- The key was never seeded here, so `can("chat.use")` was false for every role
-- except Super Admin: the Messages module and the top-bar message buttons were
-- hidden for students, instructors and staff. Seed the key and grant it to every
-- role, matching DEFAULT_ROLE_PERMISSIONS in src/lib/permissions.ts.

insert into public.permissions (key, grp, label, description, sort) values
  ('chat.use', 'Comms', 'Use chat & messages', 'Open and use direct messages and group chat.', 193)
on conflict (key) do update set
  grp = excluded.grp, label = excluded.label, description = excluded.description, sort = excluded.sort;

-- Super Admin is implicit (has_permission() returns true for it), so every other
-- role gets an explicit row.
insert into public.role_permissions (role, permission)
select r.name, 'chat.use'
from public.roles r
where r.name <> 'Super Admin'
on conflict (role, permission) do nothing;
