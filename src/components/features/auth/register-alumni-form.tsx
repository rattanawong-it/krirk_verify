"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { registerAlumniAction } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { TranslatedFormMessage, useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { registerAlumniSchema } from "@/lib/validations/auth";
import { formatCitizenId, isValidThaiCitizenId } from "@/lib/validations/identifiers";
import { cn } from "@/lib/utils";

type FormInput = z.input<typeof registerAlumniSchema>;
type FormOutput = z.output<typeof registerAlumniSchema>;

function LeadingIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <Icon
      name={name}
      size={18}
      className={cn("pointer-events-none absolute top-1/2 left-3 -translate-y-1/2", className)}
    />
  );
}

export function RegisterAlumniForm() {
  const t = useTranslations();
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(registerAlumniSchema),
    defaultValues: {
      studentCode: "",
      citizenId: "",
      email: "",
      password: "",
      confirmPassword: "",
      consent: false,
    },
  });
  const citizenId = useWatch({ control: form.control, name: "citizenId" });
  const citizenIdValid = isValidThaiCitizenId(citizenId ?? "");

  function onSubmit(values: FormOutput) {
    setFormError(null);
    startTransition(async () => {
      const result = await registerAlumniAction(values);
      if (!result || result.ok) return;
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof FormInput, { message });
      }
      if (result.error && !result.fieldErrors) setFormError(result.error);
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormAlert variant="success" icon="shieldCheck" className="mb-5">
          {t("auth.registerAlumni.verifyNote")}
        </FormAlert>
        {formError && (
          <FormAlert variant="error" className="mb-5">
            {translate(formError)}
          </FormAlert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="studentCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("auth.registerAlumni.studentCode")} <span className="text-destructive">*</span>
                </FormLabel>
                <div className="relative">
                  <LeadingIcon name="graduation" className="text-primary" />
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="6012345678"
                      className="h-11 pl-10 font-mono"
                      {...field}
                    />
                  </FormControl>
                </div>
                <TranslatedFormMessage hint={t("auth.registerAlumni.studentCodeHint")} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="citizenId"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>
                  {t("auth.registerAlumni.citizenId")} <span className="text-destructive">*</span>
                </FormLabel>
                <div className="relative">
                  <LeadingIcon name="idCard" className="text-primary" />
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={17}
                      placeholder="1-2345-67890-12-3"
                      className={cn(
                        "h-11 pr-10 pl-10 font-mono tracking-wide",
                        citizenIdValid && "border-primary",
                      )}
                      {...field}
                      onChange={(e) => field.onChange(formatCitizenId(e.target.value))}
                    />
                  </FormControl>
                  {citizenIdValid && (
                    <Icon
                      name="checkCircle"
                      size={18}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-primary"
                    />
                  )}
                </div>
                {citizenIdValid && !fieldState.error ? (
                  <p className="flex items-center gap-1.5 text-xs text-status-approved-tx">
                    <Icon name="checkCircle" size={14} />
                    {t("validation.citizenIdValid")}
                  </p>
                ) : (
                  <TranslatedFormMessage />
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>
                  {t("auth.registerAlumni.email")} <span className="text-destructive">*</span>
                </FormLabel>
                <div className="relative">
                  <LeadingIcon name="mail" className="text-muted-foreground" />
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
                <TranslatedFormMessage hint={t("auth.registerAlumni.emailHint")} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("auth.registerAlumni.password")} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <TranslatedFormMessage hint={t("auth.registerAlumni.passwordHint")} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("auth.registerAlumni.confirmPassword")}{" "}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem className="mt-5 mb-5 gap-2 rounded-xl border border-gold/35 bg-gold-soft p-3.5">
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    className="mt-0.5 size-5 border-gold bg-card data-[state=checked]:border-primary"
                  />
                </FormControl>
                <FormLabel className="block text-[12.5px] leading-relaxed font-normal text-[#6b4e0a] dark:text-gold">
                  {t("auth.registerAlumni.consent")}{" "}
                  <Link href="/privacy" className="font-bold text-primary hover:underline">
                    {t("common.privacyPolicy")}
                  </Link>{" "}
                  <span className="text-destructive">*</span>
                </FormLabel>
              </div>
              <TranslatedFormMessage className="pl-8" />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending} className="h-11 w-full text-[15px] font-bold">
          <Icon
            name={pending ? "loading" : "check"}
            size={18}
            className={pending ? "animate-spin" : ""}
          />
          {pending ? t("auth.registerAlumni.submitting") : t("auth.registerAlumni.submit")}
        </Button>
      </form>
    </Form>
  );
}
