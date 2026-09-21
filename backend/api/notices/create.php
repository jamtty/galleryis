<?php
/**
 * POST /backend/api/notices/create.php   (관리자 전용, multipart/form-data)
 *
 *   payload : JSON 문자열 { title, content, link1, link2, pinned }
 *             - content 는 에디터 본문(HTML)
 *             - pinned 는 'Y' | 'N' (상단 고정 — g4_board.bo_notice)
 *   files[] : 파일첨부 (선택, 최대 5개 · 개당 10MB · 전체 50MB)
 *
 * 응답 data: { id: wr_id }
 *
 * ⚠ 레거시 g4_write_notice 테이블(그누보드4)에 저장됩니다.
 *    첨부는 g4_board_file(bo_table='notice'), 실제 파일은 uploads/notice/ 입니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/notice.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 등록 가능
$admin = current_admin();
require_post();

if (!notice_table_exists()) {
    json_error(notice_missing_table_message(), 500);
}

$payload = json_decode(isset($_POST['payload']) ? (string) $_POST['payload'] : '', true);

if (!is_array($payload)) {
    json_error(
        '공지 데이터를 읽을 수 없습니다. 본문에 사진을 붙여넣으면 요청이 너무 커져 서버가 거절합니다 — 사진은 에디터의 사진 버튼으로 올려 주세요.',
        422
    );
}

$input = notice_input($payload);
$files = notice_uploaded_files();

// 상단 고정은 게시판 설정(g4_board)이 있어야 저장됩니다.
if ($input['pinned'] && !notice_board_configured()) {
    json_error('공지 고정을 쓸 수 없습니다. g4_board 에 notice 게시판 설정이 필요합니다.', 422);
}

try {
    $wrId = notice_create($input, $files, $admin);

    if ($input['pinned']) {
        notice_set_pinned($wrId, true);
    }

    json_ok(['id' => $wrId]);
} catch (Throwable $e) {
    // 원인을 서버 오류 로그에 남깁니다 (화면에는 노출하지 않습니다).
    error_log('[notice create] ' . $e->getMessage());

    json_error('공지를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
}
