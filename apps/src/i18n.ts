import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources as studioResources } from "./studio/i18nResources";

// Korean is the default and English is a faithful sibling, not an afterthought
// (brand guidelines §4). Voice: warm, precise, unhurried, a gallerist walking
// a client through the space. No exclamation marks, no urgency, no feature-speak.
//
// Every fact here comes from the gallery's own material: the address, numbers
// and links are the legacy site's own. Opening hours are deliberately absent
// the legacy site does not publish them and inventing them would be a claim
// about a real business.

export const resources = {
  ko: {
    translation: {
      // 3D 둘러보기(스튜디오) 문구를 먼저 깔고, 겹치는 키는 아래 우리 문구가 이깁니다.
      ...studioResources.ko.translation,
      brand: {
        name: "갤러리 이즈",
        latin: "Gallery IS",
        place: "인사동, 서울",
        builtBy: "Designed by MoonAI",
      },
      hero: {
        // The call to action the gallery is actually here to collect. The
        // headline and lede that stood beside it went with the 관람안내
        // panel on 2026-08-28; 갤러리 이즈 opens on the gallery's own
        // introduction now (aboutPage.introHeading).
        apply: "대관 신청",
      },
      backToTop: "맨 위로",
      noUpcoming: "예정된 전시가 아직 없습니다",
      // The legacy site's tabs. Since Phase 6 they are routes, and since
      // 2026-08-28 there are five: 갤러리 소개 and 오시는 길 read down one
      // page, 갤러리 이즈, one door to the gallery itself rather than two.
      nav: {
        label: "주요 메뉴",
        exhibitions: "전시",
        about: "갤러리 이즈",
        halls: "전시장",
        rental: "대관",
        notices: "소식",
        // The phone-width bar folds the tabs behind one icon button; these
        // are its accessible names, closed and open. Not shown.
        menu: "메뉴",
        close: "닫기",
      },
      viewAll: "전체 보기",
      // The show's own page, section for section what the legacy view
      // (bbs/board.php?bo_table=gallery&wr_id=…) prints: 전시기간 · 전시장소
      // · 작가명 · 전시 개요 · 약력. The labels are the gallery's.
      exhibition: {
        back: "전시 목록으로",
        period: "전시기간",
        hall: "전시장소",
        artist: "작가명",
        overview: "전시 개요",
        bio: "작가 약력",
        photo: "{{title}} 사진 {{n}}",
        works: "전시 작품",
        detail: "자세히 보기",
        machine: "영문 소개는 기계 번역이며, 한국어가 원문입니다.",
        notFound: "전시를 찾을 수 없습니다",
      },
      // The picture popup on a show's page: one photograph at a time on
      // white, with arrows to either side.
      lightbox: {
        close: "닫기",
        prev: "이전 사진",
        next: "다음 사진",
      },
      // The gallery's announcement over the front page, the legacy site's own
      // popup window. The picture carries the words; these are the two
      // controls under it, in the legacy popup's own wording.
      popup: {
        close: "창닫기",
        // The ✕ in the title bar. Icon only, so this is its whole name.
        closeWindow: "닫기",
        hideForADay: "하루 동안 이 창을 다시 열지 않음",
      },
      notFound: {
        title: "페이지를 찾을 수 없습니다",
        home: "첫 화면으로",
      },
      // The /exhibitions page: the legacy site's two boards as tabs, plus the
      // archive the origin cannot show (it keeps no past board, so this is our
      // mirror's own accumulating record).
      exhibitionsPage: {
        tabsLabel: "전시 구분",
        current: "현재 전시",
        upcoming: "예정 전시",
        past: "지난 전시",
        noPast: "현재 등록된 지난 전시가 없습니다",
      },
      // The notice's own page, what the legacy board opens for a row
      // (bbs/board.php?bo_table=notice&wr_id=…): title, 작성일 · 조회, the
      // body, the attached files. The labels are the legacy view's own.
      notice: {
        back: "공지 목록으로",
        date: "작성일",
        views: "조회",
        attachments: "첨부파일",
        links: "링크",
        attached: "첨부",
        photo: "{{title}} 사진 {{n}}",
        notFound: "공지를 찾을 수 없습니다",
        machine: "영문 공지는 기계 번역이며, 한국어가 원문입니다.",
      },
      // The /halls page (전시장 안내): the legacy site's hall pages, photos
      // and floor plan and fees in one place per hall.
      hallsPage: {
        title: "전시장 안내",
        // The gallery's sheet: the plan beside a bird's-eye render.
        sheetAlt: "{{hall}} 도면과 조감도",
        photoAlt: "{{hall}} 사진 {{n}}",
        floor: "위치",
        size: "규모",
        floorplan: "도면 내려받기 (JPG)",
        // The name the file is saved under, so four downloads do not sit in
        // the folder as hall1.jpg … hall4.jpg.
        floorplanFile: "갤러리 이즈 {{hall}} 도면.jpg",
        walk3d: "3D로 둘러보기",
        apply: "대관 신청",
      },
      // 갤러리 이즈, the page 갤러리 소개 and 오시는 길 became on 2026-08-28.
      // Only the page's own name lives here: the sections keep their words —
      // and their ruled headings — under aboutPage and visit.
      galleryPage: {
        title: "갤러리 이즈",
      },
      // 개인정보처리방침: the page's name, which the footer's link reuses.
      // The policy itself is a dated document in lib/privacyPolicy.ts,
      // not UI copy.
      privacyPage: {
        title: "개인정보처리방침",
      },
      // 갤러리 소개. The introduction — introHeading and intro1~4 — is the
      // gallery's newly written one, supplied on 2026-08-28 and set here
      // word for word; 관람 안내 and 문의 below it are re-typeset from
      // galleryis.com's own 관람안내 and contact subpages (fetched once
      // through the polite fetcher on 2026-08-23), the gallery's text with
      // only spacing and punctuation normalised. The sub02.php sections on
      // 인수문고 and the building came out on 2026-08-28, told already by
      // the new introduction. The English is our draft throughout, and the
      // page says so under aboutPage.note.
      aboutPage: {
        title: "갤러리 소개",
        introHeading: "하나의 공간, 그리고 네 개의 전시장",
        intro1:
          "세계적인 건축가 이타미 준(庾東龍, 1937–2011, 재일동포 출신)이 설계한 갤러리 이즈는 인사동에 자리한 전시 공간으로, 건축과 예술이 조화를 이루는 공간적 특성을 지니고 있습니다.",
        intro2:
          "하나의 건축물 안에 네 개의 독립적인 전시실을 갖추고 있으며, 각 전시실을 통해 회화, 조각, 사진 등 다양한 장르의 전시와 문화예술을 선보입니다.",
        intro3:
          "‘갤러리 이즈’라는 이름의 뿌리에는 약 200년 동안 지식과 지혜의 유산을 이어온 ‘인수문고’가 있습니다. 인수문고의 정신을 현대적으로 계승하고자 ‘인수’의 이니셜에서 착안해 ‘이즈(IS)’라는 이름을 지었습니다.",
        intro4:
          "갤러리 이즈는 인수문고가 이어온 지식과 지혜의 정신, 이타미 준의 건축적 미감, 그리고 오늘날 예술과 문화가 지닌 가치를 하나의 공간에서 이어가고자 합니다.",
        exteriorAlt: "갤러리 이즈 건물 수채화 그림",
        visitHeading: "관람 안내",
        hoursLabel: "관람시간",
        hours: "월-일 10:00-19:00",
        hoursNote:
          "매주 화요일은 전시 교체로 인해 관람이 불가능합니다. (주차 불가)",
        feeLabel: "관람료",
        fee: "무료 입장",
        closedLabel: "휴관일",
        closed: "없음 (내부 사정에 의한 휴관 시, 웹사이트에 공지)",
        contactHeading: "문의",
        directorLabel: "대표",
        director: "한수정",
        note: "영문 소개는 초벌 번역이며, 한국어가 원문입니다.",
      },
      errorScreen: {
        title: "화면을 불러오지 못했습니다",
        body: "잠시 후 다시 시도해 주세요.",
        reload: "새로고침",
      },
      nowShowing: "현재 전시",
      nowShowingPrev: "이전 전시",
      nowShowingNext: "다음 전시",
      nowShowingGoto: "{{n}}번째 전시 보기",
      upcoming: "예정 전시",
      halls: {
        specs: "{{area}}m² · {{pyeong}}평 (공유면적 포함) · 층고 {{ceiling}}cm",
        disclaimer: "치수는 공개 도면을 바탕으로 한 근사치입니다.",
        hall1: "제1전시장 (1F)",
        hall2: "제2전시장 (2F)",
        hall3: "제3전시장 (3F)",
        hall4: "제4전시장 (B1)",
      },
      notices: "공지사항",
      pinnedBadge: "공지",
      noExhibitions: "등록된 전시가 없습니다",
      noNotices: "등록된 공지가 없습니다",
      loading: "불러오는 중…",
      loadError: "콘텐츠를 불러오지 못했습니다",
      visit: {
        title: "오시는 길",
        heading: "인사동길 52-1",
        address: "(우)03146 서울특별시 종로구 인사동길 52-1",
        addressLabel: "주소",
        telLabel: "전화",
        tel: "02-736-6669 · 02-737-6669",
        fax: "02-738-0781",
        emailLabel: "이메일",
        email: "galleryis@naver.com",
        followLabel: "소식",
        instagram: "인스타그램",
        blog: "네이버 블로그",
        // Verbatim from the gallery's own 오시는길 page
        // (galleryis.com/sub02_co3.php), lightly re-punctuated: the route, the
        // bus numbers and the car-free warning are the gallery's, not ours.
        subwayLabel: "지하철",
        subway:
          "3호선 안국역에서 내려 6번 출구로 나온 뒤, 인사동길로 진입해 50m 내려오시면 왼쪽에 갤러리 이즈가 있습니다.",
        busLabel: "버스",
        bus: "파랑버스 109 · 151 · 162 · 171 · 172 · 272 · 601 · 708, 초록버스 7025. 종로경찰서에서 내려 인사동길로 진입해 50m 내려오시면 왼쪽입니다.",
        noteLabel: "참고",
        carFree:
          "인사동길은 평일과 주말 모두 차없는거리가 시행되므로 가급적 대중교통을 이용해 주시기 바랍니다.",
        // The brand alone: these sit directly under the map, so 지도 in each
        // label says what the map above already said, and the three words it
        // costs are what pushed 구글 onto a second row on a phone.
        mapApps: {
          kakao: "카카오맵",
          naver: "네이버",
          google: "구글",
        },
      },
      footer: {
        // 관람시간 is the one visitor fact the legacy footer GIF never
        // carried. Days and clock, the compact form a footer wants and, since
        // 2026-08-28, the same form 갤러리 이즈's 관람 안내 uses
        // (aboutPage.hours); what the page adds there is the Tuesday
        // changeover and the admission line.
        hoursLabel: "관람시간",
        hours: "월-일 10:00-19:00",
        addressLabel: "주소",
        telLabel: "전화",
        faxLabel: "팩스",
        emailLabel: "이메일",
        // The legacy site's footer is a single GIF (galleryis.com/images/
        // copyright.gif); this is its copyright line, transcribed as it stands.
        copyright: "Copyright © 2008 GALLERY IS. All rights reserved.",
      },
      rental: {
        heading: "전시 기간 확인 및 신청",
        period: "전시기간",
        earlier: "이전",
        later: "다음",
        scrollHint: "표를 옆으로 밀면 네 전시장이 모두 보입니다 →",
        capped: "지금은 {{year}}년 12월 31일까지의 일정을 안내합니다.",
        applyLabel: "대관 신청",
        requiredNote: "* 표시는 필수 항목입니다",
        // The gallery's own form, section by section and in its own order:
        // 신청자 → 주소 → 전시일·전시장 → 전시구분 → 전시장르 → 첨부 → 메모.
        // The words are read off `bbs/write.php?bo_table=order`, not invented.
        applicantSection: "신청자 정보",
        name: "신청자",
        email: "이메일",
        phone: "연락처",
        postcode: "우편번호",
        addressSearch: "주소 검색",
        addressSearching: "주소 창을 여는 중…",
        addressUnavailable:
          "주소 검색을 열 수 없습니다. 아래 칸에 주소를 직접 적어 주세요.",
        address1: "기본주소",
        address2: "상세주소",
        exhibitionSection: "전시 정보",
        wishPeriod: "희망 전시일",
        hall: "희망 전시장",
        title: "전시명",
        artist: "작가명",
        artistHint: "그룹전은 대표 작가명을 적어 주세요.",
        kind: "전시구분",
        artistCount: "참여 작가 수",
        workCount: "작품 수",
        workCountHint: "20호 기준 30점 미만",
        genre: "전시장르",
        genrePick: "전시장르 선택",
        genreOther: "장르 직접 입력",
        filesSection: "작가 약력과 포트폴리오",
        bio: "작가 약력소개",
        bioHint:
          "hwp · txt · ppt · doc · xls · pdf · {{max}}개까지 · 개당\u00A0{{each}}MB",
        portfolio: "포트폴리오",
        portfolioHint:
          "jpg · png · gif · {{max}}장까지 · 장당\u00A0{{each}}MB · 전체\u00A0{{total}}MB",
        pickFiles: "파일 고르기",
        pickImages: "이미지 고르기",
        remove: "빼기",
        uploading: "올리는 중…",
        used: "{{count}}개 / {{max}}개 · {{size}} / {{total}}",
        fileTooBig: "{{name}}: {{max}}MB 이하만 첨부할 수 있습니다",
        fileWrongType: "{{name}}: 첨부할 수 없는 형식입니다",
        fileTooMany: "{{name}}: {{max}}개까지만 첨부할 수 있습니다",
        fileTotalFull: "{{name}}: 전체 용량 {{total}}MB를 넘습니다",
        fileFailed: "{{name}}: 올리지 못했습니다. 다시 시도해 주세요.",
        required: "필수",
        termsOpen: "대관 유의사항 전문 보기",
        agree:
          "위 대관 유의사항을 확인했으며, 입력한 정보가 대관 심의 목적으로만 사용되는 데 동의합니다.",
        submit: "신청서 보내기",
        submitting: "보내는 중…",
        cancel: "취소",
        taken:
          "방금 다른 분이 같은 기간을 신청했습니다. 표를 다시 불러왔습니다.",
        failed: "신청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
        received:
          "{{what}} 신청이 접수되었습니다. 접수일로부터 3일 이내에 심의 결과를 개별 통보해 드립니다.",
        privacy:
          "입력하신 정보는 대관 심의 외의 다른 목적으로 사용되지 않습니다. 문의 02-736-6669 · 02-737-6669",
        status: {
          available: "신청가능",
          pending: "심사중",
          approved: "대관완료",
          // A week taken on the legacy galleryis.com order board reads as
          // 대관완료 too. The wire keeps the two apart — the desk has to know
          // which weeks it can act on — but a visitor is being told one thing,
          // "this week is gone", and which system it went through is ours to
          // know, not theirs to decode.
          reserved: "대관완료",
          // An application still waiting on the legacy board, the same way.
          reserved_pending: "심사중",
        },
        stepTitles: {
          unit: "전시 기간",
          review: "심의",
          contract: "계약",
          install: "반입·반출",
        },
        steps: {
          unit: "전시기간은 매주 수요일부터 다음 주 화요일까지 7일이 기본 단위입니다.",
          review:
            "접수일로부터 3일 이내에 자체 심의를 거쳐 승인 여부를 개별 통보합니다.",
          contract:
            "승인 후 7일 이내 계약을 체결하고 대관료의 30%를 계약금으로 납부합니다. 잔금은 시작일 7일 전까지 납부합니다.",
          install:
            "작품 반입은 화요일 오후 2시~7시, 반출은 종료일(화) 오후 1시까지 완료해야 합니다.",
        },
        // Tier names and month sets are the gallery's own (2026-08-12
        // feedback); the object keys are the frozen wire names, not the truth.
        pricing: {
          heading: "대관료",
          hall: "전시장",
          perWeek: "주 단위 · VAT 포함",
          seasons: { peak: "평수기", low: "비수기", high: "성수기" },
          months: { peak: "3~6·9·12월", low: "1·2·7·8월", high: "10·11월" },
        },
      },
    },
  },
  en: {
    translation: {
      // 스튜디오 문구 — 우리 문구가 이깁니다.
      ...studioResources.en.translation,
      brand: {
        name: "Gallery IS",
        latin: "갤러리 이즈",
        place: "Insadong, Seoul",
        builtBy: "Designed by MoonAI",
      },
      hero: {
        apply: "Apply to rent",
      },
      backToTop: "Back to top",
      noUpcoming: "No upcoming exhibitions yet",
      nav: {
        label: "Main menu",
        exhibitions: "Exhibitions",
        about: "Gallery IS",
        halls: "Halls",
        rental: "Rental",
        notices: "News",
        menu: "Menu",
        close: "Close",
      },
      viewAll: "View all",
      exhibition: {
        back: "All exhibitions",
        period: "Dates",
        hall: "Hall",
        artist: "Artist",
        overview: "About the exhibition",
        bio: "Biography",
        photo: "{{title}}, photo {{n}}",
        works: "Selected works",
        detail: "Read more",
        machine:
          "The English text is machine-translated; the Korean is the original.",
        notFound: "This exhibition could not be found",
      },
      lightbox: {
        close: "Close",
        prev: "Previous photo",
        next: "Next photo",
      },
      popup: {
        close: "Close",
        closeWindow: "Close window",
        hideForADay: "Don't show this again for a day",
      },
      notFound: {
        title: "Page not found",
        home: "Back to the front page",
      },
      exhibitionsPage: {
        tabsLabel: "Exhibition lists",
        current: "Now showing",
        upcoming: "Upcoming",
        past: "Past",
        noPast: "No past exhibitions are registered yet",
      },
      notice: {
        back: "All notices",
        date: "Posted",
        views: "Views",
        attachments: "Attached files",
        links: "Links",
        attached: "File",
        photo: "{{title}}, photo {{n}}",
        notFound: "This notice could not be found",
        machine:
          "The English text is machine-translated; the Korean is the original.",
      },
      hallsPage: {
        title: "The four halls",
        sheetAlt: "{{hall}}, plan and bird's-eye view",
        photoAlt: "{{hall}}, photo {{n}}",
        floor: "Floor",
        size: "Size",
        floorplan: "Floor plan (JPG)",
        floorplanFile: "Gallery IS {{hall}} floor plan.jpg",
        walk3d: "Walk it in 3D",
        apply: "Apply to rent",
      },
      galleryPage: {
        title: "Gallery IS",
      },
      privacyPage: {
        title: "Privacy Policy",
      },
      aboutPage: {
        title: "About Gallery IS",
        introHeading: "One space, four exhibition halls",
        intro1:
          "Designed by the world-renowned architect Itami Jun (庾東龍, 1937–2011, of Korean descent, born in Japan), Gallery IS is an exhibition space in Insadong, and its character comes from the meeting of architecture and art.",
        intro2:
          "One building holds four independent exhibition halls. Through them the gallery presents shows across many genres, from painting and sculpture to photography, and the culture around them.",
        intro3:
          "The name Gallery IS is rooted in the Insu Mungo, a clan library that carried a legacy of knowledge and wisdom for some two hundred years. To continue its spirit in a contemporary form, the gallery took the initials of 'Insu' and named itself 'IS'.",
        intro4:
          "In one space, Gallery IS means to carry on the knowledge and wisdom the Insu Mungo passed down, Itami Jun's architectural sensibility, and the value art and culture hold today.",
        exteriorAlt: "A watercolour of the Gallery IS building",
        visitHeading: "Visitor information",
        hoursLabel: "Hours",
        hours: "Mon-Sun 10:00-19:00",
        hoursNote:
          "On Tuesdays the halls close while shows change over. (No parking)",
        feeLabel: "Admission",
        fee: "Free",
        closedLabel: "Closed",
        closed:
          "No regular closing days. Closures for internal reasons are announced on the website.",
        contactHeading: "Enquiries",
        directorLabel: "Director",
        director: "Han Su-jeong",
        note: "The English text is a draft translation; the Korean is the original.",
      },
      errorScreen: {
        title: "This screen didn't load",
        body: "Please try again in a moment.",
        reload: "Reload",
      },
      nowShowing: "Now Showing",
      nowShowingPrev: "Previous show",
      nowShowingNext: "Next show",
      nowShowingGoto: "Show {{n}}",
      upcoming: "Upcoming",
      halls: {
        specs:
          "{{area}}m² · {{pyeong}} pyeong (incl. shared area) · {{ceiling}}cm ceiling",
        disclaimer:
          "Dimensions are approximate, from the published floor plans.",
        hall1: "Hall 1 (1F)",
        hall2: "Hall 2 (2F)",
        hall3: "Hall 3 (3F)",
        hall4: "Hall 4 (B1)",
      },
      notices: "Notices",
      pinnedBadge: "Pinned",
      noExhibitions: "No exhibitions yet",
      noNotices: "No notices yet",
      loading: "Loading…",
      loadError: "Failed to load content",
      visit: {
        title: "Visit",
        heading: "52-1 Insadong-gil",
        address: "52-1 Insadong-gil, Jongno-gu, Seoul 03146, Korea",
        addressLabel: "Address",
        telLabel: "Tel",
        tel: "+82 2-736-6669 · +82 2-737-6669",
        fax: "+82 2-738-0781",
        emailLabel: "Email",
        email: "galleryis@naver.com",
        followLabel: "Follow",
        instagram: "Instagram",
        blog: "Naver blog",
        subwayLabel: "Subway",
        subway:
          "Take Line 3 to Anguk Station and leave by Exit 6. Turn into Insadong-gil and walk 50m down; Gallery IS is on your left.",
        busLabel: "Bus",
        bus: "Blue 109 · 151 · 162 · 171 · 172 · 272 · 601 · 708, green 7025. Get off at Jongno Police Station, turn into Insadong-gil and walk 50m down; it is on your left.",
        noteLabel: "Note",
        carFree:
          "Insadong-gil is pedestrianised on weekdays and weekends alike, so public transport is the way in.",
        mapApps: {
          kakao: "Kakao",
          naver: "Naver",
          google: "Google",
        },
      },
      footer: {
        hoursLabel: "Hours",
        hours: "Mon-Sun 10:00-19:00",
        addressLabel: "Address",
        telLabel: "Tel",
        faxLabel: "Fax",
        emailLabel: "Email",
        copyright: "Copyright © 2008 GALLERY IS. All rights reserved.",
      },
      rental: {
        heading: "Check a week and apply",
        period: "Period",
        earlier: "Earlier",
        later: "Later",
        scrollHint: "Slide the grid sideways for all four halls →",
        capped: "Dates are shown through 31 December {{year}}.",
        applyLabel: "Application",
        requiredNote: "* marks a required field",
        applicantSection: "Applicant",
        name: "Applicant",
        email: "Email",
        phone: "Phone",
        postcode: "Postcode",
        addressSearch: "Find address",
        addressSearching: "Opening the address window…",
        addressUnavailable:
          "The address finder could not open. Please type your address below.",
        address1: "Address",
        address2: "Address, line 2",
        exhibitionSection: "The exhibition",
        wishPeriod: "Dates",
        hall: "Hall",
        title: "Exhibition title",
        artist: "Artist",
        artistHint: "For a group show, the lead artist's name.",
        kind: "Type",
        artistCount: "Artists showing",
        workCount: "Works",
        workCountHint: "Fewer than 30 works at No. 20 canvas size.",
        genre: "Genre",
        genrePick: "Choose a genre",
        genreOther: "Genre, in your own words",
        filesSection: "CV and portfolio",
        bio: "CV",
        bioHint:
          "hwp · txt · ppt · doc · xls · pdf · up\u00A0to\u00A0{{max}} · {{each}}MB\u00A0each",
        portfolio: "Portfolio",
        portfolioHint:
          "jpg · png · gif · up\u00A0to\u00A0{{max}} · {{each}}MB\u00A0each · {{total}}MB in\u00A0total",
        pickFiles: "Choose files",
        pickImages: "Choose images",
        remove: "Remove",
        uploading: "Uploading…",
        used: "{{count}} of {{max}} · {{size}} of {{total}}",
        fileTooBig: "{{name}}: {{max}}MB is the limit",
        fileWrongType: "{{name}}: that format can't be attached",
        fileTooMany: "{{name}}: up to {{max}} files",
        fileTotalFull: "{{name}}: that would pass the {{total}}MB total",
        fileFailed: "{{name}}: that didn't upload. Please try again.",
        required: "required",
        termsOpen: "Read the full rental conditions",
        agree:
          "I have read the rental conditions below, and agree that what I enter here is used only to review this application.",
        submit: "Send application",
        submitting: "Sending…",
        cancel: "Cancel",
        taken:
          "Someone applied for that week while this form was open. The grid has been reloaded.",
        failed: "The application could not be sent. Please try again shortly.",
        received:
          "Your application for {{what}} has been received. The gallery reviews it and replies individually within three days.",
        privacy:
          "What you enter is used only to review this application. Enquiries: +82 2-736-6669 · +82 2-737-6669",
        status: {
          available: "Available",
          pending: "Under review",
          approved: "Booked",
          reserved: "Booked",
          reserved_pending: "Under review",
        },
        stepTitles: {
          unit: "The week",
          review: "Review",
          contract: "Contract",
          install: "In and out",
        },
        steps: {
          unit: "The rental unit is one week, Wednesday to the following Tuesday.",
          review:
            "The gallery reviews within three days of receipt and replies to each applicant individually.",
          contract:
            "Sign within seven days of approval and pay 30% as a deposit; the balance falls due seven days before the opening.",
          install:
            "Work goes in on the Tuesday between 2pm and 7pm, and must be out by 1pm on the closing Tuesday.",
        },
        pricing: {
          heading: "Rental fees",
          hall: "Hall",
          perWeek: "per week · VAT incl.",
          seasons: {
            peak: "Regular season",
            low: "Low season",
            high: "Peak season",
          },
          months: {
            peak: "Mar to Jun · Sep · Dec",
            low: "Jan · Feb · Jul · Aug",
            high: "Oct · Nov",
          },
        },
      },
    },
  },
};

// Keep <html lang> on the UI language: it drives screen-reader voice
// selection. Unlike the studio, the title is left to the pages: each inner
// page names the tab itself (useDocumentTitle), and index.html's default is
// already bilingual.
function syncDocument(lng: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
}
i18n.on("languageChanged", syncDocument);

i18n.use(initReactI18next).init({
  resources,
  lng: "ko",
  fallbackLng: "ko",
  interpolation: { escapeValue: false },
});

syncDocument(i18n.language);

export default i18n;
