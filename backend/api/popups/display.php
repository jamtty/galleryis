<?php
/**
 * POST /backend/api/popups/display.php   (관리자 전용)
 *
 *   { "id": 1, "use_yn": "Y" }
 *
 * 목록의 사용여부 토글에서 호출합니다.
 *
 * 응답 data: { id, useYn }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/popup.php';
require_once __DIR__ . '/../../lib/response.php';

$admin = current_admin();
require_post();

if (!popup_table_exists()) {
    json_error(popup_missing_table_message(), 500);
}

$payload = read_json_body();
$id = isset($payload['id']) ? (int) $payload['id'] : 0;
$useYn = isset($payload['use_yn']) ? strtoupper(trim((string) $payload['use_yn'])) : '';

if ($id <= 0) {
    json_error('팝업 번호가 없습니다.', 422);
}

if ($useYn !== 'Y' && $useYn !== 'N') {
    json_error('사용 여부는 Y 또는 N 이어야 합니다.', 422);
}

try {
    popup_set_use($id, $useYn, (string) $admin['id']);

    json_ok(['id' => $id, 'useYn' => $useYn]);
} catch (Throwable $e) {
    error_log('[popup display] ' . $e->getMessage());

    json_error('사용 여부를 변경하지 못했습니다.', 500);
}
