<?php
/**
 * GET /backend/api/translate/status.php   (관리자 전용)
 *
 * 영문 번역(기계 번역) 현황 — 대상별로 몇 건이 번역되었고 몇 건이 남았는지.
 *
 * 응답 data: {
 *   enabled: true, provider: "google", providerLabel: "Google Cloud Translation",
 *   tableReady: true, message: "",
 *   targets: [ { entity, label, items, total, done, missing, stale } ]
 * }
 *
 *   items   항목 수 (전시 12편 · 공지 40건 …)
 *   total   번역할 값의 수 (전시 1편당 전시명·작가명·개요·약력 4개)
 *   done    지금 원문과 맞는 번역
 *   missing 아직 번역이 없는 것
 *   stale   번역해 두었는데 그 뒤에 한국어 원문이 바뀐 것
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/translation.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 볼 수 있습니다.
current_admin();

$ready = translation_table_exists();

try {
    $targets = $ready ? translation_status_all() : [];
} catch (Throwable $e) {
    error_log('[translate status] ' . $e->getMessage());

    json_error('번역 현황을 불러오지 못했습니다.', 500);
}

json_ok([
    'enabled' => translate_enabled(),
    'provider' => translate_settings()['provider'],
    'providerLabel' => translate_provider_label(),
    'tableReady' => $ready,
    'message' => $ready ? '' : translation_missing_table_message(),
    'targets' => $targets,
]);
