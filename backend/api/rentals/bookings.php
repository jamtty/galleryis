<?php
/**
 * POST /backend/api/rentals/bookings.php  (multipart/form-data)
 *
 *   payload    : JSON 문자열
 *                {
 *                  hall_id, week_start,
 *                  applicant: { name, email, phone, postcode, address1, address2 },
 *                  exhibition: { kind, genre, genre_other, memo }
 *                }
 *   bio[]      : 작가 약력 파일 (선택)
 *   portfolio[]: 포트폴리오 이미지 (선택)
 *
 * 응답 data: { id: wr_id }
 *
 * 409: 같은 기간에 이미 신청이 있음
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';

require_post();

require_once __DIR__ . '/booking_input.php';

$raw = isset($_POST['payload']) ? (string) $_POST['payload'] : '';
$payload = json_decode($raw, true);

if (!is_array($payload)) {
    json_error('신청 데이터를 읽을 수 없습니다.', 422);
}

$input = rental_booking_input($payload);

$attachments = rental_booking_uploads();

if (rental_is_taken($input['hall_id'], $input['week_start'])) {
    json_error('방금 다른 분이 같은 기간을 신청했습니다. 표를 다시 불러왔습니다.', 409);
}

// 첨부 수까지 반영해 관리자 확인용 메모를 다시 만듭니다.
$input['memo'] = rental_memo_text($input, count($attachments));

try {
    $wrId = rental_create_booking($input, $attachments);

    json_ok(['id' => $wrId]);
} catch (Throwable $e) {
    json_error('신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
}
