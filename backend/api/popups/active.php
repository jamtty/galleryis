<?php
/**
 * GET /backend/api/popups/active.php   (공개 — 인증 없음)
 *
 * 공개 사이트에서 띄울 팝업만 돌려줍니다.
 *   use_yn = 'Y' 이고 오늘 날짜가 노출기간 안에 있는 것
 *
 * 응답 data: [ { id, title, url, linkTarget, posLeft, posTop, imageUrl, width, height }, ... ]
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/popup.php';
require_once __DIR__ . '/../../lib/response.php';

// 공개 화면에서 쓰므로 관리자 토큰이 필요 없습니다.
if (!popup_table_exists()) {
    // 아직 설치 전이면 빈 목록으로 조용히 넘어갑니다. (공개 화면이 깨지지 않게)
    json_ok([]);
}

try {
    $items = popup_active_list();
} catch (Throwable $e) {
    error_log('[popup active] ' . $e->getMessage());

    json_error('팝업을 불러오지 못했습니다.', 500);
}

$public = [];

foreach ($items as $item) {
    $public[] = [
        'id' => $item['id'],
        'title' => $item['title'],
        'url' => $item['url'],
        'linkTarget' => $item['linkTarget'],
        'posLeft' => $item['posLeft'],
        'posTop' => $item['posTop'],
        'imageUrl' => $item['imageUrl'],
        'width' => $item['width'],
        'height' => $item['height'],
    ];
}

json_ok($public);
