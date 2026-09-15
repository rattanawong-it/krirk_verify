"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { updateProfileAction } from "@/actions/auth";
import { TranslatedFormMessage, useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { profileSchema } from "@/lib/validations/auth";

type FormInput = z.input<typeof profileSchema>;
type FormOutput = z.output<typeof profileSchema>;

export function ProfileForm({ defaultValues }: { defaultValues: FormInput }) {
  const t = useTranslations();
  const translate = useTranslateKey();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  function onSubmit(values: FormOutput) {
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (result.ok) {
        toast.success(translate(result.message ?? "account.profileSaved"));
        form.reset(values as FormInput);
        router.refresh();
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof FormInput, { message });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{t("account.name")}</FormLabel>
              <FormControl>
                <Input autoComplete="name" className="h-11" {...field} />
              </FormControl>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("account.position")}</FormLabel>
              <FormControl>
                <Input className="h-11" {...field} value={field.value ?? ""} />
              </FormControl>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("account.phone")}</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="h-11"
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
          name="locale"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{t("account.language")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="th">ไทย</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={pending || !form.formState.isDirty}
            className="h-11 px-6 font-bold"
          >
            <Icon
              name={pending ? "loading" : "check"}
              size={18}
              className={pending ? "animate-spin" : ""}
            />
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
