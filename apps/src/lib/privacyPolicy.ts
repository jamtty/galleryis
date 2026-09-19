/**
 * 개인정보처리방침, the page at `/privacy` that the footer links to.
 *
 * Every line describes what this system actually does, because a policy that
 * drifts from the code is a false statement the gallery has published. Where
 * each fact is decided:
 *
 * - 필수 항목: `canSubmit` in `components/ApplicationForm.tsx` (이름, 이메일,
 *   연락처, 작가명); the address and both attachments are optional.
 * - 서울 보관: Firestore and `galleryis-applications` both sit in
 *   asia-northeast3.
 * - 30일: the `_Default` log bucket's retention. It is a `global` bucket,
 *   which is the whole reason 국외 이전 is a section here; a Seoul log bucket
 *   and sink would shrink that section to nothing.
 * - 3D 전시장: images stay in IndexedDB (`apps/studio/src/lib/layoutStore.ts`),
 *   the assistant is voice-off (`VOICE_ENABLED`) and calls Vertex's `global`
 *   endpoint, and a feedback row carries only the exchange (`app/feedback.py`).
 * - 파기 on request: the desk's 삭제 removes the booking and its attachments
 *   together (`DELETE /api/admin/bookings/{id}`).
 *
 * Two facts are defaults of ours until the gallery sets its own. **2년** matches
 * the applications bucket's 730-day lifecycle rule (docs/MAINTENANCE.md), but
 * that rule only expires the files: nothing prunes the `bookings` documents
 * themselves (docs/HANDOFF_KO.md §5), so until something does, the desk's 삭제
 * is what keeps that line true. **대표 as 보호책임자** is the law's own default
 * for a business that names no one else. When either changes, change the line
 * and the effective date with it.
 *
 * Korean is binding, as with the rental terms; the English is a reading aid
 * and says so (`PRIVACY_POLICY_NOTE`). The contact lines repeat `visit.tel`,
 * `visit.email` and `aboutPage.director`, and a test holds them together.
 */

/** A string is a paragraph; a list of strings is a bulleted list. */
export type PolicyBlock = string | readonly string[];

export interface PolicySection {
  /** "1. 개인정보의 처리 목적": numbered here, not by the renderer. */
  heading: string;
  blocks: readonly PolicyBlock[];
}

export interface PrivacyPolicy {
  /** The line under the page's title. */
  effective: string;
  intro: string;
  sections: readonly PolicySection[];
}

const EFFECTIVE_KO = "2026년 9월 14일";
const EFFECTIVE_EN = "14 September 2026";

export const PRIVACY_POLICY_KO: PrivacyPolicy = {
  effective: `${EFFECTIVE_KO} 시행`,
  intro:
    "갤러리 이즈(이하 “갤러리”)는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 정하여 공개합니다. 이 방침은 대관 신청과 3D 전시장을 포함한 갤러리 누리집 전체에 적용됩니다.",
  sections: [
    {
      heading: "1. 개인정보의 처리 목적",
      blocks: [
        [
          "대관 신청의 접수와 심의, 결과 통보, 계약 안내를 위한 연락",
          "누리집의 안정적인 운영과 부정 이용 방지",
        ],
        "갤러리는 위 목적 외의 용도로 개인정보를 이용하지 않으며, 목적이 바뀌는 경우 미리 동의를 받겠습니다.",
      ],
    },
    {
      heading: "2. 처리하는 개인정보 항목",
      blocks: [
        [
          "대관 신청 필수 항목: 신청자 이름, 이메일, 연락처, 작가명",
          "대관 신청 선택 항목: 주소(우편번호, 기본주소, 상세주소), 약력소개 파일, 포트폴리오 이미지",
          "신청 내용: 전시명, 작품 수, 희망 전시일, 희망 전시장, 전시구분, 전시장르",
          "자동으로 생성되는 정보: 접속 IP 주소, 접속 일시, 브라우저 종류(서버 접속 기록)",
        ],
        "약력소개 파일과 포트폴리오에는 신청자가 직접 적은 학력, 경력 등이 담길 수 있습니다.",
        "필수 항목을 입력하지 않으시면 누리집으로는 신청하실 수 없습니다. 이 경우 전화로 문의하시면 갤러리가 대신 접수해 드립니다.",
      ],
    },
    {
      heading: "3. 개인정보의 처리 및 보유 기간",
      blocks: [
        ["대관 신청서와 첨부 파일: 신청일로부터 2년", "서버 접속 기록: 30일"],
        "보유 기간 중이라도 신청을 취소하시거나 삭제를 요청하시면 지체 없이 파기합니다.",
      ],
    },
    {
      heading: "4. 개인정보의 파기 절차 및 방법",
      blocks: [
        [
          "보유 기간이 지나거나 처리 목적을 이룬 개인정보는 지체 없이 파기합니다.",
          "전자 파일은 복구할 수 없는 방법으로 삭제하고, 종이에 출력한 서류는 분쇄하거나 소각합니다.",
        ],
      ],
    },
    {
      heading: "5. 개인정보의 제3자 제공",
      blocks: [
        "갤러리는 정보주체의 개인정보를 제3자에게 제공하지 않습니다. 다만 정보주체가 따로 동의한 경우나 법률에 특별한 규정이 있는 경우는 예외로 합니다.",
      ],
    },
    {
      heading: "6. 개인정보 처리의 위탁",
      blocks: [
        "갤러리는 누리집 운영을 위해 다음과 같이 개인정보 처리 업무를 위탁합니다.",
        [
          "수탁자: Google LLC(Google Cloud, Firebase)",
          "위탁 업무: 누리집과 서버 운영, 대관 신청서와 첨부 파일의 보관",
          "신청서 보관 위치: 대한민국 서울(Google Cloud 서울 리전)",
        ],
        "위탁 업무의 내용이나 수탁자가 바뀌면 이 방침을 통해 알리겠습니다.",
      ],
    },
    {
      heading: "7. 개인정보의 국외 이전",
      blocks: [
        "서버 접속 기록은 Google Cloud의 기록 보관 서비스에 저장되며, 이 서비스는 대한민국 밖의 데이터센터에 기록을 보관할 수 있습니다.",
        [
          "이전 항목: 접속 IP 주소, 접속 일시, 브라우저 종류",
          "이전받는 자: Google LLC(policies.google.com/privacy)",
          "이전 국가: 미국 등 Google 데이터센터가 있는 국가",
          "이전 시기와 방법: 누리집에 접속할 때마다 통신망을 통해 전송",
          "이용 목적과 보유 기간: 누리집 운영과 보안 점검, 30일",
        ],
        "접속 기록은 누리집을 운영하는 데 꼭 필요하므로, 이전을 원하지 않으시면 누리집 이용을 중단하셔야 합니다.",
      ],
    },
    {
      heading: "8. 3D 전시장에서 처리하는 정보",
      blocks: [
        [
          "3D 전시장에 올린 작품 이미지는 이용자의 브라우저 안에만 저장되며 갤러리 서버로 전송되지 않습니다.",
          "도우미에 입력한 문장은 작품 배치를 해석하기 위해 갤러리 서버와 Google의 인공지능 서비스(Vertex AI)로 전송되며, 대한민국 밖에서 처리될 수 있습니다. 갤러리는 이 문장을 저장하지 않으니, 도우미에는 개인정보를 입력하지 마십시오.",
          "도우미의 답변에 의견을 보내시면 주고받은 문장과 배치 결과가 저장됩니다. 이름이나 연락처는 받지 않습니다.",
        ],
      ],
    },
    {
      heading: "9. 쿠키 등 자동 수집 장치",
      blocks: [
        [
          "갤러리 누리집은 쿠키를 사용하지 않습니다.",
          "첫 화면의 알림 창을 하루 동안 열지 않도록 고르시면 그 선택만 브라우저에 저장되며, 어디로도 전송되지 않습니다.",
          "지도와 우편번호 검색(카카오), 글꼴(Google Fonts)은 해당 회사의 서버에서 불러오며, 이때 그 회사가 접속 정보를 받을 수 있습니다. 여기에는 각 회사의 개인정보처리방침이 적용됩니다.",
        ],
      ],
    },
    {
      heading: "10. 정보주체의 권리와 행사 방법",
      blocks: [
        [
          "정보주체는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.",
          "아래 연락처로 전화나 이메일을 주시면 본인임을 확인한 뒤 10일 이내에 조치하고 결과를 알려 드립니다.",
          "법정대리인이나 위임을 받은 분을 통해서도 요구하실 수 있습니다.",
          "다른 법령에서 보존하도록 정한 개인정보는 삭제를 요구할 수 없습니다.",
        ],
      ],
    },
    {
      heading: "11. 개인정보의 안전성 확보 조치",
      blocks: [
        [
          "대관 신청서와 첨부 파일은 공개되지 않는 저장소에 보관하며, 갤러리 관리자로 로그인해야만 열람할 수 있습니다.",
          "데이터베이스는 외부에서 직접 접근할 수 없도록 막아 두었습니다.",
          "누리집과 주고받는 모든 정보는 암호화(HTTPS)하여 전송합니다.",
          "관리자 화면에서 이루어진 조작은 기록으로 남깁니다.",
        ],
      ],
    },
    {
      heading: "12. 개인정보 보호책임자",
      blocks: [
        [
          "개인정보 보호책임자: 한수정(대표)",
          "전화: 02-736-6669 · 02-737-6669",
          "이메일: galleryis@naver.com",
        ],
        "개인정보 처리와 관련한 문의, 불만, 피해 구제는 위 연락처로 해 주십시오.",
      ],
    },
    {
      heading: "13. 권익침해 구제 방법",
      blocks: [
        "개인정보 침해에 대한 신고나 상담이 필요하시면 아래 기관에 문의하실 수 있습니다.",
        [
          "개인정보분쟁조정위원회: 1833-6972(www.kopico.go.kr)",
          "개인정보침해신고센터: 118(privacy.kisa.or.kr)",
          "대검찰청: 1301(www.spo.go.kr)",
          "경찰청: 182(ecrm.police.go.kr)",
        ],
      ],
    },
    {
      heading: "14. 개인정보처리방침의 변경",
      blocks: [
        `이 방침은 ${EFFECTIVE_KO}부터 시행합니다. 내용이 바뀌면 시행 7일 전부터 누리집에 알리겠습니다.`,
      ],
    },
  ],
};

export const PRIVACY_POLICY_EN: PrivacyPolicy = {
  effective: `Effective ${EFFECTIVE_EN}`,
  intro:
    "Gallery IS (“the gallery”) sets out and publishes this privacy policy under Article 30 of Korea’s Personal Information Protection Act, to protect the personal information of the people it deals with and to handle any concern about it promptly. It covers the whole of the gallery’s website, rental applications and the 3D gallery included.",
  sections: [
    {
      heading: "1. Why personal information is processed",
      blocks: [
        [
          "To receive and review rental applications, tell applicants the outcome, and contact them about a contract",
          "To keep the website running reliably and prevent its misuse",
        ],
        "The gallery uses personal information for nothing else, and will ask for consent before using it for a new purpose.",
      ],
    },
    {
      heading: "2. What is processed",
      blocks: [
        [
          "Rental application, required: the applicant’s name, email, phone number and artist name",
          "Rental application, optional: postal address (postcode, street address, detail), CV files, portfolio images",
          "About the application: exhibition title, number of works, preferred week, preferred hall, exhibition type, genre",
          "Generated automatically: IP address, time of access, browser type (server access records)",
        ],
        "CV files and portfolios may hold whatever the applicant writes in them, such as education and exhibition history.",
        "Without the required items the online form cannot be sent. Call the gallery instead, and it will take the application for you.",
      ],
    },
    {
      heading: "3. How long it is kept",
      blocks: [
        [
          "Rental applications and their attachments: 2 years from the date of application",
          "Server access records: 30 days",
        ],
        "If you withdraw an application or ask for it to be deleted, it is destroyed without delay, even within those periods.",
      ],
    },
    {
      heading: "4. How it is destroyed",
      blocks: [
        [
          "Personal information is destroyed without delay once its retention period ends or its purpose has been served.",
          "Electronic files are deleted so that they cannot be recovered, and printed documents are shredded or incinerated.",
        ],
      ],
    },
    {
      heading: "5. Disclosure to third parties",
      blocks: [
        "The gallery does not give personal information to third parties, except where you have separately consented or a law specifically requires it.",
      ],
    },
    {
      heading: "6. Service providers",
      blocks: [
        "The gallery entrusts the following work to others in order to run the website.",
        [
          "Provider: Google LLC (Google Cloud, Firebase)",
          "Work: running the website and its server, and storing rental applications and their attachments",
          "Where applications are stored: Seoul, Korea (Google Cloud’s Seoul region)",
        ],
        "If the work or the provider changes, this policy will say so.",
      ],
    },
    {
      heading: "7. Transfer outside Korea",
      blocks: [
        "Server access records are kept by Google Cloud’s logging service, which may store them in data centres outside Korea.",
        [
          "What: IP address, time of access, browser type",
          "To: Google LLC (policies.google.com/privacy)",
          "Where: countries where Google has data centres, the United States among them",
          "When and how: sent over the network each time the website is visited",
          "Why, and for how long: to run and secure the website, 30 days",
        ],
        "The website cannot run without these records, so declining the transfer means not using the website.",
      ],
    },
    {
      heading: "8. The 3D gallery",
      blocks: [
        [
          "Artwork images you add in the 3D gallery stay in your browser and are never sent to the gallery’s server.",
          "Sentences typed to the assistant are sent to the gallery’s server and to Google’s AI service (Vertex AI) to work out the arrangement, and may be processed outside Korea. The gallery does not store them, so please do not type personal information to the assistant.",
          "If you send feedback on one of its answers, that exchange and the arrangement it produced are stored. No name or contact details are asked for.",
        ],
      ],
    },
    {
      heading: "9. Cookies and similar technologies",
      blocks: [
        [
          "The gallery’s website does not use cookies.",
          "If you choose to keep the front page’s notice closed for a day, that choice alone is saved in your browser and is sent nowhere.",
          "The map and the postcode search (Kakao) and the typeface (Google Fonts) load from those companies’ servers, which receive connection details when they do. Their own privacy policies apply to that.",
        ],
      ],
    },
    {
      heading: "10. Your rights",
      blocks: [
        [
          "You may at any time ask to see, correct or delete your personal information, or to have its processing stopped.",
          "Call or email the contacts below. The gallery confirms that it is you, acts within 10 days and tells you the result.",
          "A legal representative or someone you have authorised may ask on your behalf.",
          "Information that another law requires the gallery to keep cannot be deleted on request.",
        ],
      ],
    },
    {
      heading: "11. Security",
      blocks: [
        [
          "Rental applications and their attachments are held in private storage and can be read only after signing in as a gallery administrator.",
          "The database cannot be reached directly from outside.",
          "Everything sent to and from the website is encrypted (HTTPS).",
          "Actions taken on the administration screens are recorded.",
        ],
      ],
    },
    {
      heading: "12. Privacy officer",
      blocks: [
        [
          "Privacy officer: Han Su-jeong, Director",
          "Tel: +82 2-736-6669 · +82 2-737-6669",
          "Email: galleryis@naver.com",
        ],
        "Questions, complaints and requests for redress about personal information go to the contacts above.",
      ],
    },
    {
      heading: "13. Where else to turn",
      blocks: [
        "To report or seek advice about a breach of personal information, you can also contact:",
        [
          "Personal Information Dispute Mediation Committee: 1833-6972 (www.kopico.go.kr)",
          "Personal Information Infringement Report Center: 118 (privacy.kisa.or.kr)",
          "Supreme Prosecutors’ Office: 1301 (www.spo.go.kr)",
          "Korean National Police Agency: 182 (ecrm.police.go.kr)",
        ],
      ],
    },
    {
      heading: "14. Changes to this policy",
      blocks: [
        `This policy takes effect on ${EFFECTIVE_EN}. Any change will be announced on the website at least 7 days before it takes effect.`,
      ],
    },
  ],
};

/** Shown above the English rendering, the rental terms' own stance. */
export const PRIVACY_POLICY_NOTE =
  "Reference translation. The Korean text is the binding one.";

/** The policy in the locale asked for, falling back to the Korean original. */
export function privacyPolicy(locale: string): PrivacyPolicy {
  return locale.startsWith("en") ? PRIVACY_POLICY_EN : PRIVACY_POLICY_KO;
}
