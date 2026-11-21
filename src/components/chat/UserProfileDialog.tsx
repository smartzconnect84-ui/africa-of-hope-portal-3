import { useState } from "react";
import { MessageCircle, Phone, MapPin, Mail, Calendar, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { formatLastSeen, getLastSeen } from "@/lib/presence";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function UserProfileDialog({
  user,
  online,
  onClose,
}: {
  user: User | null;
  online: boolean;
  onClose: () => void;
}) {
  const lastSeen = user ? getLastSeen(user.id) : null;
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-700" />
                <span className="truncate">{user.name}</span>
              </DialogTitle>
              <DialogDescription>Account details, live availability and contact information.</DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback className="bg-emerald-800/60 text-lg font-semibold text-amber-400">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-slate-900">{user.name}</p>
                <p className="break-all font-mono text-[11px] text-emerald-800">ID: {user.id}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {online ? (
                    <span className="font-semibold text-emerald-700">● Active now</span>
                  ) : (
                    <span>Last active {formatLastSeen(lastSeen)}</span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className="bg-emerald-50 text-emerald-800 ring-1 ring-emerald-700/15">{user.role}</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600">{user.status}</Badge>
                  {user.title && <Badge className="bg-amber-50 text-amber-800">{user.title}</Badge>}
                </div>
              </div>
            </div>
            <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <p className="break-all">{user.email}</p>
              {user.phone && <p><Phone className="inline h-3 w-3 mr-1 align-middle" />{user.phone}</p>}
              {user.address && <p><MapPin className="inline h-3 w-3 mr-1 align-middle" />{user.address}</p>}
              {user.bio && <p className="text-[13px]">{user.bio}</p>}
              {user.note && <p className="text-[13px]">{user.note}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button className="bg-emerald-700 hover:bg-emerald-800">
                <MessageCircle className="mr-1.5 h-4 w-4" /> Message
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
