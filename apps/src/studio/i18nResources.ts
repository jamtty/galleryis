// The studio's own strings. It wears no masthead and no footer of its own
// since the picker went to the main site's 전시장 안내 (2026-09-09), so the
// gallery's name is not among them: the one place the wordmark still appears
// is the loading mark, which is decoration and carries the name from
// packages/shared.
export const resources = {
  ko: {
    translation: {
      webglFallback: "3D 미리보기를 사용할 수 없는 환경입니다",
      meta: { title: "갤러리 이즈 스튜디오 · Gallery IS Studio" },
      // A language names itself, so these are identical in both locales.
      language: { english: "English", korean: "한국어" },
      hallView: {
        // Out to 전시장 안내 on the main site: the studio has no picker of
        // its own, and that page is where a hall is chosen.
        back: "전시장 선택으로",
        loading: "전시장을 여는 중…",
        notFound: "요청하신 전시장을 찾을 수 없습니다",
        error: "전시장 정보를 불러오지 못했습니다",
        disclaimer: "치수는 공개 도면을 바탕으로 한 근사치입니다.",
        floorplan: "도면 보기 ↗",
        specs: "{{area}}m² · {{pyeong}}평 (공유면적 포함) · 층고 {{ceiling}}cm",
        walk: "걷기",
        overview: "둘러보기",
        hint: "드래그로 둘러보고, 바닥을 누르거나 방향키로 이동하세요",
        canvasLabel: "3D 전시장 미리보기",
        entrance: "입구",
        reception: "안내 데스크",
      },
      works: {
        title: "나의 작품",
        count: "{{n}}/{{max}}",
        counter: "작품 {{n}}/{{max}}",
        add: "작품 불러오기",
        arrange: "자동 배치",
        manualNote:
          "직접 옮긴 뒤로는 자동 배치가 멈춥니다. 자동 배치를 누르면 전시장 전체를 다시 겁니다.",
        close: "패널 닫기",
        delete: "삭제",
        widthLabel: "가로 cm",
        heightLabel: "세로 cm",
        hoLabel: "호수",
        hoOption: "{{n}}호",
        hoCustom: "직접 입력",
        overlap: "다른 작품과 겹칩니다",
        nudge: "작품을 불러와 벽에 걸어보세요",
        emptyTitle: "아직 걸린 작품이 없습니다",
        empty:
          "{{types}}, 한 점당 최대 {{mb}} MB. 이미지는 이 기기 밖으로 나가지 않습니다.",
        saveNote:
          "배치는 이 기기에 저장됩니다. 새로고침해도 그대로이고, 작품 이미지는 브라우저 밖으로 나가지 않습니다.",
        saveOff:
          "배치는 저장되지 않으며 새로고침하면 사라집니다. 작품 이미지는 브라우저 안에만 머뭅니다.",
        saveFull:
          "이 기기에 저장할 공간이 없습니다. 이번 배치는 새로고침하면 사라집니다.",
        restoring: "저장된 배치를 불러오는 중…",
        restoredMoved:
          "전시장 도면이 갱신되어 일부 작품 위치를 다시 잡았습니다.",
        restoredDropped: "일부 작품을 복원하지 못해 배치에서 제외했습니다.",
        deleteAll: "저장된 배치 지우기",
        deleteConfirm: "모든 전시장의 배치와 이미지를 이 기기에서 지웁니다.",
        deleteYes: "지우기",
        deleteNo: "취소",
        dismiss: "알림 닫기",
        ordinal: "{{n}}.",
        errors: {
          type: "{{name}}: 지원하지 않는 형식입니다 ({{types}})",
          size: "{{name}}: {{mb}} MB를 넘습니다",
          limit: "{{name}}: 작품은 {{max}}점까지 걸 수 있습니다",
          unreadable: "{{name}}: 이미지를 읽을 수 없습니다",
        },
      },
      assist: {
        open: "도우미",
        title: "도우미",
        intro:
          "작품을 어디에 어떻게 걸지 문장으로 알려 주세요. 아래 예시를 눌러도 됩니다.",
        close: "닫기",
        placeholder: "예: 왼쪽 큰 벽에 60센티로 걸어줘",
        inputLabel: "배치 요청",
        send: "보내기",
        sending: "배치를 생각하는 중…",
        micStart: "말하기 시작",
        micStop: "말하기 중지",
        listening: "듣고 있습니다…",
        // The honest sentence. Chrome's recogniser is network-backed, so the
        // spoken words really do leave the device, but the pictures don't, and
        // conflating the two would be the easiest lie in this feature to tell.
        privacy:
          "말한 내용은 브라우저의 음성 인식을 거쳐 글자로 바뀐 뒤, 배치를 해석하기 위해 갤러리 서버로 전송됩니다. 작품 이미지와 파일 이름은 전송되지 않습니다.",
        // The same promise, minus the half that was only true with a
        // microphone. Weakening it when voice returns would be the easiest
        // lie in this feature to tell, so both sentences live side by side.
        privacyTyped:
          "입력하신 문장은 배치를 해석하기 위해 갤러리 서버로 전송됩니다. 작품 이미지와 파일 이름은 전송되지 않습니다.",
        hint: "‘왼쪽’과 ‘오른쪽’은 입구에서 봤을 때를 기준으로 합니다.",
        textOnly:
          "이 브라우저는 음성 입력을 지원하지 않습니다. 직접 입력해 주세요.",
        micDenied:
          "마이크 사용이 허용되지 않았습니다. 브라우저 설정에서 허용해 주세요.",
        micOffline: "음성 인식을 사용할 수 없습니다. 직접 입력해 주세요.",
        micFailed: "음성 인식에 실패했습니다. 직접 입력해 주세요.",
        outcome: "{{n}}번 작품 · {{wall}}번 벽 · 가로 {{w}}cm · 높이 {{e}}cm",
        // What a bare count of failures could not say. The studio used to
        // report "요청 중 1가지는 적용할 수 없었습니다" under a reply claiming the
        // move had happened, and a visitor with no way to tell which sentence
        // was true could only ask again. These carry the measurement that
        // settles it, told "창문이 있는 벽에는 56cm까지만", nobody asks twice.
        wallWindow: "창문이 있는 벽",
        wallDesk: "안내 데스크가 있는 벽",
        wallPlain: "{{n}}번 벽",
        drop: {
          noRoom:
            "{{wall}}에는 폭 {{fits}}cm까지만 걸 수 있어 가로 {{width}}cm 작품이 들어가지 않습니다.",
          instead: "{{wall}}에는 들어갑니다.",
          noRoomElsewhere: "작품을 줄이거나 다른 벽을 말씀해 주세요.",
          noWall: "이 전시장에 없는 벽이라 옮기지 못했습니다.",
          noWork: "말씀하신 작품을 찾지 못했습니다.",
          noSize: "바꿀 크기를 알 수 없어 그대로 두었습니다.",
          unsupported: "도우미가 할 수 없는 요청이라 넘어갔습니다.",
        },
        // Said out loud rather than left as an absence of numbers. A reply can
        // claim a change the studio did not make, and the visitor should not
        // have to notice that the evidence line is missing to find out.
        noChange: "실제로 바뀐 것은 없습니다.",
        emptyHint: "작품을 먼저 불러오면 말로 배치할 수 있습니다.",
        unavailable:
          "지금은 배치 도우미를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        unconfigured: "이 전시장에서는 배치 도우미를 사용할 수 없습니다.",
        offline: "오프라인 상태에서는 배치 도우미를 쓸 수 없습니다.",
        failed: "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
        reset: "새 대화",
        // The three that double as the demo script.
        starter1: "큰 벽에 걸어줘",
        starter2: "전부 고르게 다시 걸어줘",
        starter3: "큰 벽에 얼마나 남았어?",
        // Offered when the request never got an answer at all.
        retry1: "다시 시도",
        retry2: "전부 고르게 다시 걸어줘",
        workNumber: "{{n}}번 작품",
        suggestionsLabel: "이어서 할 말",
        // The studio is where the wrong answers are actually seen; the desk
        // reads what visitors leave here on its 의견 page.
        feedback: {
          ask: "이 답변이 도움이 되었나요?",
          up: "도움이 됨",
          down: "도움이 안 됨",
          likedWhat: "어떤 점이 좋았는지 알려주시면 도움이 됩니다. (선택)",
          wrongWhat: "무엇이 잘못되었는지 알려주시면 도움이 됩니다. (선택)",
          placeholder:
            "예: 창문 벽에는 걸 수 없다고 먼저 알려줬으면 좋았겠습니다.",
          send: "의견 보내기",
          sending: "보내는 중…",
          skip: "괜찮습니다",
          thanks: "의견 감사합니다.",
          failed: "보내지 못했습니다.",
          // The same promise the composer makes, repeated where it is about to
          // be tested: a feedback box is the obvious place for a filename to
          // leak, and the visitor should not have to take that on trust.
          privacy:
            "방금 주고받은 문장과 배치 결과만 전송됩니다. 작품 이미지와 파일 이름은 전송되지 않습니다.",
        },
      },
      reserve: {
        // The studio used to carry an application form of its own. It now
        // sends the visitor to the gallery's own form, with this hall already
        // chosen, one set of fields to keep true to what the gallery asks,
        // on the site that owns applications.
        open: "대관 신청 ↗",
      },
      review: {
        badge: "제출된 배치를 보고 있습니다. 사진은 전송되지 않았습니다.",
        error: "이 배치를 불러올 수 없습니다.",
        exitToMine: "내 전시장으로",
      },
      notFound: {
        title: "페이지를 찾을 수 없습니다",
        home: "처음으로 돌아가기",
      },
      errorScreen: {
        title: "화면을 불러오지 못했습니다",
        body: "잠시 후 다시 시도해 주세요.",
        reload: "새로고침",
      },
    },
  },
  en: {
    translation: {
      webglFallback: "3D preview is not available in this environment",
      meta: { title: "Gallery IS Studio · 갤러리 이즈 스튜디오" },
      language: { english: "English", korean: "한국어" },
      hallView: {
        back: "Back to the halls",
        loading: "Opening the hall…",
        notFound: "We couldn't find that hall",
        error: "We couldn't load the halls",
        disclaimer:
          "Dimensions are approximate, traced from published floor plans.",
        floorplan: "Floor plan ↗",
        // Deliberately drops {{pyeong}}: 평 means nothing to a non-Korean
        // audience. Call sites still pass it; i18next ignores the extra.
        specs: "{{area}} m² · Ceiling {{ceiling}} cm",
        walk: "Walk",
        overview: "Overview",
        hint: "Drag to look around, tap the floor or use the arrow keys to move",
        canvasLabel: "3D hall preview",
        entrance: "Entrance",
        reception: "Reception",
      },
      works: {
        title: "My works",
        count: "{{n}}/{{max}}",
        counter: "Works {{n}}/{{max}}",
        add: "Add works",
        arrange: "Arrange",
        manualNote:
          "Auto-arrange pauses once you move a work by hand. Arrange re-hangs the whole hall.",
        close: "Close panel",
        delete: "Remove",
        widthLabel: "Width cm",
        heightLabel: "Height cm",
        hoLabel: "Canvas no.",
        hoOption: "No. {{n}}",
        hoCustom: "Custom",
        overlap: "Overlaps another work",
        nudge: "Add your artwork to hang it here",
        emptyTitle: "Nothing hung yet",
        empty:
          "{{types}}, up to {{mb}} MB each. Images never leave this device.",
        saveNote:
          "Saved on this device, still here after a refresh. Your images never leave the browser.",
        saveOff:
          "Layouts aren't saved: a refresh clears them. Artwork images stay in your browser.",
        saveFull:
          "No room left to save on this device, so this layout will clear on refresh.",
        restoring: "Restoring your layout…",
        restoredMoved: "The hall plan has changed, so some works were re-hung.",
        restoredDropped: "Some works couldn't be restored and were left out.",
        deleteAll: "Delete my saved layouts",
        deleteConfirm:
          "This deletes every hall's layout and images from this device.",
        deleteYes: "Delete",
        deleteNo: "Cancel",
        dismiss: "Dismiss",
        ordinal: "{{n}}.",
        errors: {
          type: "{{name}}: unsupported format ({{types}})",
          size: "{{name}}: over {{mb}} MB",
          limit: "{{name}}: up to {{max}} works can be hung",
          unreadable: "{{name}}: couldn't read this image",
        },
      },
      assist: {
        open: "Assistant",
        title: "Assistant",
        intro:
          "Tell me where a work should hang, in a sentence. Or tap one of the examples below.",
        close: "Close",
        placeholder: "e.g. hang it on the big left wall at 60cm",
        inputLabel: "Placement request",
        send: "Send",
        sending: "Working out the placement…",
        micStart: "Start speaking",
        micStop: "Stop speaking",
        listening: "Listening…",
        privacy:
          "What you say goes through your browser's speech recognition and is then sent, as text, to the gallery's server to be interpreted. Your artwork images and filenames are not sent.",
        privacyTyped:
          "What you type is sent to the gallery's server to be interpreted. Your artwork images and filenames are not sent.",
        hint: "“Left” and “right” are as seen standing in the entrance.",
        textOnly:
          "This browser doesn't support voice input. Type your request instead.",
        micDenied:
          "The microphone wasn't allowed. You can enable it in your browser settings.",
        micOffline:
          "Speech recognition is unavailable. Type your request instead.",
        micFailed: "Speech recognition failed. Type your request instead.",
        outcome: "Work {{n}} · wall {{wall}} · {{w}}cm wide · {{e}}cm high",
        wallWindow: "the glazed wall",
        wallDesk: "the wall the desk stands against",
        wallPlain: "wall {{n}}",
        drop: {
          noRoom:
            "{{wall}} has room for {{fits}}cm at its widest, so a {{width}}cm-wide work won't fit.",
          instead: "It does fit on {{wall}}.",
          noRoomElsewhere: "Make the work smaller, or name another wall.",
          noWall: "This hall has no such wall, so nothing moved.",
          noWork: "I couldn't find the work you meant.",
          noSize: "I couldn't tell what size to make it, so I left it alone.",
          unsupported:
            "That isn't something the assistant can do, so it was skipped.",
        },
        noChange: "Nothing actually moved.",
        emptyHint: "Add a work first, then you can place it by voice.",
        unavailable:
          "The placement assistant is unavailable right now. Please try again shortly.",
        unconfigured: "The placement assistant isn't available here.",
        offline: "The placement assistant needs a connection.",
        failed: "That request didn't go through. Please try again.",
        reset: "New conversation",
        starter1: "Hang it on the big wall",
        starter2: "Space them all out evenly",
        starter3: "How much room is left on the big wall?",
        retry1: "Try again",
        retry2: "Space them all out evenly",
        workNumber: "Work {{n}}",
        suggestionsLabel: "Say next",
        feedback: {
          ask: "Was this answer helpful?",
          up: "Helpful",
          down: "Not helpful",
          likedWhat: "Tell us what worked, if you like. (optional)",
          wrongWhat: "Tell us what went wrong, if you like. (optional)",
          placeholder:
            "e.g. it should have said up front that nothing fits on the glazed wall.",
          send: "Send feedback",
          sending: "Sending…",
          skip: "No thanks",
          thanks: "Thank you.",
          failed: "That didn't send.",
          privacy:
            "Only the sentences you just exchanged and what the studio did with them are sent. Your artwork images and filenames are not.",
        },
      },
      reserve: {
        open: "Apply to rent ↗",
      },
      review: {
        badge: "You are viewing a submitted layout. No images were sent.",
        error: "This layout couldn't be loaded.",
        exitToMine: "Back to my hall",
      },
      notFound: {
        title: "Page not found",
        home: "Back to the start",
      },
      errorScreen: {
        title: "This screen didn't load",
        body: "Please try again in a moment.",
        reload: "Reload",
      },
    },
  },
};
