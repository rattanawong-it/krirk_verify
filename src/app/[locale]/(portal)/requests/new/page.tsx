import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FormAlert } from "@/components/forms/form-alert";
import { NewRequestForm } from "@/components/features/verification/new-request-form";
import { Icon, type IconName } from "@/components/ui/icon";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { REQUESTER_ROLES } from "@/lib/auth/rbac";
import { getVerificationQuota } from "@/lib/services/rate-limit.service";
import { getOwnRecordSummary } from "@/lib/services/verification.service";

// F-VER-03 — ตามดีไซน์ project-ui/2 Requester Portal (ยื่นคำขอใหม่ · ฟอร์มขั้นตอนเดียว)

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/requests/new">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "verify.new" });
  return { title: t("title") };
}

export default async function NewRequestPage({ params }: PageProps<"/[locale]/requests/new">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const user = await requireRole(REQUESTER_ROLES);
  const alumni = user.role === "ALUMNI";

  const [t, quota, ownRecord] = await Promise.all([
    getTranslations("verify"),
    getVerificationQuota(user.id),
    alumni ? getOwnRecordSummary(user.id) : null,
  ]);

  const flow: { icon: IconName; tone: string; title: string; sub: string }[] = [
    {
      icon: "checkCircle",
      tone: "text-status-approved",
      title: t("new.flowAutoTitle"),
      sub: t("new.flowAutoSub"),
    },
    {
      icon: "clock",
      tone: "text-status-pending",
      title: t("new.flowReviewTitle"),
      sub: t("new.flowReviewSub"),
    },
    {
      icon: "mail",
      tone: "text-status-info",
      title: t("new.flowEmailTitle"),
      sub: t("new.flowEmailSub"),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("new.title")}</h1>
      <p className="mt-1 mb-4 text-[13px] text-muted-foreground sm:mb-5">
        {alumni ? t("new.ownSubtitle") : t("new.subtitle")}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {alumni && !ownRecord ? (
            <FormAlert variant="error">{t("errors.noLinkedRecord")}</FormAlert>
          ) : (
            <NewRequestForm ownRecord={ownRecord} quotaRemaining={quota.remaining} />
          )}
        </div>

        <aside className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:flex-none">
          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-3 text-[13.5px] font-bold">{t("new.whatHappens")}</h2>
            <ul className="flex flex-col gap-3">
              {flow.map((item) => (
                <li key={item.title} className="flex items-start gap-2.5">
                  <Icon name={item.icon} size={18} className={`mt-px shrink-0 ${item.tone}`} />
                  <div>
                    <p className="text-[12.5px] font-bold">{item.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                      {item.sub}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          {!alumni && (
            <section className="flex items-start gap-2.5 rounded-[15px] border border-status-approved/25 bg-status-approved-bg p-4 text-status-approved-tx">
              <Icon name="bulb" size={16} className="mt-0.5 shrink-0 text-status-approved" />
              <p className="text-xs leading-relaxed">{t("new.tip")}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
