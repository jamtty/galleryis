<?php
/**
 * POST /backend/api/exhibitions/create.php   (관리자 전용, multipart/form-data)
 *
 *   payload : JSON 문자열
 *             {
 *               title, status,              // status: 'current'(현재전시) | 'upcoming'(예정전시)
 *                                           //  날짜가 지나면 'past'(지난전시) 로 자동 변경됩니다.
 *               place, artist,
 *               start_date, end_date,        // YYYY-MM-DD
 *               overview, bio,               // 에디터 본문 (HTML)
 *               use_yn                       // 'Y' | 'N' (기본 Y)
 *             }
 *   files[] : 작품 이미지 (선택, 최대 8개 · 개당 10MB · 전체 80MB)
 *
 * 응답 data: { id: ex_id }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/exhibition.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 등록 가능
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

$payload = json_decode(isset($_POST['payload']) ? (string) $_POST['payload'] : '', true);

if (!is_array($payload)) {
    json_error('전시 데이터를 읽을 수 없습니다.', 422);
}

$input = exhibition_input($payload);
$files = exhibition_uploaded_files();

try {
    $exId = exhibition_create($input, $files, (string) $admin['id']);

    // 고른 분류가 날짜와 어긋나면(예: 시작일이 지난 전시를 예정전시로 등록)
    // 저장 직후 날짜 기준으로 자동 분류합니다.
    exhibition_sync_statuses();

    json_ok(['id' => $exId]);
} catch (Throwable $e) {
    json_error('전시를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
}
