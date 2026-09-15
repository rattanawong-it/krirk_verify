"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { resetPasswordAction } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { PasswordStrength } from "@/components/forms/password-strength";
import { TranslatedFormMessage, useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { resetPasswordSchema } from "@/lib/validations/auth";

type FormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.reset");
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });
  const password = useWatch({ control: form.control, name: "password" });

  function onSubmit(values: FormValues) {
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (!result || result.ok) return;
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof FormValues, { message });
      }
      if (result.error) setError(result.error);
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && (
          <FormAlert variant="error">
            {translate(error)}{" "}
            <Link href="/forgot-password" className="font-bold underline">
              {t("requestNew")}
            </Link>
          </FormAlert>
        )}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newPassword")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <PasswordStrength password={password} />
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("confirmPassword")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending} className="h-11 w-full text-[15px] font-bold">
          <Icon
            name={pending ? "loading" : "check"}
            size={18}
            className={pending ? "animate-spin" : ""}
          />
          {pending ? t("submitting") : t("submit")}
        </Button>
      </form>
    </Form>
  );
}
