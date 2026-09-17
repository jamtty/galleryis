<?php
/**
 * POST /backend/api/rentals/delete.php   (관리자 전용)
 *
 *   { "id": 1234 }            또는
 *   { "ids": [1234, 1235] }    (여러 건)
 *
 * 대관 신청을 삭제합니다.
 *   - uploads/order/{wr_id}/ 안의 실제 첨부파일과 폴더
 *   - g4_board_file 행
 *   - g4_write_order 행
 *
 * ⚠ 레거시 대관 기록(g4_write_order)도 함께 지워집니다.
 *    되돌릴 수 없으므로 관리자 화면에서 확인 절차를 거쳐 호출하세요.
 *
 * 응답 data: { deleted: 삭제한 건수, files: 지운 첨부파일 수 }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 삭제할 수 있습니다.
current_admin();

require_post();

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
    json_error('삭제할 신청 번호가 없습니다.', 422);
}

try {
    $deleted = 0;
    $files = 0;

    foreach ($ids as $id) {
        $result = rental_delete_booking($id);
        $files += $result['files'];

        if ($result['post']) {
            $deleted++;
        }
    }

    if ($deleted === 0) {
        json_error('삭제할 신청을 찾을 수 없습니다.', 404);
    }

    json_ok(['deleted' => $deleted, 'files' => $files]);
} catch (Throwable $e) {
    json_error('신청을 삭제하지 못했습니다.', 500);
}
