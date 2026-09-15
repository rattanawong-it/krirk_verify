"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addInternalNoteAction, rejectRequestAction } from "@/actions/review";
import { useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { REJECT_REASONS, type RejectReason } from "@/lib/verification/reject-reasons";

// F-REG-05 / F-REG-06 — กล่องปฏิเสธคำขอและกล่องหมายเหตุภายใน

export type RejectDialogLabels = {
  trigger: string;
  title: string;
  sub: string;
  reason: string;
  detail: string;
  detailPh: string;
  notFoundHint: string;
  confirm: string;
  saving: string;
  cancel: string;
  reasons: Record<RejectReason, string>;
};

export function RejectDialog({ refNo, labels }: { refNo: string; labels: RejectDialogLabels }) {
  const translate = useTranslateKey();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<RejectReason | "">("");
  const [detail, setDetail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await rejectRequestAction({ refNo, reason, detail });
      if (result.ok) {
        toast.success(translate(result.message ?? "review.rejected"));
        setOpen(false);
        return;
      }
      if (result.fieldErrors) setErrors(result.fieldErrors);
      if (result.error) toast.error(translate(result.error));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 border-status-rejected/35 font-bold text-status-rejected hover:bg-status-rejected-bg hover:text-status-rejected-tx sm:h-[42px]"
        >
          <Icon name="xCircle" size={18} />
          {labels.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.sub}</DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-semibold">
            {labels.reason} <span className="text-destructive">*</span>
          </legend>
          <RadioGroup
            value={reason}
            onValueChange={(value) => setReason(value as RejectReason)}
            className="gap-2"
          >
            {REJECT_REASONS.map((code) => (
              <label
                key={code}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 text-[13px] has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft"
              >
                <RadioGroupItem value={code} />
                {labels.reasons[code]}
              </label>
            ))}
          </RadioGroup>
          {errors.reason && <p className="text-xs text-destructive">{translate(errors.reason)}</p>}
          <p className="text-[11.5px] text-muted-foreground">{labels.notFoundHint}</p>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="reject-detail">{labels.detail}</Label>
          <Textarea
            id="reject-detail"
            rows={3}
            maxLength={1000}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={labels.detailPh}
          />
          {errors.detail && <p className="text-xs text-destructive">{translate(errors.detail)}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            disabled={pending || !reason}
            onClick={submit}
            className="h-11 bg-status-rejected font-bold text-white hover:bg-status-rejected/90"
          >
            <Icon
              name={pending ? "loading" : "xCircle"}
              size={16}
              className={pending ? "animate-spin" : ""}
            />
            {pending ? labels.saving : labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type NoteDialogLabels = {
  trigger: string;
  title: string;
  sub: string;
  placeholder: string;
  save: string;
  saving: string;
  cancel: string;
};

export function NoteDialog({ refNo, labels }: { refNo: string; labels: NoteDialogLabels }) {
  const translate = useTranslateKey();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addInternalNoteAction({ refNo, body });
      if (result.ok) {
        toast.success(translate(result.message ?? "review.noteAdded"));
        setBody("");
        setOpen(false);
        return;
      }
      setError(result.fieldErrors?.body ?? result.error ?? null);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 font-semibold sm:h-[42px]">
          <Icon name="doc" size={18} />
          {labels.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.sub}</DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label={labels.title}
          rows={4}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={labels.placeholder}
        />
        {error && <p className="text-xs text-destructive">{translate(error)}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            disabled={pending || !body.trim()}
            onClick={submit}
            className="h-11 font-bold"
          >
            <Icon
              name={pending ? "loading" : "check"}
              size={16}
              className={pending ? "animate-spin" : ""}
            />
            {pending ? labels.saving : labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
