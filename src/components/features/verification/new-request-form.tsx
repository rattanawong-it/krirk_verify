"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { submitRequestAction } from "@/actions/verification";
import { FormAlert } from "@/components/forms/form-alert";
import { TranslatedFormMessage, useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { formatCitizenId, isValidThaiCitizenId } from "@/lib/validations/identifiers";
import {
  REQUEST_PURPOSES,
  SEARCH_TYPES,
  type SubmitRequestData,
  type SubmitRequestInput,
  submitOwnRequestSchema,
  submitRequestSchema,
} from "@/lib/validations/verification";
import { cn } from "@/lib/utils";

export type OwnRecord = {
  studentCode: string;
  maskedKey: string;
  searchType: "CITIZEN_ID" | "PASSPORT";
};

// F-VER-03 — ownRecord มีค่า = ศิษย์เก่า (ตรวจเฉพาะวุฒิตนเอง ไม่ต้องกรอกคีย์ค้นหา)
export function NewRequestForm({
  ownRecord,
  quotaRemaining,
}: {
  ownRecord: OwnRecord | null;
  quotaRemaining: number;
}) {
  const t = useTranslations();
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const own = ownRecord !== null;

  const form = useForm<SubmitRequestInput, unknown, SubmitRequestData>({
    resolver: zodResolver(
      (own ? submitOwnRequestSchema : submitRequestSchema) as unknown as typeof submitRequestSchema,
    ),
    defaultValues: {
      searchType: "CITIZEN_ID",
      searchValue: "",
      purpose: "" as SubmitRequestInput["purpose"],
      requesterReference: "",
      note: "",
      consent: false,
    },
  });
  const searchType = useWatch({ control: form.control, name: "searchType" });
  const searchValue = useWatch({ control: form.control, name: "searchValue" });
  const citizenIdValid = searchType === "CITIZEN_ID" && isValidThaiCitizenId(searchValue ?? "");

  function onSubmit(values: SubmitRequestData) {
    setFormError(null);
    startTransition(async () => {
      const result = await submitRequestAction(values);
      if (!result || result.ok) return;
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof SubmitRequestInput, { message });
      }
      if (result.error) setFormError(result.error);
    });
  }

  const sectionTitle = "mb-4 text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3.5">
        {formError && <FormAlert variant="error">{translate(formError)}</FormAlert>}

        <section className="rounded-[15px] border bg-card p-4 sm:p-5.5">
          <h2 className={sectionTitle}>{t("verify.new.keySection")}</h2>

          {ownRecord ? (
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft p-3.5">
              <Icon name="graduation" size={20} className="mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold">{t("verify.new.ownKeyTitle")}</p>
                <p className="mt-1 font-mono text-[13px]">
                  {ownRecord.studentCode} · {ownRecord.maskedKey}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  {t("verify.new.ownKeyNote")}
                </p>
              </div>
            </div>
          ) : (
            <>
              <FormField
                control={form.control}
                name="searchType"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("searchValue", "");
                          form.clearErrors("searchValue");
                        }}
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        {SEARCH_TYPES.map((type) => {
                          const active = field.value === type;
                          const citizen = type === "CITIZEN_ID";
                          return (
                            <label
                              key={type}
                              className={cn(
                                "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3.5 transition-colors",
                                active
                                  ? "border-primary bg-primary-soft"
                                  : "bg-card hover:bg-surface",
                              )}
                            >
                              <RadioGroupItem value={type} className="mt-0.5" />
                              <span className="min-w-0">
                                <span className="flex items-center gap-2 text-[13.5px] font-bold">
                                  <Icon
                                    name={citizen ? "idCard" : "passport"}
                                    size={18}
                                    className={active ? "text-primary" : "text-muted-foreground"}
                                  />
                                  {t(
                                    citizen
                                      ? "verify.new.citizenIdLabel"
                                      : "verify.new.passportLabel",
                                  )}
                                </span>
                                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                                  {t(
                                    citizen ? "verify.new.citizenIdSub" : "verify.new.passportSub",
                                  )}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="searchValue"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>
                      {t(
                        searchType === "CITIZEN_ID"
                          ? "verify.new.citizenIdField"
                          : "verify.new.passportField",
                      )}{" "}
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="relative">
                      <Icon
                        name={searchType === "CITIZEN_ID" ? "idCard" : "passport"}
                        size={20}
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-primary"
                      />
                      <FormControl>
                        <Input
                          autoComplete="off"
                          inputMode={searchType === "CITIZEN_ID" ? "numeric" : "text"}
                          maxLength={searchType === "CITIZEN_ID" ? 17 : 9}
                          placeholder={
                            searchType === "CITIZEN_ID" ? "1-2345-67890-12-3" : "AB1234567"
                          }
                          className={cn(
                            "h-12 pr-10 pl-11 font-mono text-base tracking-wide",
                            citizenIdValid && "border-primary",
                          )}
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              searchType === "CITIZEN_ID"
                                ? formatCitizenId(e.target.value)
                                : e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                            )
                          }
                        />
                      </FormControl>
                      {citizenIdValid && (
                        <Icon
                          name="checkCircle"
                          size={20}
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-primary"
                        />
                      )}
                    </div>
                    {citizenIdValid && !fieldState.error ? (
                      <p className="flex items-center gap-1.5 text-xs text-status-approved-tx">
                        <Icon name="checkCircle" size={14} />
                        {t("verify.new.checksumOk")}
                      </p>
                    ) : (
                      <TranslatedFormMessage />
                    )}
                  </FormItem>
                )}
              />

              <div className="mt-3.5 flex items-start gap-2.5 rounded-[10px] border bg-surface p-3">
                <Icon name="info" size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-[11.5px] leading-relaxed text-text-2">
                  {t("verify.new.keyNote")}
                </p>
              </div>
            </>
          )}
        </section>

        <section className="rounded-[15px] border bg-card p-4 sm:p-5.5">
          <h2 className={sectionTitle}>{t("verify.new.purposeSection")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("verify.new.purpose")} <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                        <SelectValue placeholder={t("verify.new.purposePh")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REQUEST_PURPOSES.map((purpose) => (
                        <SelectItem key={purpose} value={purpose}>
                          {t(`verify.purposes.${purpose}`)}
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
              name="requesterReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("verify.new.reference")}</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      placeholder={t("verify.new.referencePh")}
                      maxLength={50}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{t("verify.new.note")}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      maxLength={1000}
                      placeholder={t("verify.new.notePh")}
                      {...field}
                      value={field.value ?? ""}
                    />
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
            <FormItem className="gap-3 rounded-[15px] border border-gold/40 bg-gold-soft p-4">
              <div className="flex items-start gap-2.5">
                <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-gold" />
                <p className="text-[12.5px] leading-relaxed text-[#6b4e0a] dark:text-gold">
                  {t("verify.new.pdpaBody")}
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-[11px] border border-gold/40 bg-card p-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    className="mt-0.5 size-5 border-gold data-[state=checked]:border-primary"
                  />
                </FormControl>
                <FormLabel className="block text-[12.5px] leading-relaxed font-normal">
                  {t("verify.new.consent")}{" "}
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full px-6 text-[15px] font-bold sm:h-[46px] sm:w-auto"
          >
            <Icon
              name={pending ? "loading" : "shieldCheck"}
              size={18}
              className={pending ? "animate-spin" : ""}
            />
            {pending ? t("verify.new.submitting") : t("verify.new.submit")}
          </Button>
          <span className="text-center text-[11.5px] text-muted-foreground sm:text-left">
            {t("verify.new.quotaLeft", { remaining: quotaRemaining })}
          </span>
        </div>
      </form>
    </Form>
  );
}
