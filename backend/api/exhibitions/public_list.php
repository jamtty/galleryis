<?php
/**
 * GET /backend/api/exhibitions/public_list.php   (공개 — 인증 없음)
 *
 * 공개 전시 목록입니다. 노출(Y) 중인 전시만 나옵니다.
 *
 *   status : '' 전체 | 'current' 현재전시 | 'upcoming' 예정전시 | 'past' 지난전시
 *   page   : 1부터 (기본 1)
 *   size   : 기본 12 (최대 48)
 *
 * 응답 data: {
 *   items: [ { id, title, artist, place, startDate, endDate, status, statusLabel, imageUrl } ],
 *   totalCount, totalPages, page, size
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/exhibition.php';
require_once __DIR__ . '/../../lib/response.php';

$empty = [
    'items' => [],
    'totalCount' => 0,
    'totalPages' => 1,
    'page' => 1,
    'size' => 12,
];

// 아직 테이블이 없으면 빈 목록으로 조용히 넘어갑니다. (공개 화면이 깨지지 않게)
if (!exhibition_table_exists(EXHIBITION_TABLE)) {
    json_ok($empty);
}

try {
    json_ok(exhibition_public_list([
        'status' => isset($_GET['status']) ? (string) $_GET['status'] : '',
        'page' => isset($_GET['page']) ? (int) $_GET['page'] : 1,
        'size' => isset($_GET['size']) ? (int) $_GET['size'] : 12,
    ]));
} catch (Throwable $e) {
    error_log('[exhibition public list] ' . $e->getMessage());

    json_error('전시 목록을 불러오지 못했습니다.', 500);
}
