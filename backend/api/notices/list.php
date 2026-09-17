<?php
/**
 * GET /backend/api/notices/list.php   (관리자 전용)
 *
 *   page    : 1부터 (기본 1)
 *   size    : 기본 15
 *   keyword : 제목 · 내용 검색
 *   from/to : 작성일 기간 (YYYY-MM-DD)
 *
 * 응답 data: { items: [...], totalCount, totalPages, page, size }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/notice.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 조회 가능
current_admin();

if (!notice_table_exists()) {
    json_error(notice_missing_table_message(), 500);
}

try {
    json_ok(notice_list([
        'page' => isset($_GET['page']) ? (int) $_GET['page'] : 1,
        'size' => isset($_GET['size']) ? (int) $_GET['size'] : 15,
        'keyword' => isset($_GET['keyword']) ? (string) $_GET['keyword'] : '',
        'from' => isset($_GET['from']) ? (string) $_GET['from'] : '',
        'to' => isset($_GET['to']) ? (string) $_GET['to'] : '',
    ]));
} catch (Throwable $e) {
    json_error('공지 목록을 불러오지 못했습니다.', 500);
}
