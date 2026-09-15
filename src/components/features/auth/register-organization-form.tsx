"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { registerOrganizationAction } from "@/actions/auth";
import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { PasswordStrength } from "@/components/forms/password-strength";
import { TranslatedFormMessage, useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { ORG_TYPES, registerOrganizationSchema } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";

type FormInput = z.input<typeof registerOrganizationSchema>;
type FormOutput = z.output<typeof registerOrganizationSchema>;
type FieldName = keyof FormInput;

// มือถือแบ่งเป็น 3 ขั้นตามดีไซน์ · เดสก์ท็อปแสดงทุกส่วนในหน้าเดียว
const STEPS: { key: "orgSection" | "contactSection" | "accountSection"; fields: FieldName[] }[] = [
  { key: "orgSection", fields: ["nameTh", "nameEn", "taxId", "orgType", "address"] },
  { key: "contactSection", fields: ["contactName", "position", "email", "phone"] },
  { key: "accountSection", fields: ["password", "confirmPassword", "consent"] },
];

function Required() {
  return <span className="text-destructive"> *</span>;
}

function WithIcon({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="relative">
      <Icon
        name={icon}
        size={18}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
      />
      {children}
    </div>
  );
}

export function RegisterOrganizationForm() {
  const t = useTranslations();
  const tr = useTranslations("auth.registerOrg");
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(registerOrganizationSchema),
    defaultValues: {
      nameTh: "",
      nameEn: "",
      taxId: "",
      address: "",
      contactName: "",
      position: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      consent: false,
    },
  });
  const password = useWatch({ control: form.control, name: "password" });

  async function goNext() {
    const current = STEPS[step];
    if (current && (await form.trigger(current.fields))) setStep((s) => Math.min(s + 1, 2));
  }

  function jumpToFirstError(fields: string[]) {
    const index = STEPS.findIndex((s) => s.fields.some((f) => fields.includes(f)));
    if (index >= 0) setStep(index);
  }

  function onSubmit(values: FormOutput) {
    setFormError(null);
    startTransition(async () => {
      const result = await registerOrganizationAction(values);
      if (!result || result.ok) return;
      const fieldErrors = result.fieldErrors ?? {};
      for (const [field, message] of Object.entries(fieldErrors)) {
        form.setError(field as FieldName, { message });
      }
      jumpToFirstError(Object.keys(fieldErrors));
      if (result.error) setFormError(result.error);
    });
  }

  const currentStep = STEPS[step] ?? STEPS[0]!;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, (errors) => jumpToFirstError(Object.keys(errors)))}
        noValidate
        className="flex flex-col gap-4"
      >
        <div className="md:hidden">
          <div className="mb-2 flex gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.key}
                className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {tr("stepOf", { step: step + 1, total: STEPS.length, name: tr(currentStep.key) })}
          </p>
        </div>

        {formError && <FormAlert variant="error">{translate(formError)}</FormAlert>}

        <section
          className={cn("rounded-2xl border bg-card p-5 sm:p-6", step !== 0 && "max-md:hidden")}
        >
          <h2 className="mb-4 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {tr("orgSection")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="nameTh"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    {tr("nameTh")}
                    <Required />
                  </FormLabel>
                  <WithIcon icon="building">
                    <FormControl>
                      <Input placeholder={tr("nameThPh")} className="h-11 pl-10" {...field} />
                    </FormControl>
                  </WithIcon>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nameEn"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{tr("nameEn")}</FormLabel>
                  <WithIcon icon="building">
                    <FormControl>
                      <Input
                        placeholder={tr("nameEnPh")}
                        className="h-11 pl-10"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </WithIcon>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {tr("taxId")}
                    <Required />
                  </FormLabel>
                  <WithIcon icon="idCard">
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        maxLength={13}
                        placeholder="0105548xxxxxx"
                        className="h-11 pl-10 font-mono"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                      />
                    </FormControl>
                  </WithIcon>
                  <TranslatedFormMessage hint={tr("taxIdHint")} />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="orgType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {tr("orgType")}
                    <Required />
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                        <SelectValue placeholder={tr("orgTypePh")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ORG_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {tr(`orgTypes.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    {tr("address")}
                    <Required />
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder={tr("addressPh")} {...field} />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section
          className={cn("rounded-2xl border bg-card p-5 sm:p-6", step !== 1 && "max-md:hidden")}
        >
          <h2 className="mb-4 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {tr("contactSection")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {tr("contactName")}
                    <Required />
                  </FormLabel>
                  <WithIcon icon="user">
                    <FormControl>
                      <Input
                        autoComplete="name"
                        placeholder={tr("contactNamePh")}
                        className="h-11 pl-10"
                        {...field}
                      />
                    </FormControl>
                  </WithIcon>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tr("position")}</FormLabel>
                  <WithIcon icon="userGroup">
                    <FormControl>
                      <Input
                        placeholder={tr("positionPh")}
                        className="h-11 pl-10"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </WithIcon>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {tr("email")}
                    <Required />
                  </FormLabel>
                  <WithIcon icon="mail">
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
                  </WithIcon>
                  <TranslatedFormMessage hint={tr("emailHint")} />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {tr("phone")}
                    <Required />
                  </FormLabel>
                  <WithIcon icon="phone">
                    <FormControl>
                      <Input
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="02-xxx-xxxx"
                        className="h-11 pl-10"
                        {...field}
                      />
                    </FormControl>
                  </WithIcon>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <div className={cn("flex flex-col gap-4", step !== 2 && "max-md:hidden")}>
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <h2 className="mb-4 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {tr("accountSection")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {tr("password")}
                      <Required />
                    </FormLabel>
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
                    <FormLabel>
                      {tr("confirmPassword")}
                      <Required />
                    </FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" {...field} />
                    </FormControl>
                    <TranslatedFormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <FormField
            control={form.control}
            name="consent"
            render={({ field }) => (
              <FormItem className="gap-2 rounded-2xl border border-gold/35 bg-gold-soft p-4">
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      className="mt-0.5 size-5 border-gold bg-card data-[state=checked]:border-primary"
                    />
                  </FormControl>
                  <FormLabel className="block text-[12.5px] leading-relaxed font-normal text-[#6b4e0a] dark:text-gold">
                    {tr("consent")}{" "}
                    <Link href="/privacy" className="font-bold text-primary hover:underline">
                      {t("common.privacyPolicy")}
                    </Link>{" "}
                    {t("common.and")}{" "}
                    <Link href="/terms" className="font-bold text-primary hover:underline">
                      {t("common.terms")}
                    </Link>
                    <Required />
                  </FormLabel>
                </div>
                <TranslatedFormMessage className="pl-8" />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="h-11 md:hidden"
            >
              <Icon name="arrowLeft" size={18} />
              {t("common.back")}
            </Button>
          )}
          {step < 2 && (
            <Button type="button" onClick={goNext} className="h-11 text-[15px] font-bold md:hidden">
              {t("common.next")}
              <Icon name="chevronRight" size={18} />
            </Button>
          )}
          <Button
            type="submit"
            disabled={pending}
            className={cn("h-11 px-6 text-[15px] font-bold", step !== 2 && "max-md:hidden")}
          >
            <Icon
              name={pending ? "loading" : "check"}
              size={18}
              className={pending ? "animate-spin" : ""}
            />
            {pending ? tr("submitting") : tr("submit")}
          </Button>
          <Button asChild variant="outline" className="h-11 max-md:hidden">
            <Link href="/">{t("common.cancel")}</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
