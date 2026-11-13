import { useApp } from "@/context/AppContext";
import { usePresenceHeartbeat } from "@/lib/portalOps";

/**
 * Item 4 — keeps the signed-in user's online/away presence fresh for the whole
 * session, not only while the profile panel happens to be open. Mounted once in
 * the portal shell so other users see a live "online" state.
 */
export default function PresenceHeartbeat() {
  const { currentUser } = useApp();
  usePresenceHeartbeat(currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : null);
  return null;
}
