import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

// 헤더 검색 (2026-10-02). The gallery asked for a search beside the language
// switch: a magnifier and a field on one hairline — only the rule shows — and
// the shows the word matches on the exhibitions page, which is where a list
// belongs. Enter and the magnifier both send it, and nothing pops up while
// typing. Exhibitions only: the notice board is short enough to read, and a
// field that says what it searches beats one that finds four unrelated things.
//
// The word goes to the API rather than to the listings already in the cache:
// the /exhibitions tabs keep three lists between them and none of them holds a
// show that closed last month, which is exactly what an archive's search is
// for. See `dispatchGet` — a keyword searches every status at once.
//
// 필드는 **아래선 하나만** 보입니다 — 돋보기가 오른쪽, 폭 15rem. 자리 안내문
// (placeholder)은 없습니다: 무엇을 찾는 곳인지는 접근성 이름이 나릅니다.
//
// Enter 나 돋보기(보내기 버튼)가 단어를 **전시 목록 페이지**로 보냅니다
// (`/exhibitions?keyword=…`) — 목록이 있는 곳이 그 페이지입니다 (2026-10-02,
// 입력하는 동안 말풍선으로 결과를 띄우던 판은 걷어냈습니다).
//
// 두 자리에 섭니다 (`variant`) — 막대에서는 `lg` 부터, 그 아래 폭에서는 접힌
// 메뉴의 첫 줄입니다. 폰 막대에는 자리가 없습니다: 워드마크만 203px 이고 그
// 옆에 언어 전환과 ≡ 가 이미 있습니다. 두 자리는 각자 입력값을 쥐지만 동시에
// 보이지 않고, 같은 단어는 react-query 키가 같아 요청도 한 번입니다.

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4 20 20" />
    </svg>
  );
}

/**
 * 필드를 비우는 ✕ — 브라우저가 `type="search"` 에 붙이는 제 것(파란 회색
 * 사각형)은 아래 `[&::-webkit-search-cancel-button]` 로 지우고, 같은 뜻의
 * 흑백 아이콘을 우리가 그립니다 (2026-10-02).
 */
function ClearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function HeaderSearch({
  /**
   * bar  — 막대 안 (자리는 `lg` 부터: 그 아래 폭에는 없는 자리입니다)
   * menu — 접힌 메뉴의 첫 줄 (`lg` 미만에서만 보입니다)
   */
  variant = "bar",
}: {
  variant?: "bar" | "menu";
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const field = useRef<HTMLInputElement>(null);

  // 보내면 전시 목록 페이지가 결과를 그립니다 — 여기서는 단어만 넘기고,
  // 필드는 빈 칸으로 돌아갑니다 (무엇을 찾았는지는 목록 위에 다시 적힙니다).
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const word = text.trim();
    if (word === "") return;
    navigate(`/exhibitions?keyword=${encodeURIComponent(word)}`);
    setText("");
  };

  return (
    <form
      onSubmit={submit}
      className={
        variant === "bar"
          ? // 15rem 을 바탕으로 두되, 자리가 모자라면 먼저 줄어드는 쪽입니다
            // (flex) — 1024px 즈음의 작은 노트북에서 탭과 언어 전환을
            // 밀어내지 않도록.
            "relative hidden min-w-0 shrink basis-[15rem] lg:block"
          : "relative px-5 py-3 sm:px-8 lg:hidden"
      }
    >
      {/* 아래선 하나만 보이는 필드 — 돋보기가 오른쪽이고, 그 아이콘이 곧
          보내기 버튼입니다. 선은 네 면 중 아래 한 면뿐이고, 평소에는 가장 옅은
          헤어라인(`line`)이다가 포커스가 들어오면 그 선만 `ink` 로 진해집니다.
          그 선이 이 필드의 초점 표시입니다 — `index.css` 의 전역 `:focus-visible`
          상자 테두리는 상자가 없는 필드라 적용하지 않습니다 (`outline-none!`
          의 `!` 는 그 전역 규칙이 layer 밖이라 유틸리티만으로는 못 이겨서).

          입력칸은 `text-base`(16px): iOS 는 16px 미만 입력칸에 포커스가 가면
          화면을 마음대로 확대합니다. `appearance-none` 은 사파리가
          `type="search"` 에 제 나름의 둥근 상자를 그리는 것을 막습니다.
          입력칸에 딸린 제 ✕(`::-webkit-search-cancel-button`)는 지우고,
          같은 뜻의 흑백 아이콘을 우리가 그립니다. */}
      <div className="flex items-center gap-x-2 border-b border-line pb-1.5 transition-colors focus-within:border-ink">
        <input
          ref={field}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label={t("search.label")}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 appearance-none bg-transparent text-base text-ink outline-none! [&::-webkit-search-cancel-button]:hidden"
        />
        {text !== "" && (
          // 비우고 필드로 초점을 돌려줍니다 — 지우고 이어 쓰는 것이 한 동작.
          <button
            type="button"
            aria-label={t("search.clear")}
            onClick={() => {
              setText("");
              field.current?.focus();
            }}
            className="-my-2 inline-flex h-11 w-9 shrink-0 items-center justify-center text-ink-soft transition-colors hover:text-ink"
          >
            <ClearIcon />
          </button>
        )}
        {/* 44px 터치 영역이되 위아래로 줄을 밀지 않게 음수 여백으로 앉힙니다. */}
        <button
          type="submit"
          aria-label={t("search.submit")}
          className="-my-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink transition-colors hover:text-ink-soft"
        >
          <SearchIcon />
        </button>
      </div>
    </form>
  );
}
