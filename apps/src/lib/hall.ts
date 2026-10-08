import type { Hall } from "@galleryis/shared";

/**
 * 전시장 규모 한 줄 — 화면에 그릴 문장을 고릅니다.
 *
 * 한국어는 **관리자가 쓴 문장 그대로**입니다 (예: `181m² · 55평 (공유면적 포함) · 층고 280cm`).
 * 규모 칸에 덧붙인 말까지 살아납니다.
 *
 * 영문은 기계 번역 대신 **화면이 만드는 영문 문구**를 씁니다. 두 가지 까닭입니다 —
 * ① 번역기는 `평`·`층고`를 "pyeong", "Ceiling height 280cm" 처럼 옮겨 어색해지고,
 * ② 전시장 안내와 3D 둘러보기가 원래 쓰던 영문 문구가 이미 다듬어져 있습니다.
 * (그래서 문구 자체는 화면마다 다릅니다 — 이 함수는 그 문구를 인자로 받습니다)
 *
 * 규모 문장에서 숫자 3개(면적·평수·층고)를 읽어내지 못했을 때만 번역문(`spec_en`)으로,
 * 그것도 없으면 한국어 문장으로 되돌아갑니다.
 *
 * @param template 그 언어의 기본 문구 — `t("halls.specs", …)` 또는 `t("hallView.specs", …)`
 */
export function hallSpecText(
  hall: Pick<Hall, "area_m2" | "pyeong" | "ceiling_cm" | "spec_ko" | "spec_en">,
  language: string,
  template: string,
): string {
  if (!language.startsWith("en")) return hall.spec_ko || template;

  const known = hall.area_m2 > 0 && hall.pyeong > 0 && hall.ceiling_cm > 0;

  return known ? template : hall.spec_en || hall.spec_ko || template;
}
