<?php
/**
 * POST /backend/api/popups/create.php   (관리자 전용, multipart/form-data)
 *
 *   payload : JSON 문자열
 *             { title, url, link_target, period_start, period_end,
 *               use_yn, sort_order, img_pos_left, img_pos_top }
 *   image   : 팝업 이미지 1장 (필수, 10MB 이하 jpg/png/gif/webp)
 *
 * 응답 data: { id }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/popup.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 등록 가능
$admin = current_admin();
require_post();

if (!popup_table_exists()) {
    json_error(popup_missing_table_message(), 500);
}

$payload = json_decode(isset($_POST['payload']) ? (string) $_POST['payload'] : '', true);

if (!is_array($payload)) {
    json_error('팝업 데이터를 읽을 수 없습니다.', 422);
}

$input = popup_input($payload);
$image = popup_uploaded_image();

// 등록할 때는 이미지가 있어야 팝업을 띄울 수 있습니다.
if ($image === null) {
    json_error('팝업 이미지를 선택해 주세요.', 422);
}

try {
    $id = popup_create($input, $image, (string) $admin['id']);

    json_ok(['id' => $id]);
} catch (Throwable $e) {
    // 원인을 서버 오류 로그에 남깁니다 (화면에는 노출하지 않습니다).
    error_log('[popup create] ' . $e->getMessage());

    json_error('팝업을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
}
