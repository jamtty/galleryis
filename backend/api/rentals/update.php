<?php
/**
 * POST /backend/api/rentals/update.php   (관리자 전용, multipart/form-data)
 *
 *   id         : wr_id
 *   payload    : JSON (bookings.php 와 같은 구조)
 *   keep[]     : 남길 첨부의 bf_no (보내지 않으면 첨부 전체 삭제)
 *   bio[]      : 새로 올린 약력 파일
 *   portfolio[]: 새로 올린 포트폴리오 이미지
 *
 * 응답 data: { id }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';
require_once __DIR__ . '/booking_input.php';

current_admin();
require_post();

$wrId = isset($_POST['id']) ? (int) $_POST['id'] : 0;

if ($wrId <= 0) {
    json_error('수정할 신청 번호가 없습니다.', 422);
}

$payload = json_decode(isset($_POST['payload']) ? (string) $_POST['payload'] : '', true);

if (!is_array($payload)) {
    json_error('신청 데이터를 읽을 수 없습니다.', 422);
}

// 대리 접수 행인지 먼저 봅니다 — 그런 행은 신청자 정보·장르가 비어 있을 수
// 있어서, 입력 검증이 그것을 알고 있어야 합니다. (전화로 주만 잡아 둔 건)
$rowStmt = db()->prepare('SELECT * FROM ' . RENTAL_TABLE . ' WHERE wr_id = ?');
$rowStmt->execute([$wrId]);
$row = $rowStmt->fetch();

if (!$row) {
    json_error('해당 신청을 찾을 수 없습니다.', 404);
}

$isDesk = rental_is_desk_row($row);

// 레거시 신청서에는 작품 수·참여작가수가 없으므로 필수로 보지 않습니다.
$input = rental_booking_input($payload, false, $isDesk);

// 대리 접수 건에서 메모만 고쳐 저장한 경우처럼 신청자 이름이 없으면,
// 관리자 목록의 '신청자' 열에 남는 이름표(wr_subject)를 그대로 둡니다.
if ($isDesk && trim((string) $input['name']) === '') {
    $input['title'] = '대리 접수';
}

$uploads = rental_booking_uploads();

$keep = [];

if (isset($_POST['keep']) && is_array($_POST['keep'])) {
    $keep = array_map('intval', $_POST['keep']);
}

try {
    $pdo = db();

    // 남길 첨부와 새 첨부를 합쳐 입력란별 개수를 넘지 않는지 확인합니다.
    $existing = ['bio' => 0, 'portfolio' => 0];

    foreach (rental_files_for($wrId) as $file) {
        if (in_array($file['no'], $keep, true)) {
            $existing[$file['group']]++;
        }
    }

    $added = ['bio' => 0, 'portfolio' => 0];

    foreach ($uploads as $file) {
        $added[rental_file_group((string) $file['name'])]++;
    }

    foreach (RENTAL_FILE_LIMITS as $key => $limit) {
        if ($existing[$key] + $added[$key] > $limit['max']) {
            json_error($limit['label'] . ': ' . $limit['max'] . '개까지만 첨부할 수 있습니다.', 422);
        }
    }

    // 기간 · 전시장이 바뀐 경우에만 다른 신청과 겹치는지 다시 봅니다.
    $moved = ((string) $row['wr_8'] !== (string) $input['hall'])
        || (date('Y-m-d', (int) $row['wr_11']) !== (string) $input['week_start']);

    if ($moved && rental_is_taken($input['hall_id'], $input['week_start'])) {
        json_error('해당 기간에 이미 다른 신청이 있습니다.', 409);
    }

    $pdo->beginTransaction();
    $savedFiles = [];

    try {
        rental_prune_attachments($pdo, $wrId, $keep);
        $savedFiles = rental_save_attachments($pdo, $wrId, $uploads);

        // 첨부 수까지 반영해 관리자 확인용 메모를 다시 만듭니다.
        $input['memo'] = rental_memo_text(
            $input,
            $existing['bio'] + $existing['portfolio'] + count($savedFiles)
        );

        rental_update_booking($pdo, $wrId, rental_update_values($input));

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        rental_cleanup_uploaded($savedFiles);
        throw $e;
    }

    json_ok(['id' => $wrId]);
} catch (Throwable $e) {
    json_error('신청을 수정하지 못했습니다.', 500);
}
