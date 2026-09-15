"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { createStaffUserAction, updateUserAction, userAction } from "@/actions/admin";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserAction } from "@/lib/validations/admin";

// F-AUD-05 — กล่องสร้าง/แก้ไขผู้ใช้ และเมนูจัดการรายแถว

type Role = "ADMIN" | "REGISTRAR" | "EXTERNAL" | "ALUMNI";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
  position: string | null;
  phone: string | null;
  locked: boolean;
  isSelf: boolean;
};

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const translate = useTranslateKey();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{translate(error)}</p>}
    </div>
  );
}

function UserForm({ user, onDone }: { user: ManagedUser | null; onDone: () => void }) {
  const t = useTranslations("users");
  const tr = useTranslations("common.roles");
  const translate = useTranslateKey();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const staffRole = !user || user.role === "ADMIN" || user.role === "REGISTRAR";
  const prefix = user ? `edit-${user.id}` : "create";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setErrors({});
    startTransition(async () => {
      const result = user
        ? await updateUserAction({ ...data, userId: user.id, role: data.role ?? user.role })
        : await createStaffUserAction(data);
      if (result.ok) {
        toast.success(translate(result.message ?? "users.done.updated"));
        onDone();
        return;
      }
      setErrors(result.fieldErrors ?? {});
      if (result.error) toast.error(translate(result.error));
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3.5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field id={`${prefix}-name`} label={t("form.name")} error={errors.name}>
          <Input
            id={`${prefix}-name`}
            name="name"
            defaultValue={user?.name}
            required
            maxLength={200}
            className="h-11"
          />
        </Field>
      </div>
      {!user && (
        <div className="sm:col-span-2">
          <Field id={`${prefix}-email`} label={t("form.email")} error={errors.email}>
            <Input
              id={`${prefix}-email`}
              name="email"
              type="email"
              required
              autoComplete="off"
              className="h-11"
            />
          </Field>
        </div>
      )}
      <Field id={`${prefix}-role`} label={t("form.role")} error={errors.role}>
        {staffRole ? (
          <select
            id={`${prefix}-role`}
            name="role"
            defaultValue={user?.role ?? "REGISTRAR"}
            disabled={user?.isSelf}
            className="h-11 w-full rounded-md border bg-card px-3 text-sm"
          >
            <option value="REGISTRAR">{tr("REGISTRAR")}</option>
            <option value="ADMIN">{tr("ADMIN")}</option>
          </select>
        ) : (
          <p
            id={`${prefix}-role`}
            className="flex h-11 items-center text-[12.5px] text-muted-foreground"
          >
            {tr(user.role)} · {t("form.roleLocked")}
          </p>
        )}
      </Field>
      <Field id={`${prefix}-position`} label={t("form.position")} error={errors.position}>
        <Input
          id={`${prefix}-position`}
          name="position"
          defaultValue={user?.position ?? ""}
          maxLength={200}
          className="h-11"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field id={`${prefix}-phone`} label={t("form.phone")} error={errors.phone}>
          <Input
            id={`${prefix}-phone`}
            name="phone"
            type="tel"
            defaultValue={user?.phone ?? ""}
            className="h-11"
          />
        </Field>
      </div>
      <DialogFooter className="sm:col-span-2">
        <Button type="button" variant="outline" className="h-11" onClick={onDone}>
          {t("form.cancel")}
        </Button>
        <Button type="submit" disabled={pending} className="h-11 font-bold">
          <Icon
            name={pending ? "loading" : "check"}
            size={16}
            className={pending ? "animate-spin" : ""}
          />
          {pending ? t("form.saving") : user ? t("form.save") : t("form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateUserButton() {
  const t = useTranslations("users");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="h-11 font-semibold sm:h-[38px]">
          <Icon name="fileAdd" size={16} />
          {t("addUser")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("form.createTitle")}</DialogTitle>
          <DialogDescription>{t("form.createSub")}</DialogDescription>
        </DialogHeader>
        {open && <UserForm user={null} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function UserRowActions({ user }: { user: ManagedUser }) {
  const t = useTranslations("users");
  const translate = useTranslateKey();
  const [dialog, setDialog] = useState<"edit" | UserAction | null>(null);
  const [pending, startTransition] = useTransition();

  const actions: UserAction[] = [
    ...(user.status === "SUSPENDED"
      ? (["activate"] as const)
      : !user.isSelf
        ? (["suspend"] as const)
        : []),
    ...(user.locked ? (["unlock"] as const) : []),
    ...(user.status !== "SUSPENDED" ? (["sendReset"] as const) : []),
  ];

  function confirm(action: UserAction) {
    startTransition(async () => {
      const result = await userAction({ userId: user.id, action });
      if (result.ok) toast.success(translate(result.message ?? `users.done.${action}`));
      else toast.error(translate(result.error ?? "users.errors.notFound"));
      setDialog(null);
    });
  }

  const confirmAction = dialog && dialog !== "edit" ? dialog : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 sm:size-9"
            aria-label={t("menu.label", { name: user.name })}
          >
            <Icon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Icon name="doc" size={16} />
            {t("menu.edit")}
          </DropdownMenuItem>
          {actions.map((action) => (
            <DropdownMenuItem
              key={action}
              onSelect={() => setDialog(action)}
              className={
                action === "suspend"
                  ? "text-status-rejected focus:text-status-rejected-tx"
                  : undefined
              }
            >
              <Icon
                name={
                  { suspend: "lock", activate: "refresh", unlock: "key", sendReset: "mail" }[
                    action
                  ] as "lock"
                }
                size={16}
              />
              {t(`menu.${action}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "edit"} onOpenChange={(open) => setDialog(open ? "edit" : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("form.editTitle")}</DialogTitle>
            <DialogDescription>
              {user.email} · {t("form.editSub")}
            </DialogDescription>
          </DialogHeader>
          {dialog === "edit" && <UserForm user={user} onDone={() => setDialog(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          {confirmAction && (
            <>
              <DialogHeader>
                <DialogTitle>{t(`confirm.${confirmAction}Title`, { name: user.name })}</DialogTitle>
                <DialogDescription>{t(`confirm.${confirmAction}Body`)}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setDialog(null)}
                >
                  {t("confirm.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => confirm(confirmAction)}
                  className={
                    confirmAction === "suspend"
                      ? "h-11 bg-status-rejected font-bold text-white hover:bg-status-rejected/90"
                      : "h-11 font-bold"
                  }
                >
                  {pending && <Icon name="loading" size={16} className="animate-spin" />}
                  {t("confirm.submit")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
