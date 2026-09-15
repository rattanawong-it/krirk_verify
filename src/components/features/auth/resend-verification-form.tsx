"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";
import { resendVerificationAction } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResendVerificationForm({ email: knownEmail }: { email?: string }) {
  const t = useTranslations();
  const translate = useTranslateKey();
  const [email, setEmail] = useState(knownEmail ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await resendVerificationAction({ email });
      if (result.ok) setMessage(result.message ?? null);
      else setError(result.fieldErrors?.email ?? result.error ?? "auth.login.errors.unknown");
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {!knownEmail && (
        <div className="space-y-2 text-left">
          <Label htmlFor="resend-email">{t("auth.login.email")}</Label>
          <Input
            id="resend-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            className="h-11"
          />
        </div>
      )}
      {message && <FormAlert variant="success">{translate(message)}</FormAlert>}
      {error && <FormAlert variant="error">{translate(error)}</FormAlert>}
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="h-11 w-full text-[14.5px] font-semibold"
      >
        <Icon
          name={pending ? "loading" : "mail"}
          size={18}
          className={pending ? "animate-spin" : ""}
        />
        {t("auth.checkEmail.resend")}
      </Button>
    </form>
  );
}
