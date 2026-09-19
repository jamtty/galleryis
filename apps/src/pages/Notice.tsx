import {
  ApiError,
  fetchJson,
  pick,
  type NoticeDetail,
} from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import PageHead from "../components/PageHead";
import { NoticeSkeleton } from "../components/Skeleton";
import { paragraphs } from "../lib/exhibition";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { GUTTER, LINK, META } from "../ui";

// One notice's page, what the legacy board opens for a row
// (bbs/board.php?bo_table=notice&wr_id=…), in the same order: the title,
// 작성일 · 조회, the body, the attached files.
//
// The body is plain text, not markdown: the origin stores a run of <br>-lined
// text and the sync keeps it as it is, so it renders exactly as the
// exhibition pages do: blank-line paragraphs, single breaks preserved.

export default function NoticePage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const query = useQuery({
    queryKey: ["notice", id],
    queryFn: () =>
      fetchJson<NoticeDetail>(`/api/notices/${encodeURIComponent(id)}`),
  });

  // A client-side navigation keeps the scroll position of the list it left,
  // which is not where a page starts.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  const notice = query.data;
  const title = notice ? pick(notice, "title", i18n.language) : null;
  useDocumentTitle(title, t("brand.name"));

  const back = (
    <Link
      to="/notices"
      className={`inline-flex min-h-11 items-center gap-2 text-sm ${LINK}`}
    >
      <span aria-hidden>←</span>
      {t("notice.back")}
    </Link>
  );

  if (query.isPending)
    return (
      <main>
        <PageHead title={t("notices")} kicker />
        <div className={`py-10 sm:py-14 ${GUTTER}`}>
          <div className="mx-auto max-w-4xl">
            {back}
            <div className="mt-8 sm:mt-10">
              <NoticeSkeleton />
            </div>
          </div>
        </div>
      </main>
    );

  if (query.isError) {
    const missing =
      query.error instanceof ApiError && query.error.status === 404;
    return (
      <main>
        <PageHead title={t("notices")} />
        <div className={`py-10 ${GUTTER}`}>
          <div className="mx-auto max-w-4xl">
            {back}
            <h2 className="mt-10 font-display text-title font-bold">
              {missing ? t("notice.notFound") : t("loadError")}
            </h2>
          </div>
        </div>
      </main>
    );
  }

  const loaded = notice!;
  const body = paragraphs(pick(loaded, "body", i18n.language));
  const attachments = loaded.attachments ?? [];
  const images = loaded.images ?? [];
  // The legacy form's 링크 #1 / #2, which only a post written on the desk fills.
  const links = loaded.links ?? [];
  const machine = i18n.language === "en" && loaded.translation === "machine";

  return (
    <main>
      <PageHead title={t("notices")} kicker />
      <div className={`py-10 sm:py-14 ${GUTTER}`}>
        <div className="mx-auto max-w-4xl">
          {back}
          <article className="animate-rise mt-8 sm:mt-10">
            {/* The legacy view's own head: the title on a 2px ink rule, with
              작성일 · 조회 in the same row on a hairline under it. */}
            <header className="border-t-2 border-ink">
              {loaded.pinned && (
                <p className="pt-4 text-sm font-bold text-ink-soft">
                  {t("pinnedBadge")}
                </p>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line py-5">
                <h1 className="font-display text-title font-bold break-keep">
                  {title}
                </h1>
                <p className={`${META} text-ink-soft`}>
                  {loaded.published_at && (
                    <>
                      {t("notice.date")} {loaded.published_at}
                    </>
                  )}
                  {loaded.published_at && loaded.views != null && " · "}
                  {loaded.views != null && (
                    <>
                      {t("notice.views")} {loaded.views}
                    </>
                  )}
                </p>
              </div>
            </header>

            {body.length > 0 && (
              <div className="mt-8 space-y-4 text-base leading-relaxed">
                {body.map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {images.length > 0 && (
              <div className="mt-10 space-y-4">
                {images.map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt={t("notice.photo", { title, n: index + 1 })}
                    loading="lazy"
                    className="h-auto w-full max-w-2xl"
                  />
                ))}
              </div>
            )}

            {links.length > 0 && (
              <section className="mt-12">
                <h3 className="border-b border-line pb-3 font-display text-lg font-bold">
                  {t("notice.links")}
                </h3>
                <ul>
                  {links.map((link) => (
                    <li key={link} className="border-b border-line">
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex min-h-11 items-center py-2 text-sm break-all ${LINK}`}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {attachments.length > 0 && (
              <section className="mt-12">
                <h3 className="border-b border-line pb-3 font-display text-lg font-bold">
                  {t("notice.attachments")}
                </h3>
                <ul>
                  {attachments.map((file) => (
                    <li key={file.url} className="border-b border-line">
                      <a
                        href={file.url}
                        className={`inline-flex min-h-11 items-center py-2 text-sm break-all ${LINK}`}
                      >
                        {file.filename}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {machine && (
              <p className="mt-10 text-sm text-ink-soft">
                {t("notice.machine")}
              </p>
            )}
          </article>
        </div>
      </div>
    </main>
  );
}
