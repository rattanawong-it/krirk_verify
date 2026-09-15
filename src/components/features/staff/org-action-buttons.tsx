"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeOrganizationStatusAction } from "@/actions/review";
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
import { Icon, type IconName } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrganizationAction } from "@/lib/services/organization.service";
import { cn } from "@/lib/utils";

// F-REG-08 — ปุ่มเปลี่ยนสถานะหน่วยงาน · ปฏิเสธ/ระงับต้องระบุเหตุผล · ทุกการกระทำต้องยืนยันก่อน

export type OrgActionLabels = {
  actions: Record<OrganizationAction, string>;
  titles: Record<OrganizationAction, string>;
  bodies: Record<OrganizationAction, string>;
  reason: string;
  reasonPh: string;
  submit: string;
  submitting: string;
  cancel: string;
};

const STYLE: Record<OrganizationAction, { icon: IconName; danger: boolean }> = {
  approve: { icon: "check", danger: false },
  restore: { icon: "refresh", danger: false },
  reject: { icon: "xCircle", danger: true },
  suspend: { icon: "lock", danger: true },
};

function OrgActionDialog({
  organizationId,
  action,
  labels,
}: {
  organizationId: string;
  action: OrganizationAction;
  labels: OrgActionLabels;
}) {
  const translate = useTranslateKey();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const needsReason = action === "reject" || action === "suspend";
  const { icon, danger } = STYLE[action];

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await changeOrganizationStatusAction({ organizationId, action, reason });
      if (result.ok) {
        toast.success(translate(result.message ?? `orgs.done.${action}`));
        setOpen(false);
        return;
      }
      if (result.fieldErrors?.reason) setError(result.fieldErrors.reason);
      if (result.error) toast.error(translate(result.error));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={danger ? "outline" : "default"}
          className={cn(
            "h-11 w-full font-bold sm:h-9",
            danger &&
              "border-status-rejected/35 text-status-rejected hover:bg-status-rejected-bg hover:text-status-rejected-tx",
          )}
        >
          <Icon name={icon} size={16} />
          {labels.actions[action]}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.titles[action]}</DialogTitle>
          <DialogDescription>{labels.bodies[action]}</DialogDescription>
        </DialogHeader>
        {needsReason && (
          <div className="space-y-1.5">
            <Label htmlFor={`org-reason-${organizationId}-${action}`}>
              {labels.reason} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`org-reason-${organizationId}-${action}`}
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={labels.reasonPh}
            />
            {error && <p className="text-xs text-destructive">{translate(error)}</p>}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || (needsReason && !reason.trim())}
            className={cn(
              "h-11 font-bold",
              danger && "bg-status-rejected text-white hover:bg-status-rejected/90",
            )}
          >
            <Icon
              name={pending ? "loading" : icon}
              size={16}
              className={pending ? "animate-spin" : ""}
            />
            {pending ? labels.submitting : labels.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrgActionButtons({
  organizationId,
  actions,
  labels,
}: {
  organizationId: string;
  actions: OrganizationAction[];
  labels: OrgActionLabels;
}) {
  return (
    <>
      {actions.map((action) => (
        <OrgActionDialog
          key={action}
          organizationId={organizationId}
          action={action}
          labels={labels}
        />
      ))}
    </>
  );
}
