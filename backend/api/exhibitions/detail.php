<?php
/**
 * GET /backend/api/exhibitions/detail.php?id=3   (관리자 전용)
 *
 * 전시 1건의 전체 내용과 작품 이미지 목록을 돌려줍니다.
 * 수정 화면(/admin/exhibitions/edit/:id)에서 씁니다.
 *
 * 응답 data: {
 *   id, title, status, statusLabel, place, artist, startDate, endDate,
 *   overview, bio, useYn, hit, createdAt,
 *   files: [ { id, no, name, ext, size, width, height, isImage, url } ]
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/exhibition.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 조회 가능
current_admin();

if (!exhibition_table_exists(EXHIBITION_TABLE)) {
    json_error(exhibition_missing_table_message(), 500);
}

// 수정 화면도 날짜 기준 분류가 최신이어야 합니다.
exhibition_sync_statuses();

$exId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($exId <= 0) {
    json_error('전시 번호가 없습니다.', 422);
}

try {
    $detail = exhibition_detail($exId);
} catch (Throwable $e) {
    json_error('전시를 불러오지 못했습니다.', 500);
}

if ($detail === null) {
    json_error('해당 전시를 찾을 수 없습니다.', 404);
}

json_ok($detail);
