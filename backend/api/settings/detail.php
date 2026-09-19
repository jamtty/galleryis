<?php
/**
 * GET /backend/api/settings/detail.php   (관리자 전용)
 *
 * 관리자 [개인정보처리방침] 화면이 그대로 그릴 수 있도록
 * 그룹 · 입력칸 정의 · 현재 값을 함께 돌려줍니다.
 *
 * 응답 data: {
 *   groups: [
 *     { key, label, help, fields: [ { key, label, type, hint, max, required, value } ] }
 *   ]
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/setting.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 볼 수 있습니다.
current_admin();

if (!setting_table_exists()) {
    json_error(setting_missing_table_message(), 500);
}

try {
    json_ok(['groups' => setting_groups()]);
} catch (Throwable $e) {
    error_log('[setting detail] ' . $e->getMessage());

    json_error('설정을 불러오지 못했습니다.', 500);
}
