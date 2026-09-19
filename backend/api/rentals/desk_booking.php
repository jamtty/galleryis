<?php
/**
 * POST /backend/api/rentals/desk_booking.php   (관리자 전용)
 *
 *   { "hall_id": "hall4", "week_start": "2026-09-30",
 *     "statement": "010-1234-5678 김OO 작가님. 개인전, 서양화 20점 예정.",
 *     "status": "pending" }
 *
 * 대리 신청 — 전화나 방문으로 잡아 둔 주를 직원이 대신 접수합니다.
 * 신청자 정보(이름 · 연락처 · 주소)와 전시구분 · 첨부 · 유의사항 동의는
 * 신청자 본인이 공개 신청서에서 채울 몫이라 여기서는 받지 않습니다.
 * 남는 것은 전시장 · 그 주 · 메모 · 접수 상태입니다.
 *
 * status 는 접수 상태입니다.
 *   · pending  심사중 — 대관 신청 화면에서 승인·반려합니다. (기본값)
 *   · approved 대관완료 — 카운터에서 이미 확정한 주. 곧바로 공개 일정에 표시됩니다.
 * 둘 다 그 주를 잠그므로, 이미 신청이 있는 주는 409 로 돌려보냅니다.
 *
 * 응답 data: { id, status }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';

// 대리 신청은 관리자만 — 입력한 사람이 기록(rt_created_by)에 남습니다.
$admin = current_admin();
require_post();

$payload = read_json_body();

$hallId = isset($payload['hall_id']) ? trim((string) $payload['hall_id']) : '';
$weekStart = isset($payload['week_start']) ? trim((string) $payload['week_start']) : '';
$statement = isset($payload['statement']) ? trim((string) $payload['statement']) : '';
$status = isset($payload['status']) ? (string) $payload['status'] : 'pending';

if (rental_hall_label($hallId) === null) {
    json_error('희망 전시장을 선택해 주세요.', 422);
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $weekStart)) {
    json_error('희망 전시일을 선택해 주세요.', 422);
}

if ($status !== 'pending' && $status !== 'approved') {
    json_error('접수 상태는 심사중 또는 대관완료 여야 합니다.', 422);
}

// 4000자까지만 남깁니다. (신청서 메모 입력란의 maxLength 와 동일)
$statement = function_exists('mb_substr')
    ? mb_substr($statement, 0, 4000, 'UTF-8')
    : substr($statement, 0, 4000);

if (rental_is_taken($hallId, $weekStart)) {
    json_error('그사이 다른 신청이 이 주를 차지했습니다. 일정을 새로 불러와 다른 주를 골라 주세요.', 409);
}

try {
    $wrId = rental_create_desk_booking(
        $hallId,
        $weekStart,
        $statement,
        $status,
        (string) $admin['id']
    );

    json_ok(['id' => $wrId, 'status' => $status]);
} catch (Throwable $e) {
    error_log('[rental desk booking] ' . $e->getMessage());

    json_error('접수하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
}
