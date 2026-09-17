/**
 * 게시판 본문(HTML) 처리 — 화면에 그릴 형태로 바꿉니다.
 *
 * 그누보드 시절 글은 태그 없이 평문 + 줄바꿈(`\r\n`)으로 저장돼 있어서
 * 그대로 넣으면 줄바꿈이 사라집니다. 태그가 없는 본문만 줄바꿈을 살립니다.
 */

/** 블록 요소 — 하나라도 있으면 이미 HTML 본문으로 봅니다. */
const HTML_BLOCK = /<(p|div|br|h[1-6]|ul|ol|li|table|blockquote|img|hr|figure)\b/i

/** 스크립트는 실행되지 않도록 지웁니다. */
export function stripScripts(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
}

/**
 * 본문(HTML) 을 화면에 그릴 HTML 로 만듭니다.
 *
 * @param value DB 에 저장된 본문
 * @returns 화면에 그릴 HTML
 */
export function renderBodyHtml(value: string) {
  const html = stripScripts(value ?? '')

  if (html === '' || HTML_BLOCK.test(html)) return html

  // 태그가 없으므로 '<' 만 막고, `&#123;` 같은 기존 엔티티는 살립니다.
  return html.replace(/</g, '&lt;').replace(/\r\n|\r|\n/g, '<br>')
}
