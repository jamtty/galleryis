<?php
/**
 * GET /backend/api/settings/public.php   (공개 — 인증 없음)
 *
 * 공개 화면에서 쓰는 설정값만 돌려줍니다. (정의에서 'public' => true 인 키)
 * 테이블이 아직 없어도 기본값을 돌려주므로 공개 화면이 깨지지 않습니다.
 *
 * 응답 data: { page_notices_lede: "...", page_exhibitions_lede: "...", ... }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/setting.php';
require_once __DIR__ . '/../../lib/response.php';

try {
    json_ok(setting_public_values());
} catch (Throwable $e) {
    error_log('[setting public] ' . $e->getMessage());

    json_error('사이트 설정을 불러오지 못했습니다.', 500);
}
