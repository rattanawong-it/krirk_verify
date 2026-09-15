"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { loginAction } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { TranslatedFormMessage, useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { loginSchema } from "@/lib/validations/auth";

type FormInput = z.input<typeof loginSchema>;
type FormOutput = z.output<typeof loginSchema>;

type Props = {
  callbackUrl?: string;
  notice?: { variant: "success" | "warning"; text: string };
  lockNote: string;
};

export function LoginForm({ callbackUrl, notice, lockNote }: Props) {
  const t = useTranslations("auth.login");
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<{
    key: string;
    values?: Record<string, string | number>;
  } | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  function onSubmit(values: FormOutput) {
    setFormError(null);
    startTransition(async () => {
      const result = await loginAction(values, callbackUrl);
      if (!result || result.ok) return;
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof FormInput, { message });
      }
      if (result.error) {
        setFormError({ key: result.error, values: result.errorValues });
        form.resetField("password");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {notice && !formError && <FormAlert variant={notice.variant}>{notice.text}</FormAlert>}
        {formError && (
          <FormAlert variant="error">{translate(formError.key, formError.values)}</FormAlert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("email")}</FormLabel>
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
                    placeholder="hr@company.co.th"
                    className="h-11 pl-10"
                    {...field}
                  />
                </FormControl>
              </div>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-baseline justify-between">
                <FormLabel>{t("password")}</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {t("forgot")}
                </Link>
              </div>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="remember"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2.5">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  className="size-5"
                />
              </FormControl>
              <FormLabel className="text-[13px] font-normal text-text-2">{t("remember")}</FormLabel>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-11 w-full text-[15px] font-bold"
        >
          <Icon
            name={pending ? "loading" : "login"}
            size={18}
            className={pending ? "animate-spin" : ""}
          />
          {pending ? t("submitting") : t("submit")}
        </Button>

        <FormAlert variant="warning">{lockNote}</FormAlert>
      </form>
    </Form>
  );
}
