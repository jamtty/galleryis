<?php
/**
 * POST /backend/api/halls/update.php   (관리자 전용, multipart/form-data)
 *
 *   id      : hall.h_id (전시장은 4개 고정 — 수정만 있습니다)
 *   payload : JSON {
 *               name, floor, spec,
 *               price_peak, month_peak,      // 평수기
 *               price_off,  month_off,       // 비수기
 *               price_high, month_high,      // 성수기
 *               price_note,                  // '주 단위 · VAT 포함'
 *               use_yn                       // 'Y' | 'N'
 *             }
 *   keep[]  : 남길 사진 hp_id (화면에 남아 있는 순서대로 다시 매깁니다)
 *             **보내지 않으면 사진이 모두 삭제됩니다.**
 *   sheet   : 도면·조감도 이미지 1장 (교체할 때만 보냅니다 — 안 보내면 그대로 유지)
 *   plan    : [도면 내려받기] 파일 1장 (교체할 때만 · 안 보내면 그대로 유지)
 *   files[] : 새 전시장 사진 (남긴 사진과 합쳐 8장까지)
 *
 * 응답 data: { id }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/hall.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 수정할 수 있습니다.
$admin = current_admin();
require_post();

if (!hall_table_exists(HALL_TABLE)) {
    json_error(hall_missing_table_message(), 500);
}

// 도면을 파일로 받으려면 칼럼이 h_plan_name 이어야 합니다.
if (!hall_has_column('h_plan_name')) {
    json_error(hall_missing_plan_column_message(), 500);
}

$hallId = isset($_POST['id']) ? (int) $_POST['id'] : 0;

if ($hallId <= 0) {
    json_error('전시장 번호가 없습니다.', 422);
}

$payload = json_decode(isset($_POST['payload']) ? (string) $_POST['payload'] : '', true);

if (!is_array($payload)) {
    json_error('전시장 데이터를 읽을 수 없습니다.', 422);
}

$input = hall_input($payload);
$sheet = hall_sheet_uploaded();
$plan = hall_plan_uploaded();
$uploads = hall_photos_uploaded();

$keep = [];

if (isset($_POST['keep']) && is_array($_POST['keep'])) {
    $keep = array_map('intval', $_POST['keep']);
}

// 남길 사진 + 새로 올린 사진이 8장을 넘지 않는지 확인합니다.
$keptCount = 0;

foreach (hall_photos_for($hallId) as $photo) {
    if (in_array((int) $photo['id'], $keep, true)) {
        $keptCount++;
    }
}

if ($keptCount + count($uploads) > HALL_PHOTO_LIMIT) {
    json_error(
        '전시장 사진은 ' . HALL_PHOTO_LIMIT . '장까지입니다.'
        . ' (남길 사진 ' . $keptCount . '장 + 새 사진 ' . count($uploads) . '장)',
        422
    );
}

try {
    hall_update($hallId, $input, $sheet, $plan, $uploads, $keep, (string) $admin['id']);

    json_ok(['id' => $hallId]);
} catch (Throwable $e) {
    error_log('[hall update] ' . $e->getMessage());

    json_error('전시장을 수정하지 못했습니다.', 500);
}
