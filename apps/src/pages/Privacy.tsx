import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import PageHead from "../components/PageHead";
import { PRIVACY_POLICY_NOTE, privacyPolicy } from "../lib/privacyPolicy";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useSiteSettings } from "../store/useSiteSettings";
import { GUTTER } from "../ui";
import { renderBodyHtml } from "../utils/html";

// 개인정보처리방침, reached from the footer on every page.
//
// 관리자 [개인정보처리방침] 에서 쓴 본문(page_privacy_html)이 있으면 그것을 그리고,
// 없으면 원본 사이트의 기본 문구(lib/privacyPolicy.ts)를 그립니다.

export default function PrivacyPage() {
  const { t, i18n } = useTranslation();
  const settings = useSiteSettings();
  useDocumentTitle(t("privacyPage.title"), t("brand.name"));
  const policy = privacyPolicy(i18n.language);

  // 관리자가 쓴 방침 (서버가 script·style 등을 걸러 저장합니다)
  const managed = renderBodyHtml(settings.pagePrivacyHtml);

  // The link sits at the foot of every page, and a client-side navigation
  // keeps the scroll position of the page it left: without this the policy
  // would open on its own last sections.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  // 시행일은 제목 아래에 항상 보입니다 — 관리자가 본문을 쓴 뒤에도 사라지면 안 됩니다.
  // (기본 문구든 관리자가 쓴 본문이든 시행일 줄은 이 한 곳에서만 그립니다)

  return (
    <main>
      <PageHead title={t("privacyPage.title")} lede={policy.effective} />
      <article className={`py-10 sm:py-14 ${GUTTER}`}>
        <div className="mx-auto max-w-3xl text-base leading-relaxed break-keep">
          {managed ? (
            <div className="rich" dangerouslySetInnerHTML={{ __html: managed }} />
          ) : (
            <>
              {i18n.language.startsWith("en") && (
                <p className="mb-8 text-sm text-ink-soft">
                  {PRIVACY_POLICY_NOTE}
                </p>
              )}
              <p>{policy.intro}</p>
              {policy.sections.map((section) => (
                <section key={section.heading} className="mt-12">
                  <h2 className="border-b border-line pb-3 text-lg font-bold">
                    {section.heading}
                  </h2>
                  <div className="mt-4 space-y-3">
                    {section.blocks.map((block, index) =>
                      typeof block === "string" ? (
                        <p key={index}>{block}</p>
                      ) : (
                        <ul key={index} className="list-disc space-y-1.5 pl-5">
                          {block.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ),
                    )}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </article>
    </main>
  );
}
