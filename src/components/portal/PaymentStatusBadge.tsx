import { Check, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PaymentSubmissionStatus } from "@/lib/payments";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<PaymentSubmissionStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-700",
};
const STATUS_ICON: Record<PaymentSubmissionStatus, typeof Clock> = { pending: Clock, confirmed: Check, rejected: X };

/** Status pill (icon + capitalised label) shared by StudentPayments and PaymentsReview. */
export default function PaymentStatusBadge({ status }: { status: PaymentSubmissionStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge className={cn("flex items-center gap-1 capitalize", STATUS_TONE[status])}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}
