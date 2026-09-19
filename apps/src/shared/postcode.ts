// 우편번호 검색, the same window the gallery's own application form opens.
//
// galleryis.com's form loads Daum's postcode widget and fills 우편번호 and
// 기본주소 from it, leaving only 상세주소 to type. Copying that is not
// imitation for its own sake: a contract goes to this address, every Korean
// applicant has used this exact window a hundred times, and an older applicant
// typing a full road address on a phone is where a posted contract goes to the
// wrong door.
//
// Keyless and free, like the Kakao map on the same page, the script is loaded
// once, on demand, when someone actually taps 주소 검색 rather than on every
// page view.
//
// In `packages/shared` rather than in `apps/web` because the address is the
// applicant's own to give and the shape of the answer — a postcode plus a base
// address the window fills, and the rest typed — belongs with the booking
// types it is stored under, not with one form's markup. The desk's 대리 신청
// asked the same question until 2026-08-28 and asks nothing now; it takes a
// memo and telephones. Nothing here runs at import time, so an app that never
// calls it carries none of it.

import type { PostcodeConstructor } from '@/types/daum'

const POSTCODE_API =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

/** What the widget hands back, of the many fields it offers. */
export interface KoreanAddress {
  /** 5-digit 우편번호. */
  postcode: string;
  /** The road address, or the lot address when a road one does not exist. */
  address: string;
}

/**
 * How long to wait for the widget before giving up on it.
 *
 * `onerror` covers a refused connection, but not a request that simply hangs,
 * a captive portal, a network that black-holes the CDN, and an applicant
 * staring at a spinner has no way to reach the fields underneath. Eight
 * seconds is longer than the script has ever taken and shorter than anyone
 * will wait before deciding the form is broken.
 */
const LOAD_TIMEOUT_MS = 8000;

//: The script tag, once. The *constructor* is deliberately not cached with it
//:, it is read off `window.daum` at each call, so a page that has reloaded the
//: global, or a test that has swapped it, is never answered from a stale
//: reference to the one this module happened to see first.
let script: Promise<void> | undefined;

function loadScript(): Promise<void> {
  script ??= new Promise<void>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = POSTCODE_API;
    tag.charset = "UTF-8";
    const timer = setTimeout(
      () => reject(new Error("Daum postcode API timed out")),
      LOAD_TIMEOUT_MS,
    );
    tag.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    tag.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Daum postcode API failed to load"));
    };
    document.head.append(tag);
  });
  // A failed load must not poison every later attempt: someone on a flaky
  // connection who taps again deserves a second try, not a promise that has
  // already rejected.
  script.catch(() => {
    script = undefined;
  });
  return script;
}

async function postcodeApi(): Promise<PostcodeConstructor> {
  const ready = window.daum?.Postcode;
  if (ready) return ready;
  await loadScript();
  const api = window.daum?.Postcode;
  if (!api) throw new Error("Daum postcode API loaded without Postcode");
  return api;
}

/**
 * Open the address window and resolve with what was picked, or null if the
 * person closed it without choosing.
 *
 * Rejects only when the script itself will not load, the caller then says so
 * and leaves the address fields typable, because an applicant must never be
 * unable to finish an application because a third-party script is down.
 */
export function findAddress(): Promise<KoreanAddress | null> {
  return postcodeApi().then(
    (Postcode) =>
      new Promise<KoreanAddress | null>((resolve) => {
        let picked = false;
        new Postcode({
          oncomplete: (data) => {
            picked = true;
            // Road address is what the post office wants; the lot address is
            // the fallback for the addresses that genuinely have no road one.
            // (`src/types/daum.d.ts` declares the widget's own shape.)
            const address = data.roadAddress || data.jibunAddress || "";
            resolve({ postcode: data.zonecode ?? "", address });
          },
          onclose: () => {
            // Fires after `oncomplete` too, so it only means "gave up" when
            // nothing was chosen.
            if (!picked) resolve(null);
          },
        }).open();
      }),
  );
}
