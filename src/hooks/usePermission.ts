import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from "../lib/permissions";
import { canonicalRole } from "../lib/roleDisplay";
import type { Role } from "../types";

export interface PermissionsApi {
  role: Role | null;
  isSuperAdmin: boolean;
  /** Everyone with an Active profile; false for a signed-out visitor. */
  isSignedIn: boolean;
  can: (key: PermissionKey) => boolean;
  canAny: (...keys: PermissionKey[]) => boolean;
  canAll: (...keys: PermissionKey[]) => boolean;
}

/**
 * Reads the caller's role and the live `role_permissions` matrix (falling
 * back to the DEFAULT_ROLE_PERMISSIONS seed before it loads). This only
 * hides UI; Postgres RLS via has_permission() is the real enforcement.
 */
export function usePermissions(): PermissionsApi {
  const { currentUser, state } = useApp();
  const role = currentUser?.role ?? null;
  const isSuperAdmin = role === "Super Admin";
  const isSignedIn = !!currentUser && currentUser.status === "Active";

  return useMemo(() => {
    const can = (key: PermissionKey): boolean => {
      if (!currentUser || currentUser.status !== "Active") return false;
      if (isSuperAdmin) return true;
      if (!role) return false;
      // "Instructor" is the display name for the stored "Teacher" grants row.
      const key0 = canonicalRole(role);
      const fromState = state.rolePermissions[key0] ?? state.rolePermissions[role];
      const grants =
        fromState ?? DEFAULT_ROLE_PERMISSIONS[key0 as Exclude<Role, "Super Admin">] ?? [];
      return grants.includes(key);
    };
    const canAny = (...keys: PermissionKey[]) => keys.some(can);
    const canAll = (...keys: PermissionKey[]) => keys.every(can);
    return { role, isSuperAdmin, isSignedIn, can, canAny, canAll };
  }, [currentUser, role, isSuperAdmin, isSignedIn, state.rolePermissions]);
}

/** Boolean shortcut for a single permission key. */
export function usePermission(key: PermissionKey): boolean {
  const { can } = usePermissions();
  return can(key);
}

/** Returns a stable `can(key)` function instead of a single boolean. */
export function useCan(): (key: PermissionKey) => boolean {
  const { can } = usePermissions();
  return can;
}
