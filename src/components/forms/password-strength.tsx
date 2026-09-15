"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { checkPasswordPolicy } from "@/lib/validations/password";
import { cn } from "@/lib/utils";

const RULES = ["tooShort", "needLetter", "needNumber"] as const;
const LEVELS = ["weak", "weak", "fair", "good", "strong"] as const;

export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("validation");
  const issues = checkPasswordPolicy(password);
  const passed = RULES.filter((rule) => !issues.includes(rule)).length;
  const score = password ? Math.min(4, passed + (password.length >= 12 ? 1 : 0)) : 0;
  const level = LEVELS[score] ?? "weak";
  const barColor =
    score <= 1 ? "bg-status-rejected" : score === 2 ? "bg-status-pending" : "bg-primary";

  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("h-1.5 flex-1 rounded-full", i <= score ? barColor : "bg-border")}
          />
        ))}
      </div>
      {password && (
        <p className="mt-1.5 text-xs font-semibold text-text-2">
          {t("strength.label")}: {t(`strength.${level}`)}
        </p>
      )}
      <ul className="mt-2.5 space-y-1.5">
        {RULES.map((rule) => {
          const ok = !!password && !issues.includes(rule);
          return (
            <li
              key={rule}
              className={cn(
                "flex items-center gap-2 text-xs",
                ok ? "text-status-approved-tx" : "text-muted-foreground",
              )}
            >
              <Icon name={ok ? "checkCircle" : "circle"} size={14} />
              {t(`password.${rule}`)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
