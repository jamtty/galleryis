<?php
/**
 * GET /backend/api/exhibitions/public_detail.php?id=1   (공개 — 인증 없음)
 *
 * 공개 전시 상세입니다. 열어 보면 조회수가 1 올라갑니다.
 * 노출(Y) 이 아닌 전시는 404 로 돌려줍니다.
 *
 * 응답 data: {
 *   id, title, artist, place, startDate, endDate, status, statusLabel,
 *   overview, bio, hit,
 *   files: [ { id, no, name, ext, size, width, height, isImage, url } ]
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/exhibition.php';
require_once __DIR__ . '/../../lib/response.php';

if (!exhibition_table_exists(EXHIBITION_TABLE)) {
    json_error('해당 전시를 찾을 수 없습니다.', 404);
}

$exId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($exId <= 0) {
    json_error('전시 번호가 없습니다.', 422);
}

try {
    $detail = exhibition_public_detail($exId);
} catch (Throwable $e) {
    error_log('[exhibition public detail] ' . $e->getMessage());

    json_error('전시를 불러오지 못했습니다.', 500);
}

if ($detail === null) {
    json_error('해당 전시를 찾을 수 없습니다.', 404);
}

// 화면에 보여 준 뒤 조회수를 올립니다.
try {
    exhibition_add_hit($exId);
} catch (Throwable $e) {
    // 조회수 실패로 내용을 못 보여 주면 안 되므로 넘어갑니다.
    error_log('[exhibition public hit] ' . $e->getMessage());
}

json_ok($detail);
