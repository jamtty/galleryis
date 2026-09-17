<?php
/**
 * GET /backend/api/notices/public_list.php   (공개 — 인증 없음)
 *
 * 공개 소식 목록입니다. 관리자 목록과 같은 정렬을 씁니다.
 *   - 상단 고정 공지(g4_board.bo_notice)가 맨 위
 *   - 나머지는 최신순 (wr_id DESC)
 *
 *   page    : 1부터 (기본 1)
 *   size    : 기본 10 (최대 50)
 *   keyword : 제목 · 내용 검색
 *
 * 응답 data: { items: [...], totalCount, totalPages, page, size }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/notice.php';
require_once __DIR__ . '/../../lib/response.php';

$empty = [
    'items' => [],
    'totalCount' => 0,
    'totalPages' => 1,
    'page' => 1,
    'size' => 10,
];

// 아직 게시판이 없으면 빈 목록으로 조용히 넘어갑니다. (공개 화면이 깨지지 않게)
if (!notice_table_exists()) {
    json_ok($empty);
}

$size = isset($_GET['size']) ? (int) $_GET['size'] : 10;
$size = $size < 1 ? 10 : min(50, $size);

try {
    $list = notice_list([
        'page' => isset($_GET['page']) ? (int) $_GET['page'] : 1,
        'size' => $size,
        'keyword' => isset($_GET['keyword']) ? (string) $_GET['keyword'] : '',
    ]);
} catch (Throwable $e) {
    error_log('[notice public list] ' . $e->getMessage());

    json_error('소식 목록을 불러오지 못했습니다.', 500);
}

// 고정 설정 원본 같은 관리자용 값은 빼고 돌려줍니다.
json_ok([
    'items' => $list['items'],
    'totalCount' => $list['totalCount'],
    'totalPages' => $list['totalPages'],
    'page' => $list['page'],
    'size' => $list['size'],
]);
