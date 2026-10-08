<?php
/**
 * POST /backend/api/translate/run.php   (관리자 전용, JSON)
 *
 *   { "target": "exhibition", "only": "missing", "limit": 5, "ref": "" }
 *
 *   target  exhibition · notice · hall · popup · setting
 *   only    missing(아직 없는 것 · 기본) · stale(원문이 바뀐 것) · all(전부 다시)
 *   limit   이번 요청에서 처리할 항목 수 (기본 5 · 최대 20)
 *   ref     이 번호만 다시 번역 (비우면 대상 전체)
 *
 * 관리자 화면이 남은 것이 없어질 때까지 이 주소를 되풀이해 부릅니다.
 * 한 번에 다 하지 않는 이유: 번역 서비스 응답을 기다리는 시간이 길어져
 * 웹서버가 요청을 끊으면 어디까지 했는지 알 수 없게 되기 때문입니다.
 *
 * 응답 data: { target, processed, done, skipped, failed, remaining, samples: [...] }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/translation.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 실행할 수 있습니다.
current_admin();
require_post();

$body = read_json_body();

$target = isset($body['target']) ? trim((string) $body['target']) : '';
$only = isset($body['only']) ? trim((string) $body['only']) : 'missing';
$limit = isset($body['limit']) ? (int) $body['limit'] : 5;
$ref = isset($body['ref']) ? trim((string) $body['ref']) : '';

if (!isset(TRANSLATION_ENTITY_LABELS[$target])) {
    json_error('번역 대상을 알 수 없습니다.', 422);
}

if (!in_array($only, ['missing', 'stale', 'all'], true)) {
    $only = 'missing';
}

if ($limit < 1) {
    $limit = 1;
}

if ($limit > 20) {
    $limit = 20;
}

if (!translate_enabled()) {
    json_error('번역 서비스 키가 없습니다. backend/config.php 의 translate 설정을 채워 주세요.', 422);
}

if (!translation_table_exists()) {
    json_error(translation_missing_table_message(), 500);
}

try {
    $pending = translation_pending($target, $only, $limit, $ref);
} catch (Throwable $e) {
    error_log('[translate run] ' . $e->getMessage());

    json_error('번역할 목록을 만들지 못했습니다.', 500);
}

$done = 0;
$skipped = 0;
$failed = 0;
$samples = [];

// only=all 은 "이 항목을 다시 번역" 입니다 — 원문이 같아도 새로 번역합니다.
$force = $only === 'all';

foreach ($pending as $item) {
    // 한 건씩 — 한 항목의 항목(title·overview…)은 한 번에 보냅니다.
    $result = translation_ensure($target, $item['ref'], $item['fields'], $force);

    $done += $result['done'];
    $skipped += $result['skipped'];
    $failed += $result['failed'];

    $samples[] = [
        'ref' => $item['ref'],
        'label' => $item['label'],
        'done' => $result['done'],
        'failed' => $result['failed'],
    ];
}

// 남은 수 — 방금 저장한 것은 캐시가 갱신되어 바로 반영됩니다.
$status = translation_status($target);

json_ok([
    'target' => $target,
    'processed' => count($pending),
    'done' => $done,
    'skipped' => $skipped,
    'failed' => $failed,
    'remaining' => (int) $status['missing'] + (int) $status['stale'],
    'samples' => $samples,
]);
