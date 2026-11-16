import { useState } from 'react';
import { Mail, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

/** Sending never changes approval status. The RPC verifies permission, identity and current status. */
export default function CongratulationsAction({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const approved = user.status === 'Active';
  if (!approved && user.status !== 'Pending Approval') return null;
  const subject = approved ? 'Congratulations — your AFRICA OF HOPE account is approved' : 'Congratulations on taking your first step with AFRICA OF HOPE';
  const body = `Hello ${user.name},\n\n${approved ? 'Congratulations! Your AFRICA OF HOPE account has been approved. Welcome to our community. Sign in to see your available services and next steps. Programme placement, fees and certificates remain subject to the requirements shown in your portal.' : 'Thank you for registering with AFRICA OF HOPE. Congratulations on taking the first step toward new opportunities. Your application has been received and is awaiting review. This message does not confirm admission or account approval.'}\n\nVisit ${window.location.origin}${window.location.pathname} and choose Login.\n\nAFRICA OF HOPE\nEmpowering People. Transforming Communities. Inspiring Hope.`;
  const queue = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('queue_account_congratulations', { p_user_id: user.id });
      if (error) throw new Error(/schema cache|does not exist|could not find/i.test(error.message) ? 'Automatic messaging is not deployed yet. Apply the account congratulations migration first, or use a ready-to-send link below.' : error.message);
      const status = (data as { status?: string } | null)?.status;
      if (status === 'sent') toast.info('The email provider previously accepted this message. No duplicate was queued. Check Email outbox for details.');
      else if (status === 'queued' || status === 'sending') toast.info('Message is in the email queue, not confirmed delivered. Duplicate requests do not send another copy.');
      else if (status === 'failed' || status === 'skipped') toast.warning('This message previously failed or expired. An administrator can review it in Email outbox; a duplicate was not sent.');
      else throw new Error('The server did not return a recognized email status. Check Email outbox before retrying.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not queue the message. Please retry.'); }
    finally { setBusy(false); }
  };
  const digits = user.phone?.replace(/\D/g, '') || '';
  return <>
    <Button size="sm" variant="outline" title={`Welcome message for ${user.name}`} onClick={() => setOpen(true)}><PartyPopper className="mr-1 h-3.5 w-3.5" /> Welcome</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{approved ? 'Approval congratulations' : 'Registration welcome'}</DialogTitle><DialogDescription>New registrations and first approvals are queued automatically after email confirmation once backend setup is deployed. Links below open a draft for you to review and send; they do not send automatically.</DialogDescription></DialogHeader>
        <p className="break-words text-sm font-semibold text-emerald-900">{user.name} · {user.status}</p>
        <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{body}</p>
        <Button onClick={queue} disabled={busy} className="bg-emerald-800 text-white hover:bg-emerald-900"><Mail className="mr-2 h-4 w-4" />{busy ? 'Queueing…' : 'Queue welcome email'}</Button>
        <p className="text-xs text-slate-500">Uses the confirmed login email, not an editable contact address. Duplicate queue requests do not send a second copy. Delivery requires the email worker.</p>
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-emerald-800">
          {user.email && <a className="inline-flex min-h-11 items-center underline" href={`mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>Open email draft</a>}
          {digits.length >= 10 && <a className="inline-flex min-h-11 items-center underline" href={`https://wa.me/${digits}?text=${encodeURIComponent(body)}`} target="_blank" rel="noopener noreferrer">Open WhatsApp draft</a>}
        </div>
        {digits.length >= 10 && <p className="text-xs text-slate-500">WhatsApp requires a phone number with country code. Confirm it before sending.</p>}
      </DialogContent>
    </Dialog>
  </>;
}
