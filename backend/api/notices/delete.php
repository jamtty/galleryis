<?php
/**
 * POST /backend/api/notices/delete.php   (관리자 전용)
 *
 *   { "id": 12 }            또는
 *   { "ids": [12, 13] }     (여러 건)
 *
 * 공지를 삭제합니다.
 *   - uploads/notice/ 안의 실제 첨부파일
 *   - g4_board_file 행 (bo_table='notice')
 *   - g4_write_notice 행
 *
 * ⚠ 되돌릴 수 없으므로 관리자 화면에서 확인 절차를 거쳐 호출하세요.
 *
 * 응답 data: { deleted: 삭제한 건수, files: 지운 파일 수 }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/notice.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 삭제할 수 있습니다.
current_admin();
require_post();

if (!notice_table_exists()) {
    json_error(notice_missing_table_message(), 500);
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
    json_error('삭제할 공지 번호가 없습니다.', 422);
}

try {
    $deleted = 0;
    $files = 0;

    foreach ($ids as $id) {
        $result = notice_delete($id);

        $files += $result['files'];

        if ($result['post']) {
            $deleted++;
        }
    }

    if ($deleted === 0) {
        json_error('삭제할 공지를 찾을 수 없습니다.', 404);
    }

    json_ok(['deleted' => $deleted, 'files' => $files]);
} catch (Throwable $e) {
    json_error('공지를 삭제하지 못했습니다.', 500);
}
