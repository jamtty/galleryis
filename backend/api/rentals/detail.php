<?php
/**
 * GET /backend/api/rentals/detail.php?id=1234   (관리자 전용)
 *
 * 대관 신청 1건의 전체 내용과 첨부파일 목록을 돌려줍니다.
 * 관리자 수정 화면에서 신청서를 그대로 채우는 데 씁니다.
 *
 * 응답 data: {
 *   id, hallId, hall, weekStart, weekEnd,
 *   applicant: { name, email, phone, postcode, address1, address2 },
 *   exhibition: { kind, kind_label, genre, memo, artist_count, work_count },
 *   files: { bio: [{no, name, size, url}], portfolio: [...] },
 *   status, createdAt
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';

current_admin();

$wrId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($wrId <= 0) {
    json_error('신청 번호가 없습니다.', 422);
}

try {
    $stmt = db()->prepare('SELECT * FROM ' . RENTAL_TABLE . ' WHERE wr_id = ?');
    $stmt->execute([$wrId]);
    $row = $stmt->fetch();

    if (!$row) {
        json_error('해당 신청을 찾을 수 없습니다.', 404);
    }

    $address = explode('|', (string) $row['wr_9']);
    $startTs = (int) $row['wr_11'];
    $endTs = (int) $row['wr_12'];

    // 레거시 행은 wr_email 이 비어 있고 wr_1 에 "아이디|도메인|" 형태로 들어 있습니다.
    $email = trim((string) $row['wr_email']);

    if ($email === '') {
        $email = rental_email_from_pipe((string) $row['wr_1']);
    }

    // rt_* 컴럼이 아직 없으면 메모에 남은 요약 줄에서 읽어 옵니다.
    $parsed = rental_parse_detail((string) $row['wr_3']);

    $artistCount = (isset($row['rt_artist_cnt']) && (int) $row['rt_artist_cnt'] > 0)
        ? (int) $row['rt_artist_cnt']
        : $parsed['artist_count'];

    $workCount = (isset($row['rt_work_cnt']) && (int) $row['rt_work_cnt'] > 0)
        ? (int) $row['rt_work_cnt']
        : $parsed['work_count'];

    $files = ['bio' => [], 'portfolio' => []];

    foreach (rental_files_for($wrId) as $file) {
        $files[$file['group']][] = [
            'no' => $file['no'],
            'name' => $file['source'] !== '' ? $file['source'] : $file['file'],
            'stored' => $file['file'],
            'size' => $file['size'],
            'url' => rental_file_url($wrId, $file['file']),
        ];
    }

    json_ok([
        'id' => $wrId,
        'hallId' => rental_hall_id((string) $row['wr_8']),
        'hall' => (string) $row['wr_8'],
        'weekStart' => $startTs > 0 ? date('Y-m-d', $startTs) : '',
        'weekEnd' => $endTs > 0 ? date('Y-m-d', $endTs) : '',
        'applicant' => [
            'name' => rental_applicant_name($row['wr_name'], $row['wr_subject']),
            'email' => $email,
            'phone' => rental_phone_from_pipe((string) $row['wr_10']),
            'postcode' => isset($address[0]) ? $address[0] : '',
            'address1' => isset($address[1]) ? $address[1] : '',
            'address2' => isset($address[2]) ? $address[2] : '',
        ],
        'exhibition' => [
            'kind' => rental_kind_key((string) $row['wr_5']),
            'kind_label' => (string) $row['wr_5'],
            'genre' => trim((string) $row['wr_2'], '|'),
            'memo' => rental_memo_only((string) $row['wr_3']),
            'artist_count' => $artistCount,
            'work_count' => $workCount,
        ],
        'files' => $files,
        'status' => ((string) $row['wr_13'] === '2') ? 'approved' : 'pending',
        'createdAt' => (string) $row['wr_datetime'],
    ]);
} catch (Throwable $e) {
    json_error('신청 내용을 불러오지 못했습니다.', 500);
}
