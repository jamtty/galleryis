<?php
/**
 * POST /backend/api/exhibitions/update.php   (관리자 전용, multipart/form-data)
 *
 *   id      : ex_id
 *   payload : JSON (create.php 와 같은 구조)
 *   keep[]  : 남길 작품 이미지의 ef_id (보내지 않으면 작품 이미지 전체 삭제)
 *   files[] : 새로 올린 작품 이미지 (최대 8개 · 개당 10MB · 전체 80MB)
 *
 * 응답 data: { id }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/exhibition.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 수정할 수 있습니다.
current_admin();
require_post();

if (!exhibition_table_exists(EXHIBITION_TABLE)) {
    json_error(exhibition_missing_table_message(), 500);
}

$exId = isset($_POST['id']) ? (int) $_POST['id'] : 0;

if ($exId <= 0) {
    json_error('수정할 전시 번호가 없습니다.', 422);
}

$payload = json_decode(isset($_POST['payload']) ? (string) $_POST['payload'] : '', true);

if (!is_array($payload)) {
    json_error('전시 데이터를 읽을 수 없습니다.', 422);
}

$input = exhibition_input($payload);
$uploads = exhibition_uploaded_files();

$keep = [];

if (isset($_POST['keep']) && is_array($_POST['keep'])) {
    $keep = array_map('intval', $_POST['keep']);
}

try {
    $pdo = db();

    $check = $pdo->prepare('SELECT ex_id FROM ' . EXHIBITION_TABLE . ' WHERE ex_id = ?');
    $check->execute([$exId]);

    if (!$check->fetchColumn()) {
        json_error('해당 전시를 찾을 수 없습니다.', 404);
    }

    // 남길 이미지 + 새 이미지의 개수 · 용량을 확인합니다.
    $keptCount = 0;
    $keptSize = 0;

    foreach (exhibition_files_for($exId) as $file) {
        if (in_array((int) $file['id'], $keep, true)) {
            $keptCount++;
            $keptSize += (int) $file['size'];
        }
    }

    $newSize = 0;

    foreach ($uploads as $file) {
        $newSize += (int) $file['size'];
    }

    if ($keptCount + count($uploads) > EXHIBITION_FILE_LIMIT['max']) {
        json_error('작품등록: ' . EXHIBITION_FILE_LIMIT['max'] . '개까지만 올릴 수 있습니다.', 422);
    }

    if ($keptSize + $newSize > EXHIBITION_FILE_LIMIT['total']) {
        json_error(
            '작품등록: 전체 용량은 ' . round(EXHIBITION_FILE_LIMIT['total'] / 1048576) . 'MB 이하만 가능합니다.',
            422
        );
    }

    $pdo->beginTransaction();
    $saved = [];

    try {
        exhibition_prune_files($pdo, $exId, $keep);
        $saved = exhibition_save_files($pdo, $exId, $uploads);
        exhibition_update($exId, $input);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();

        // DB 는 되돌렸지만 이미 옮겨 둔 파일이 있으면 함께 지웁니다.
        upload_cleanup($saved);

        throw $e;
    }

    // 고른 분류가 날짜와 어긋나면 바로잡습니다.
    exhibition_sync_statuses();

    json_ok(['id' => $exId]);
} catch (Throwable $e) {
    json_error('전시를 수정하지 못했습니다.', 500);
}
