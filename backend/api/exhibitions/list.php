<?php
/**
 * GET /backend/api/exhibitions/list.php   (관리자 전용)
 *
 *   page    : 1부터 (기본 1)
 *   size    : 기본 15
 *   keyword : 전시회명 · 전시장소 · 작가명 검색
 *   use_yn  : '' (전체) | 'Y' | 'N'
 *   status  : '' (전체) | 'current' (현재전시) | 'upcoming' (예정전시) | 'past' (지난전시)
 *   from/to : 전시기간 검색 (YYYY-MM-DD) — 고른 기간과 겹치는 전시
 *
 * 응답 data: { items: [...], totalCount, totalPages, page, size }
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

try {
    json_ok(exhibition_list([
        'page' => isset($_GET['page']) ? (int) $_GET['page'] : 1,
        'size' => isset($_GET['size']) ? (int) $_GET['size'] : 15,
        'keyword' => isset($_GET['keyword']) ? (string) $_GET['keyword'] : '',
        'use_yn' => isset($_GET['use_yn']) ? (string) $_GET['use_yn'] : '',
        'status' => isset($_GET['status']) ? (string) $_GET['status'] : '',
        'from' => isset($_GET['from']) ? (string) $_GET['from'] : '',
        'to' => isset($_GET['to']) ? (string) $_GET['to'] : '',
    ]));
} catch (Throwable $e) {
    json_error('전시 목록을 불러오지 못했습니다.', 500);
}
