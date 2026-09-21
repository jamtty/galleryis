<?php
/**
 * POST /backend/api/notices/update.php   (관리자 전용, multipart/form-data)
 *
 *   id      : wr_id
 *   payload : JSON (create.php 와 같은 구조)
 *   keep[]  : 남길 첨부의 bf_no (보내지 않으면 첨부 전체 삭제)
 *   files[] : 새로 올린 파일첨부
 *
 * 응답 data: { id }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/notice.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 수정할 수 있습니다.
current_admin();
require_post();

if (!notice_table_exists()) {
    json_error(notice_missing_table_message(), 500);
}

$wrId = isset($_POST['id']) ? (int) $_POST['id'] : 0;

if ($wrId <= 0) {
    json_error('수정할 공지 번호가 없습니다.', 422);
}

$payload = json_decode(isset($_POST['payload']) ? (string) $_POST['payload'] : '', true);

if (!is_array($payload)) {
    json_error(
        '공지 데이터를 읽을 수 없습니다. 본문에 사진을 붙여넣으면 요청이 너무 커져 서버가 거절합니다 — 사진은 에디터의 사진 버튼으로 올려 주세요.',
        422
    );
}

$input = notice_input($payload);
$uploads = notice_uploaded_files();

// 상단 고정은 게시판 설정(g4_board)이 있어야 저장됩니다.
if ($input['pinned'] && !notice_board_configured()) {
    json_error('공지 고정을 쓸 수 없습니다. g4_board 에 notice 게시판 설정이 필요합니다.', 422);
}

$keep = [];

if (isset($_POST['keep']) && is_array($_POST['keep'])) {
    $keep = array_map('intval', $_POST['keep']);
}

try {
    $pdo = db();

    $check = $pdo->prepare('SELECT wr_id FROM ' . NOTICE_TABLE . ' WHERE wr_id = ?');
    $check->execute([$wrId]);

    if (!$check->fetchColumn()) {
        json_error('해당 공지를 찾을 수 없습니다.', 404);
    }

    // 남길 첨부 + 새 첨부의 개수 · 용량을 확인합니다.
    $keptCount = 0;
    $keptSize = 0;

    foreach (notice_files_for($wrId) as $file) {
        if (in_array((int) $file['no'], $keep, true)) {
            $keptCount++;
            $keptSize += (int) $file['size'];
        }
    }

    $newSize = 0;

    foreach ($uploads as $file) {
        $newSize += (int) $file['size'];
    }

    if ($keptCount + count($uploads) > NOTICE_FILE_LIMIT['max']) {
        json_error('파일첨부: ' . NOTICE_FILE_LIMIT['max'] . '개까지만 첨부할 수 있습니다.', 422);
    }

    if ($keptSize + $newSize > NOTICE_FILE_LIMIT['total']) {
        json_error(
            '파일첨부: 전체 용량은 ' . round(NOTICE_FILE_LIMIT['total'] / 1048576) . 'MB 이하만 가능합니다.',
            422
        );
    }

    $pdo->beginTransaction();
    $saved = [];

    try {
        notice_prune_files($pdo, $wrId, $keep);
        $saved = notice_save_files($pdo, $wrId, $uploads);
        notice_update($wrId, $input);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();

        // DB 는 되돌렸지만 이미 옮겨 둔 파일이 있으면 함께 지웁니다.
        upload_cleanup($saved);

        throw $e;
    }

    // 상단 고정/해제 (g4_board.bo_notice)
    notice_set_pinned($wrId, (bool) $input['pinned']);

    json_ok(['id' => $wrId]);
} catch (Throwable $e) {
    // 원인을 서버 오류 로그에 남깁니다 (화면에는 노출하지 않습니다).
    error_log('[notice update] ' . $e->getMessage());

    json_error('공지를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
}
