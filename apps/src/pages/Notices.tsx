import { fetchJson, pick } from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import PageHead from "../components/PageHead";
import { RowsSkeleton } from "../components/Skeleton";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { SiteNoticeSummary } from "../shared/backend";
import { GUTTER, META } from "../ui";

// The notice board (공지사항), the legacy list page's shape under
// insaartcenter's centred page head: pinned posts first with a written 공지
// mark, then the rest newest first, title and date per row, a written 첨부
// mark where files hang off the post. Every row opens the notice's own page.

export default function NoticesPage() {
  const { t, i18n } = useTranslation();
  const notices = useQuery({
    queryKey: ["notices"],
    queryFn: () => fetchJson<SiteNoticeSummary[]>("/api/notices"),
  });
  useDocumentTitle(t("notices"), t("brand.name"));
  const items = notices.data ?? [];

  // A client-side navigation keeps the scroll position of the page it left,
  // which is not where a page starts.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <main>
      <PageHead title={t("notices")} />
      <div className={`min-h-[24rem] py-10 sm:py-14 ${GUTTER}`}>
        {notices.isPending && (
          <div className="mx-auto max-w-5xl border-t border-ink">
            <RowsSkeleton count={8} />
          </div>
        )}
        {notices.isError && (
          <p className="text-base text-accent-ink">{t("loadError")}</p>
        )}
        {notices.isSuccess &&
          (items.length === 0 ? (
            <p className="text-base text-ink-soft">{t("noNotices")}</p>
          ) : (
            <ul className="mx-auto max-w-5xl border-t border-ink">
              {items.map((notice) => (
                <li key={notice.id}>
                  <Link
                    to={`/notices/${notice.id}`}
                    className="group flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-line py-4"
                  >
                    {notice.pinned && (
                      <span className="shrink-0 text-sm font-bold">
                        {t("pinnedBadge")}
                      </span>
                    )}
                    <span className="flex-1 text-base leading-relaxed decoration-1 underline-offset-4 group-hover:underline">
                      {pick(notice, "title", i18n.language)}
                    </span>
                    {notice.file_count > 0 && (
                      <span className="shrink-0 text-sm text-ink-soft">
                        {t("notice.attached")}
                      </span>
                    )}
                    <span className={`shrink-0 ${META} text-ink-soft`}>
                      {notice.published_at}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </main>
  );
}
