<?php
/**
 * POST /backend/api/popups/delete.php   (관리자 전용)
 *
 *   { "id": 1 }            또는
 *   { "ids": [1, 2] }      (여러 건 — 목록의 선택 삭제)
 *
 * 이미지 파일도 함께 지웁니다.
 *
 * ⚠ 되돌릴 수 없으므로 관리자 화면에서 확인 절차를 거쳐 호출하세요.
 *
 * 응답 data: { deleted: 삭제한 건수, files: 지운 파일 수 }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/popup.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 삭제할 수 있습니다.
current_admin();
require_post();

if (!popup_table_exists()) {
    json_error(popup_missing_table_message(), 500);
}

$payload = read_json_body();
$ids = [];

if (isset($payload['ids']) && is_array($payload['ids'])) {
    $ids = array_map('intval', $payload['ids']);
} elseif (isset($payload['id'])) {
    $ids = [(int) $payload['id']];
}

$ids = array_values(array_filter($ids, function ($id) {
    return $id > 0;
}));

if (!$ids) {
    json_error('삭제할 팝업 번호가 없습니다.', 422);
}

try {
    $deleted = 0;
    $files = 0;

    foreach ($ids as $id) {
        $result = popup_delete($id);

        $files += $result['files'];

        if ($result['deleted']) {
            $deleted++;
        }
    }

    if ($deleted === 0) {
        json_error('삭제할 팝업을 찾을 수 없습니다.', 404);
    }

    json_ok(['deleted' => $deleted, 'files' => $files]);
} catch (Throwable $e) {
    error_log('[popup delete] ' . $e->getMessage());

    json_error('팝업을 삭제하지 못했습니다.', 500);
}
