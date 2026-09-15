"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { forgotPasswordAction } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { TranslatedFormMessage, useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema } from "@/lib/validations/auth";

type FormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: FormValues) {
    setSent(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      if (result.ok) {
        setSent(result.message ?? "auth.forgot.sent");
        return;
      }
      if (result.fieldErrors?.email) form.setError("email", { message: result.fieldErrors.email });
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {sent && <FormAlert variant="success">{translate(sent)}</FormAlert>}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("login.email")}</FormLabel>
              <div className="relative">
                <Icon
                  name="mail"
                  size={18}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                />
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    className="h-11 pl-10"
                    {...field}
                  />
                </FormControl>
              </div>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending} className="h-11 w-full text-[15px] font-bold">
          <Icon
            name={pending ? "loading" : "mail"}
            size={18}
            className={pending ? "animate-spin" : ""}
          />
          {pending ? t("forgot.submitting") : t("forgot.submit")}
        </Button>
        <FormAlert variant="info">{t("forgot.note")}</FormAlert>
      </form>
    </Form>
  );
}
