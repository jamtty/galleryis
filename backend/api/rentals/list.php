<?php
/**
 * GET /backend/api/rentals/list.php   (관리자 전용)
 *
 *   page    : 1부터
 *   size    : 기본 15
 *   keyword : 신청자 · 이메일 검색
 *   status  : '' | '1'(심사중) | '2'(대관완료)
 *   hall    : '' | hall1 ~ hall4
 *   scope   : '' (전체) | 'applicant' (신청서가 있는 건만 — 일정·점유 행 제외)
 *   from/to : 신청일 기간 (YYYY-MM-DD)
 *
 * 응답 data: { items: [...], totalCount, totalPages, page, size }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 조회 가능
current_admin();

$page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
$size = isset($_GET['size']) ? min(100, max(1, (int) $_GET['size'])) : 15;
$keyword = isset($_GET['keyword']) ? trim((string) $_GET['keyword']) : '';
$status = isset($_GET['status']) ? (string) $_GET['status'] : '';
$hallId = isset($_GET['hall']) ? (string) $_GET['hall'] : '';
$scope = isset($_GET['scope']) ? (string) $_GET['scope'] : '';
$dateFrom = isset($_GET['from']) ? trim((string) $_GET['from']) : '';
$dateTo = isset($_GET['to']) ? trim((string) $_GET['to']) : '';

// 레거시 행은 wr_name 이 비어 있거나 '관리자' 이고 신청자명이 wr_subject 에 들어 있으므로
// wr_name 조건으로 걸러내지 않습니다. (1949건 중 wr_name 이 있는 행은 2건뿐)
$where = ['wr_is_comment = 0'];
$params = [];

if ($keyword !== '') {
    $where[] = '(wr_subject LIKE ? OR wr_name LIKE ? OR wr_email LIKE ?)';
    $like = '%' . $keyword . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

if ($status === '1' || $status === '2') {
    $where[] = 'wr_13 = ?';
    $params[] = $status;
}

if ($hallId !== '') {
    $label = rental_hall_label($hallId);

    if ($label !== null) {
        $where[] = 'wr_8 = ?';
        $params[] = $label;
    }
}

// 신청일 기간 (관리자 목록의 [신청일] 열 기준)
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    $where[] = 'wr_datetime >= ?';
    $params[] = $dateFrom . ' 00:00:00';
}

if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    $where[] = 'wr_datetime <= ?';
    $params[] = $dateTo . ' 23:59:59';
}

// 신청서가 있는 건만 — 레거시 일정·점유 행을 목록에서 숨깁니다.
// (대관 현황·중복 차단은 그대로 그 행들을 사용합니다)
if ($scope === 'applicant') {
    $where[] = "(wr_subject <> '' OR wr_name <> '' OR wr_email <> ''"
        . " OR wr_9 <> '' OR wr_10 <> ''"
        . ' OR EXISTS (SELECT 1 FROM g4_board_file f WHERE f.bo_table = ' . db()->quote(RENTAL_BOARD)
        . ' AND f.wr_id = ' . RENTAL_TABLE . '.wr_id))';
}

$whereSql = implode(' AND ', $where);

try {
    $pdo = db();

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM ' . RENTAL_TABLE . ' WHERE ' . $whereSql);
    $countStmt->execute($params);
    $totalCount = (int) $countStmt->fetchColumn();

    $totalPages = max(1, (int) ceil($totalCount / $size));
    $offset = ($page - 1) * $size;

    $columns = 'wr_id, wr_subject, wr_name, wr_email, wr_1, wr_2, wr_3, wr_5,'
        . ' wr_8, wr_9, wr_10, wr_11, wr_12, wr_13, wr_datetime';

    // 확인 컬럼은 마이그레이션 전일 수 있으므로 있을 때만 가져옵니다.
    $hasChecked = rental_has_column('rt_checked');

    if ($hasChecked) {
        $columns .= ', rt_checked';

        if (rental_has_column('rt_checked_at')) {
            $columns .= ', rt_checked_at';
        }
    }

    $sql = 'SELECT ' . $columns
        . ' FROM ' . RENTAL_TABLE
        . ' WHERE ' . $whereSql
        . ' ORDER BY wr_id DESC LIMIT ' . $size . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $items = [];

    foreach ($stmt->fetchAll() as $row) {
        $address = explode('|', (string) $row['wr_9']);
        $startTs = (int) $row['wr_11'];
        $endTs = (int) $row['wr_12'];

        $applicant = rental_applicant_name($row['wr_name'], $row['wr_subject']);
        $subject = trim((string) $row['wr_subject']);

        $items[] = [
            'id' => (int) $row['wr_id'],
            'title' => $subject,
            'applicant' => $applicant,
            'email' => (string) $row['wr_email'],
            'phone' => rental_phone_from_pipe((string) $row['wr_10']),
            'postcode' => isset($address[0]) ? $address[0] : '',
            'address1' => isset($address[1]) ? $address[1] : '',
            'address2' => isset($address[2]) ? $address[2] : '',
            'hall' => (string) $row['wr_8'],
            'hallId' => rental_hall_id((string) $row['wr_8']),
            'kind' => (string) $row['wr_5'],
            'genre' => trim((string) $row['wr_2'], '|'),
            'memo' => (string) $row['wr_3'],
            'periodStart' => $startTs > 0 ? date('Y-m-d', $startTs) : '',
            'periodEnd' => $endTs > 0 ? date('Y-m-d', $endTs) : '',
            'status' => ((string) $row['wr_13'] === '2') ? 'approved' : 'pending',
            'checked' => $hasChecked && (int) $row['rt_checked'] === 1,
            'checkedAt' => ($hasChecked && isset($row['rt_checked_at']))
                ? (string) $row['rt_checked_at']
                : '',
            'createdAt' => (string) $row['wr_datetime'],
        ];
    }

    json_ok([
        'items' => $items,
        'totalCount' => $totalCount,
        'totalPages' => $totalPages,
        'page' => $page,
        'size' => $size,
    ]);
} catch (Throwable $e) {
    json_error('대관 신청 목록을 불러오지 못했습니다.', 500);
}
