import {
  fetchJson,
  SITE_NAME,
  SITE_STATUS_POLL_MS,
  type SiteStatus,
} from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LABEL, LINK } from "../ui";
import DefRow from "./DefRow";

// The curtain. When the gallery throws the emergency switch on the desk, this
// stands in front of the whole site, every route, not a banner over one.
//
// Three decisions worth stating, because each is the opposite of the obvious:
//
// 1. It fails OPEN. If the status call errors or has not answered yet, the site
//    draws itself. A curtain that appears because the network hiccuped would
//    take the gallery down more often than the gallery ever would, and the
//    failure it is guarding against is not one the browser can detect anyway.
// 2. It renders both languages at once rather than reading i18n. The screen it
//    replaces is the one carrying the language toggle, so a visitor here has no
//    way to switch, Korean first as the default locale, English beneath it.
//    That also keeps the curtain working if i18n itself never initialised.
// 3. The contact details are the point. Someone who came to see an exhibition
//    and found this needs a way to reach the gallery, so the phone numbers and
//    the address are the only things on the screen set larger than small.

const COPY = {
  ko: {
    label: "점검",
    heading: "잠시 서비스를\n멈추었습니다",
    body: "지금은 홈페이지를 열 수 없습니다. 조금 뒤에 다시 찾아와 주세요. 전시 안내와 대관 문의는 아래로 연락 주시면 도와드리겠습니다.",
  },
  en: {
    label: "Temporarily offline",
    heading: "The site is briefly closed",
    body: "The site is unavailable right now. Please try again a little later. For exhibitions and rentals, the gallery is reachable below.",
  },
};

const TEL = ["02-736-6669", "02-737-6669"];
const EMAIL = "galleryis@naver.com";

/** The address is the third way to reach a gallery, and the one that never fails. */
const ADDRESS = {
  // The gallery's own, from its 오시는길 page (galleryis.com/sub02_co3.php,
  // checked 2026-08-18): (우)03146 서울특별시 종로구 인사동길 52-1. An earlier
  // draft carried 인사동11길 13, a different alley, which the site body
  // never did; the curtain must not send someone to the wrong door.
  ko: "서울 종로구 인사동길 52-1",
  en: "52-1, Insadong-gil, Jongno-gu, Seoul",
};

export function ShutdownScreen() {
  return (
    <div className="min-h-dvh bg-ground text-ink">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
        <p className={`${LABEL} text-ink-soft`}>
          {COPY.ko.label} / {COPY.en.label}
        </p>
        <h1 className="mt-8 font-display text-headline font-bold whitespace-pre-line">
          {COPY.ko.heading}
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-ink-soft">
          {COPY.ko.body}
        </p>

        {/* The English half is a sibling, not a footnote, same structure, one
            step quieter, separated by a rule rather than by size. */}
        <h2 className="mt-10 border-t border-line pt-10 font-display text-title font-bold">
          {COPY.en.heading}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          {COPY.en.body}
        </p>

        <dl className="mt-12 border-t border-line">
          <DefRow label="전화 / Tel">
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {TEL.map((number) => (
                <a
                  key={number}
                  href={`tel:+82${number.replace(/^0/, "").replace(/-/g, "")}`}
                  className={`tabular-nums ${LINK}`}
                >
                  {number}
                </a>
              ))}
            </span>
          </DefRow>
          <DefRow label="이메일 / Email">
            <a href={`mailto:${EMAIL}`} className={LINK}>
              {EMAIL}
            </a>
          </DefRow>
          <DefRow label="주소 / Address">
            <span className="block">{ADDRESS.ko}</span>
            <span className="mt-1 block text-ink-soft">{ADDRESS.en}</span>
          </DefRow>
        </dl>

        <p className="mt-12 font-display text-headline font-bold text-ink/20 select-none">
          {SITE_NAME}
        </p>
      </div>
    </div>
  );
}

export default function ShutdownGate({ children }: { children: ReactNode }) {
  const status = useQuery({
    queryKey: ["site-status"],
    queryFn: () => fetchJson<SiteStatus>("/api/site-status"),
    refetchInterval: SITE_STATUS_POLL_MS,
    // An open tab left on the page overnight should agree with the desk by the
    // time someone looks at it again.
    refetchOnWindowFocus: true,
  });

  // `status.data?.shutdown` and not `!== false`: pending and errored both mean
  // "we do not know", and not knowing draws the site. See (1) above.
  if (status.data?.shutdown) return <ShutdownScreen />;
  return <>{children}</>;
}
