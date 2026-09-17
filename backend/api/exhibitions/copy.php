<?php
/**
 * POST /backend/api/exhibitions/copy.php   (관리자 전용)
 *
 *   { "id": 1 }
 *
 * 전시 1건을 복사합니다.
 *   - 제목 뒤에 ` (복사)` 를 붙입니다.
 *   - 작품 이미지도 파일까지 복제합니다. (원본과 별개 파일 → 한쪽을 지워도 안전)
 *   - 복사본은 **미사용(비노출)** 으로 만들어, 확인 후 공개하게 합니다.
 *
 * 응답 data: { id }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/exhibition.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 복사할 수 있습니다.
$admin = current_admin();
require_post();

if (!exhibition_table_exists(EXHIBITION_TABLE)) {
    json_error(exhibition_missing_table_message(), 500);
}

// 분류 컴럼은 마이그레이션으로 추가됩니다. (sql/exhibition_status_column.sql)
if (!exhibition_has_column('ex_status')) {
    json_error(
        '분류 컴럼이 없습니다. phpMyAdmin 에서 backend/sql/exhibition_status_column.sql 을 실행해 주세요.',
        500
    );
}

$payload = read_json_body();
$exId = isset($payload['id']) ? (int) $payload['id'] : 0;

if ($exId <= 0) {
    json_error('복사할 전시 번호가 없습니다.', 422);
}

try {
    $newId = exhibition_copy($exId, (string) $admin['id']);

    json_ok(['id' => $newId]);
} catch (Throwable $e) {
    // 원인을 서버 오류 로그에 남깁니다 (화면에는 노출하지 않습니다).
    error_log('[exhibition copy] ' . $e->getMessage());

    json_error('전시를 복사하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
}
