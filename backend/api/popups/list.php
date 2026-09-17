<?php
/**
 * GET /backend/api/popups/list.php   (관리자 전용)
 *
 *   page    : 1부터 (기본 1)
 *   size    : 기본 15 (최대 100)
 *   keyword : 제목 검색
 *   use_yn  : '' 전체 | 'Y' | 'N'
 *   from/to : 노출기간 검색 (YYYY-MM-DD)
 *
 * 응답 data: { items: [...], totalCount, totalPages, page, size }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/popup.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 조회 가능
current_admin();

if (!popup_table_exists()) {
    json_error(popup_missing_table_message(), 500);
}

try {
    json_ok(popup_list([
        'page' => isset($_GET['page']) ? (int) $_GET['page'] : 1,
        'size' => isset($_GET['size']) ? (int) $_GET['size'] : 15,
        'keyword' => isset($_GET['keyword']) ? (string) $_GET['keyword'] : '',
        'use_yn' => isset($_GET['use_yn']) ? (string) $_GET['use_yn'] : '',
        'from' => isset($_GET['from']) ? (string) $_GET['from'] : '',
        'to' => isset($_GET['to']) ? (string) $_GET['to'] : '',
    ]));
} catch (Throwable $e) {
    error_log('[popup list] ' . $e->getMessage());

    json_error('팝업 목록을 불러오지 못했습니다.', 500);
}
