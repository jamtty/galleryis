<?php
/**
 * 게시글 본문(HTML) · 문자열 공통 처리
 *
 * 그누보드처럼 HTML 은 허용하되(html1) 스크립트 실행만 막습니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/response.php';

/** 본문(HTML) 기본 최대 길이 */
const HTML_MAX_BYTES = 524288; // 512KB

/**
 * 위험한 태그·속성을 걷어냅니다.
 *
 * @param string $html
 * @param int    $maxBytes 넘으면 422 로 종료
 * @return string
 */
function html_clean_posted($html, $maxBytes = HTML_MAX_BYTES)
{
    $html = (string) $html;

    if ($html === '') {
        return '';
    }

    // 스크립트 · 스타일 · 프레임 · 폼 태그와 주석을 통째로 지웁니다.
    $blocked = 'script|style|iframe|frame|frameset|object|embed|applet|form|link|meta|base';

    $html = (string) preg_replace('#<' . '(' . $blocked . ')\b[^>]*>.*?</\1>#is', '', $html);
    $html = (string) preg_replace('#<(?:' . $blocked . ')\b[^>]*/?>#is', '', $html);
    $html = (string) preg_replace('#<!--.*?-->#s', '', $html);

    // on 으로 시작하는 이벤트 속성 (onclick 등) 을 지웁니다.
    $html = (string) preg_replace('#\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)#is', '', $html);

    // javascript: / vbscript: / data:text/html 로 시작하는 링크를 지웁니다.
    $html = (string) preg_replace(
        '#(href|src)\s*=\s*("|\')\s*(javascript|vbscript|data:text/html)[^"\']*("|\')#is',
        '$1="#"',
        $html
    );

    if (strlen($html) > (int) $maxBytes) {
        json_error('본문이 너무 깁니다. 내용을 줄여 주세요.', 422);
    }

    return trim($html);
}

/**
 * 글자 수 (UTF-8)
 *
 * @param string $value
 * @return int
 */
function text_length($value)
{
    if (function_exists('mb_strlen')) {
        return (int) mb_strlen((string) $value, 'UTF-8');
    }

    return (int) strlen((string) $value);
}
