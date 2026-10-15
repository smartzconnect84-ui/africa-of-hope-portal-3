import { Fragment } from "react";
import { ShieldCheck, RotateCcw, Lock } from "lucide-react";
import { useApp } from "../context/AppContext";
import { usePermissions } from "../hooks/usePermission";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, PERMISSION_GROUPS, ROLES, type PermissionKey } from "../lib/permissions";
import type { Role } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EmptyState, Reveal, SectionHeader, panelClass } from "./Navigation";
import { cn } from "@/lib/utils";

const STAFF_AND_STUDENT_ROLES = ROLES.filter((r) => r !== "Super Admin") as Exclude<Role, "Super Admin">[];

/**
 * Super Admin's matrix screen. Rows are permissions grouped by `grp`,
 * columns are roles. The Super Admin column is always on and locked.
 * Each switch upserts/deletes a single `role_permissions` row via
 * AppContext (optimistic update + rollback + toast handled there).
 */
export default function RolesPermissions() {
  const { state, setRolePermission, resetRolePermissions } = useApp();
  const { isSuperAdmin } = usePermissions();

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={Lock}
        title="Super Admin only"
        hint="Only a Super Admin can view or edit the permission matrix."
      />
    );
  }

  const grants = (role: Exclude<Role, "Super Admin">): PermissionKey[] =>
    (state.rolePermissions[role] as PermissionKey[] | undefined) ?? DEFAULT_ROLE_PERMISSIONS[role] ?? [];

  const catalogue = state.permissionCatalogue.length > 0 ? state.permissionCatalogue : PERMISSIONS;

  const groups = PERMISSION_GROUPS.map((group) => ({
    group,
    items: catalogue.filter((p) => p.group === group).sort((a, b) => a.sort - b.sort),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Roles & Permissions"
        subtitle="Every switch takes effect immediately, enforced in the database as well as here."
      />

      <Reveal className={cn(panelClass, "overflow-hidden")}>
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <span>
            Super Admin always has every permission.{" "}
            <Badge variant="secondary" className="ml-1 bg-emerald-50 text-emerald-800">
              Always on
            </Badge>{" "}
            marks that locked column.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="border-b border-slate-100 bg-slate-50/70">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Permission
                </th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    Super Admin
                    <Lock className="h-3 w-3" />
                  </span>
                </th>
                {STAFF_AND_STUDENT_ROLES.map((role) => (
                  <th
                    key={role}
                    className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.group}>
                  <tr className="bg-slate-50/40">
                    <td
                      colSpan={2 + STAFF_AND_STUDENT_ROLES.length}
                      className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800"
                    >
                      {g.group}
                    </td>
                  </tr>
                  {g.items.map((perm) => (
                    <tr key={perm.key} className="border-b border-slate-50 last:border-0 hover:bg-emerald-50/30">
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-medium text-slate-800">{perm.label}</p>
                        <p className="text-[11px] text-slate-500">{perm.description}</p>
                        <code className="text-[10px] text-slate-400">{perm.key}</code>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Switch checked disabled aria-label={`Super Admin: ${perm.key} (always on)`} />
                      </td>
                      {STAFF_AND_STUDENT_ROLES.map((role) => {
                        const checked = grants(role).includes(perm.key as PermissionKey);
                        return (
                          <td key={role} className="px-3 py-2.5 text-center">
                            <Switch
                              checked={checked}
                              onCheckedChange={(on) => setRolePermission(role, perm.key as PermissionKey, on)}
                              aria-label={`${role}: ${perm.key}`}
                              data-component-id={`perm-${perm.key}-${role.toLowerCase().replace(/\s+/g, "-")}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal delay={0.05} className={cn(panelClass, "p-4")}>
        <SectionHeader title="Reset a role" subtitle="Discard every custom grant and restore the default matrix for one role." />
        <div className="mt-3 flex flex-wrap gap-2">
          {STAFF_AND_STUDENT_ROLES.map((role) => (
            <Button
              key={role}
              variant="outline"
              size="sm"
              onClick={() => resetRolePermissions(role)}
              data-component-id={`roles-reset-${role.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset {role}
            </Button>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
