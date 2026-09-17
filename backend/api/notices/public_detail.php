<?php
/**
 * GET /backend/api/notices/public_detail.php?id=131   (공개 — 인증 없음)
 *
 * 공개 소식 상세입니다. 열어 보면 조회수가 1 올라갑니다.
 *
 * 응답 data: {
 *   id, title, content, link1, link2, pinned, author, hit, createdAt,
 *   files: [ { no, name, size, width, height, isImage, url } ],
 *   prev: { id, title } | null,   // 이전글 (더 최신)
 *   next: { id, title } | null    // 다음글 (더 오래된)
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/notice.php';
require_once __DIR__ . '/../../lib/response.php';

if (!notice_table_exists()) {
    json_error('해당 소식을 찾을 수 없습니다.', 404);
}

$wrId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($wrId <= 0) {
    json_error('소식 번호가 없습니다.', 422);
}

try {
    $detail = notice_public_detail($wrId);
} catch (Throwable $e) {
    error_log('[notice public detail] ' . $e->getMessage());

    json_error('소식을 불러오지 못했습니다.', 500);
}

if ($detail === null) {
    json_error('해당 소식을 찾을 수 없습니다.', 404);
}

// 화면에 보여 준 뒤 조회수를 올립니다. (표시되는 값은 열기 전 기준)
try {
    notice_add_hit($wrId);
} catch (Throwable $e) {
    // 조회수 실패로 본문을 못 보여 주면 안 되므로 넘어갑니다.
    error_log('[notice public hit] ' . $e->getMessage());
}

json_ok($detail);
