<?php
/**
 * POST /backend/api/exhibitions/delete.php   (관리자 전용)
 *
 *   { "id": 3 }            또는
 *   { "ids": [3, 4] }      (여러 건)
 *
 * 전시를 삭제합니다.
 *   - uploads/exhibition/ 안의 작품 이미지 파일
 *   - exhibition_file 행 (FK CASCADE)
 *   - exhibition 행
 *
 * ⚠ 되돌릴 수 없으므로 관리자 화면에서 확인 절차를 거쳐 호출하세요.
 * ※ 에디터 본문에 넣은 이미지(uploads/exhibition/editor)는 남습니다.
 *
 * 응답 data: { deleted: 삭제한 건수, files: 지운 파일 수 }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/exhibition.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 삭제할 수 있습니다.
current_admin();
require_post();

if (!exhibition_table_exists(EXHIBITION_TABLE)) {
    json_error(exhibition_missing_table_message(), 500);
}

$payload = read_json_body();
$ids = [];

if (isset($payload['ids']) && is_array($payload['ids'])) {
    $ids = array_map('intval', $payload['ids']);
} elseif (isset($payload['id'])) {
    $ids = [(int) $payload['id']];
}

$ids = array_values(array_filter($ids, function ($id) {
    return $id > 0;
}));

if (!$ids) {
    json_error('삭제할 전시 번호가 없습니다.', 422);
}

try {
    $deleted = 0;
    $files = 0;

    foreach ($ids as $id) {
        $result = exhibition_delete($id);

        $files += $result['files'];

        if ($result['post']) {
            $deleted++;
        }
    }

    if ($deleted === 0) {
        json_error('삭제할 전시를 찾을 수 없습니다.', 404);
    }

    json_ok(['deleted' => $deleted, 'files' => $files]);
} catch (Throwable $e) {
    json_error('전시를 삭제하지 못했습니다.', 500);
}
