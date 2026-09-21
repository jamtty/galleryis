<?php
/**
 * POST /backend/api/notices/editor_image.php   (관리자 전용, multipart/form-data)
 *
 *   image : 공지 내용 에디터에서 올린 이미지 1장
 *           (jpg · jpeg · png · gif · webp / 10MB 이하)
 *
 * 응답 data: { url, name, width, height }
 *
 * 본문에 base64(data URL) 로 이미지를 넣으면 저장 요청이 수 MB 가 되어 서버가
 * 통째로 거절합니다(422 "공지 데이터를 읽을 수 없습니다"). 그래서 이미지는
 * 파일로 올리고 **주소만** 본문에 넣습니다.
 *
 * ⚠ 등록을 취소하면 이 이미지는 서버에 남습니다. (공지에 저장되지 않은 파일)
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/notice.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 업로드 가능
current_admin();
require_post();

$file = notice_uploaded_editor_image();
$dir = upload_dir(NOTICE_EDITOR_DIR);

if ($dir === null) {
    json_error('이미지를 저장할 폴더를 만들 수 없습니다. 서버 권한을 확인해 주세요.', 500);
}

$moved = upload_move_file($file, $dir);

if ($moved === null) {
    json_error('이미지를 저장하지 못했습니다. 다시 시도해 주세요.', 500);
}

$url = upload_file_url(NOTICE_EDITOR_DIR, $moved['file']);

if ($url === '') {
    json_error('이미지 주소를 만들지 못했습니다.', 500);
}

json_ok([
    'url' => $url,
    'name' => (string) $file['name'],
    'width' => $moved['width'],
    'height' => $moved['height'],
]);
