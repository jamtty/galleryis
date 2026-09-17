<?php
/**
 * POST /backend/api/rentals/check.php   (관리자 전용)
 *
 *   { "id": 1234, "checked": true }            또는
 *   { "ids": [1234, 1235], "checked": false }  (여러 건)
 *
 * 대관 신청의 관리자 확인(읽음) 여부를 바꿉니다.
 * (g4_write_order.rt_checked / rt_checked_at — sql/rental_checked_column.sql)
 *
 * 응답 data: { updated: 바뀐 건수, checked: true|false }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';

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
    json_error('변경할 신청 번호가 없습니다.', 422);
}

$checked = !empty($payload['checked']);

if (!rental_has_column('rt_checked')) {
    json_error('확인 여부를 저장할 컬럼이 없습니다. sql/rental_checked_column.sql 을 실행해 주세요.', 500);
}

try {
    $updated = rental_set_checked($ids, $checked);

    json_ok(['updated' => $updated, 'checked' => $checked]);
} catch (Throwable $e) {
    json_error('확인 여부를 바꾸지 못했습니다.', 500);
}
