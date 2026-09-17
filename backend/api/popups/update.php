<?php
/**
 * POST /backend/api/popups/update.php   (관리자 전용, multipart/form-data)
 *
 *   id      : 팝업 번호
 *   payload : JSON (create.php 와 같은 구조)
 *   image   : 새 이미지 (선택 — 보내지 않으면 기존 이미지를 그대로 씁니다)
 *
 * 응답 data: { id }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/popup.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 수정할 수 있습니다.
$admin = current_admin();
require_post();

if (!popup_table_exists()) {
    json_error(popup_missing_table_message(), 500);
}

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;

if ($id <= 0) {
    json_error('수정할 팝업 번호가 없습니다.', 422);
}

$payload = json_decode(isset($_POST['payload']) ? (string) $_POST['payload'] : '', true);

if (!is_array($payload)) {
    json_error('팝업 데이터를 읽을 수 없습니다.', 422);
}

$input = popup_input($payload);
$image = popup_uploaded_image();

try {
    popup_update($id, $input, $image, (string) $admin['id']);

    json_ok(['id' => $id]);
} catch (Throwable $e) {
    // 원인을 서버 오류 로그에 남깁니다 (화면에는 노출하지 않습니다).
    error_log('[popup update] ' . $e->getMessage());

    json_error('팝업을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
}
