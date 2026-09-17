<?php
/**
 * POST /backend/api/settings/update.php   (관리자 전용, JSON)
 *
 *   { "values": { "page_notices_lede": "...", ... } }
 *
 * 정의(backend/lib/setting.php)에 있는 키만 저장하고, 모르는 키는 무시합니다.
 * 글자 수 제한을 넘거나 필수값이 비어 있으면 422 를 돌려줍니다.
 *
 * 응답 data: { saved: 3, values: { ...저장 후 전체 값... } }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/setting.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 수정할 수 있습니다.
$admin = current_admin();
require_post();

$body = read_json_body();
$values = isset($body['values']) && is_array($body['values']) ? $body['values'] : [];

if ($values === []) {
    json_error('저장할 설정값이 없습니다.', 422);
}

try {
    $saved = setting_update($values, (string) $admin['id']);

    json_ok([
        'saved' => count($saved),
        'values' => setting_values(),
    ]);
} catch (Throwable $e) {
    // 원인은 서버 오류 로그에만 남깁니다.
    error_log('[setting update] ' . $e->getMessage());

    json_error('환경설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
}
