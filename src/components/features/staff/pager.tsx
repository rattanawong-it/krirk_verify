import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";

// แถบแบ่งหน้าแบบลิงก์ (ทำงานได้โดยไม่ต้องใช้ JavaScript) — ปุ่มสูง 44px บนมือถือ

type Href = { pathname: string; query: Record<string, string> };

export function buildHref(
  pathname: string,
  params: Record<string, string | undefined>,
  page: number,
): Href {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) if (value) query[key] = value;
  if (page > 1) query.page = String(page);
  return { pathname, query };
}

export function Pager({
  info,
  page,
  pageCount,
  hrefFor,
  previousLabel,
  nextLabel,
}: {
  info: string;
  page: number;
  pageCount: number;
  hrefFor: (page: number) => Href;
  previousLabel: string;
  nextLabel: string;
}) {
  const linkClass =
    "inline-flex h-11 items-center gap-1 rounded-lg border bg-card px-3 font-semibold hover:bg-muted md:h-8";
  return (
    <nav className="flex flex-col gap-2 border-t bg-surface px-4.5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">{info}</span>
      {pageCount > 1 && (
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={hrefFor(page - 1)} className={linkClass}>
              <Icon name="arrowLeft" size={14} />
              {previousLabel}
            </Link>
          )}
          {page < pageCount && (
            <Link href={hrefFor(page + 1)} className={linkClass}>
              {nextLabel}
              <Icon name="chevronRight" size={14} />
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
