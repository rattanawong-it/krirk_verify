"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { runRetentionAction, saveSettingsAction } from "@/actions/admin";
import { TranslatedFormMessage, useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  type AppSettings,
  type SettingsFormInput,
  settingsFormSchema,
} from "@/lib/validations/settings";

// F-AUD-06 — ฟอร์มตั้งค่าระบบ (ตาม project-ui/4 · ตั้งค่าระบบ)

type NumberField = Exclude<
  keyof SettingsFormInput,
  "autoApproveEnabled" | "monthlyReportEnabled" | "announcementTh" | "announcementEn"
>;

type Row =
  | { kind: "switch"; name: "autoApproveEnabled" | "monthlyReportEnabled" }
  | { kind: "locked"; label: "alwaysQueueNotFound" }
  | { kind: "number"; name: NumberField; unit?: "hours" | "times" | "years" | "days"; max: number }
  | { kind: "text"; name: "announcementTh" | "announcementEn" };

const GROUPS: {
  key: "verification" | "quotas" | "pdpa" | "reports";
  icon: IconName;
  rows: Row[];
}[] = [
  {
    key: "verification",
    icon: "shieldCheck",
    rows: [
      { kind: "switch", name: "autoApproveEnabled" },
      { kind: "locked", label: "alwaysQueueNotFound" },
      { kind: "number", name: "slaHours", unit: "hours", max: 720 },
    ],
  },
  {
    key: "quotas",
    icon: "lock",
    rows: [
      { kind: "number", name: "userPerHour", max: 1000 },
      { kind: "number", name: "ipPerHour", max: 10_000 },
      { kind: "number", name: "batchRowsPerDay", max: 100_000 },
      { kind: "number", name: "maxFailedLogins", unit: "times", max: 20 },
    ],
  },
  {
    key: "pdpa",
    icon: "history",
    rows: [
      { kind: "number", name: "retentionYears", unit: "years", max: 20 },
      { kind: "number", name: "auditRetentionYears", unit: "years", max: 30 },
      { kind: "number", name: "linkExpiresDays", unit: "days", max: 3650 },
      { kind: "text", name: "announcementTh" },
      { kind: "text", name: "announcementEn" },
    ],
  },
  {
    key: "reports",
    icon: "chart",
    rows: [{ kind: "switch", name: "monthlyReportEnabled" }],
  },
];

export function SettingsForm({
  defaults,
  lockMinutes,
}: {
  defaults: SettingsFormInput;
  lockMinutes: number;
}) {
  const t = useTranslations("settings");
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsFormInput, unknown, AppSettings>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: defaults,
  });

  function onSubmit() {
    // ส่งค่าดิบของฟอร์ม (หน่วยปี) — server validate และแปลงเป็นวันเอง
    const values = form.getValues();
    startTransition(async () => {
      const result = await saveSettingsAction(values);
      if (result.ok) {
        toast.success(translate(result.message ?? "settings.noChanges", result.messageValues));
        form.reset(values);
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof SettingsFormInput, { message });
      }
    });
  }

  const labelOf = (name: string) => t(`fields.${name}.label` as never);
  const subOf = (name: string) =>
    t(
      `fields.${name}.sub` as never,
      name === "maxFailedLogins" ? ({ minutes: lockMinutes } as never) : undefined,
    );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3.5">
        {GROUPS.map((group) => (
          <section key={group.key} className="overflow-hidden rounded-[15px] border bg-card">
            <header className="flex items-center gap-2.5 border-b px-4 py-3.5 sm:px-4.5">
              <Icon name={group.icon} size={20} className="shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-bold">{t(`groups.${group.key}.title`)}</h2>
                <p className="mt-px text-[11.5px] text-muted-foreground">
                  {t(`groups.${group.key}.sub`)}
                </p>
              </div>
            </header>
            <div className="px-4 pb-2 sm:px-4.5">
              {group.rows.map((row) => {
                const rowClass =
                  "flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4";
                if (row.kind === "locked") {
                  return (
                    <div key={row.label} className={rowClass}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold">{labelOf(row.label)}</p>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                          {subOf(row.label)}
                        </p>
                      </div>
                      <Switch checked disabled aria-label={labelOf(row.label)} />
                    </div>
                  );
                }
                return (
                  <FormField
                    key={row.name}
                    control={form.control}
                    name={row.name}
                    render={({ field }) => (
                      <FormItem className={rowClass}>
                        <div className="min-w-0 flex-1">
                          <FormLabel className="text-[13px] font-semibold">
                            {labelOf(row.name)}
                          </FormLabel>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                            {subOf(row.name)}
                          </p>
                          <TranslatedFormMessage className="mt-1" />
                        </div>
                        {row.kind === "switch" ? (
                          <FormControl>
                            <Switch
                              checked={field.value as boolean}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        ) : row.kind === "number" ? (
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={row.max}
                                step={1}
                                className="h-11 w-28 text-right font-mono sm:h-9"
                                name={field.name}
                                ref={field.ref}
                                onBlur={field.onBlur}
                                value={field.value as string | number}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            {row.unit && (
                              <span className="w-14 text-[11.5px] text-muted-foreground">
                                {t(`units.${row.unit}`)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <FormControl>
                            <Input
                              maxLength={300}
                              className="h-11 sm:h-9 sm:w-72"
                              name={field.name}
                              ref={field.ref}
                              onBlur={field.onBlur}
                              value={field.value as string}
                              onChange={field.onChange}
                            />
                          </FormControl>
                        )}
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>
          </section>
        ))}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button type="submit" disabled={pending} className="h-12 px-6 font-bold sm:h-11">
            <Icon
              name={pending ? "loading" : "check"}
              size={18}
              className={pending ? "animate-spin" : ""}
            />
            {pending ? t("saving") : t("save")}
          </Button>
          <span className="text-center text-[11.5px] text-muted-foreground sm:text-left">
            {t("saveNote")}
          </span>
        </div>
      </form>
    </Form>
  );
}

export function RunRetentionButton() {
  const t = useTranslations("settings.retention");
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className="mt-3 h-11 w-full font-semibold sm:h-9"
      onClick={() =>
        startTransition(async () => {
          const result = await runRetentionAction();
          if (result.ok)
            toast.success(
              translate(result.message ?? "settings.retention.ran", result.messageValues),
            );
        })
      }
    >
      <Icon
        name={pending ? "loading" : "refresh"}
        size={16}
        className={pending ? "animate-spin" : ""}
      />
      {pending ? t("running") : t("runNow")}
    </Button>
  );
}
