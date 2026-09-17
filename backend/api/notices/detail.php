<?php
/**
 * GET /backend/api/notices/detail.php?id=12   (관리자 전용)
 *
 * 응답 data: {
 *   id, title, content, link1, link2, author, email, hit, createdAt,
 *   files: [ { no, name, size, width, height, isImage, url } ]
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/notice.php';
require_once __DIR__ . '/../../lib/response.php';

current_admin();

if (!notice_table_exists()) {
    json_error(notice_missing_table_message(), 500);
}

$wrId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($wrId <= 0) {
    json_error('공지 번호가 없습니다.', 422);
}

try {
    $detail = notice_detail($wrId);
} catch (Throwable $e) {
    json_error('공지를 불러오지 못했습니다.', 500);
}

if ($detail === null) {
    json_error('해당 공지를 찾을 수 없습니다.', 404);
}

json_ok($detail);
