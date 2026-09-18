<?php
/**
 * GET /backend/api/halls/detail.php?id=1   (관리자 전용)
 *
 * 전시장 1건과 사진 목록을 돌려줍니다. (수정 화면에서 씁니다)
 *
 * 응답 data: list.php 의 item 1건과 같은 모양
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/hall.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 조회 가능
current_admin();

if (!hall_table_exists(HALL_TABLE)) {
    json_error(hall_missing_table_message(), 500);
}

$hallId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($hallId <= 0) {
    json_error('전시장 번호가 없습니다.', 422);
}

try {
    json_ok(hall_detail($hallId));
} catch (Throwable $e) {
    error_log('[hall detail] ' . $e->getMessage());

    json_error('전시장을 불러오지 못했습니다.', 500);
}
