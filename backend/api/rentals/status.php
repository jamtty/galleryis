<?php
/**
 * POST /backend/api/rentals/status.php   (관리자 전용)
 *
 *   { "id": 1234, "status": "approved" }   대관완료
 *   { "id": 1234, "status": "pending"  }   심사중
 *
 * 대관 상태를 바꿉니다. (g4_write_order.wr_13 — 1=심사중, 2=대관완료)
 * 이 값이 대관 일정 표(/admin/schedule · /rental)의 칸 색과 예약 여부를 정합니다.
 *
 * 응답 data: { id, status, updated }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 바꿀 수 있습니다.
current_admin();
require_post();

$payload = read_json_body();

$wrId = isset($payload['id']) ? (int) $payload['id'] : 0;
$status = isset($payload['status']) ? (string) $payload['status'] : '';

if ($wrId <= 0) {
    json_error('신청 번호가 없습니다.', 422);
}

if ($status !== 'pending' && $status !== 'approved') {
    json_error('대관 상태는 pending 또는 approved 여야 합니다.', 422);
}

$check = db()->prepare('SELECT wr_id FROM ' . RENTAL_TABLE . ' WHERE wr_id = ?');
$check->execute([$wrId]);

if (!$check->fetchColumn()) {
    json_error('대관 신청을 찾을 수 없습니다.', 404);
}

try {
    $updated = rental_set_status($wrId, $status);

    json_ok(['id' => $wrId, 'status' => $status, 'updated' => $updated]);
} catch (Throwable $e) {
    error_log('[rental status] ' . $e->getMessage());

    json_error('대관 상태를 바꾸지 못했습니다.', 500);
}
