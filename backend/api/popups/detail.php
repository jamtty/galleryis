<?php
/**
 * GET /backend/api/popups/detail.php?id=1   (관리자 전용)
 *
 * 응답 data: {
 *   id, title, url, linkTarget, periodStart, periodEnd,
 *   useYn, sortOrder, posLeft, posTop,
 *   imageName, imageUrl, width, height, createdAt, updatedAt
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/popup.php';
require_once __DIR__ . '/../../lib/response.php';

current_admin();

if (!popup_table_exists()) {
    json_error(popup_missing_table_message(), 500);
}

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($id <= 0) {
    json_error('팝업 번호가 없습니다.', 422);
}

try {
    $detail = popup_detail($id);
} catch (Throwable $e) {
    error_log('[popup detail] ' . $e->getMessage());

    json_error('팝업을 불러오지 못했습니다.', 500);
}

if ($detail === null) {
    json_error('해당 팝업을 찾을 수 없습니다.', 404);
}

json_ok($detail);
