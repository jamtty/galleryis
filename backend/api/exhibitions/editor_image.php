<?php
/**
 * POST /backend/api/exhibitions/editor_image.php   (관리자 전용, multipart/form-data)
 *
 *   image : 전시개요 · 약력 에디터에서 올린 이미지 1장
 *           (jpg · jpeg · png · gif · webp / 10MB 이하)
 *
 * 응답 data: { url, name, width, height }
 *
 * ⚠ 등록을 취소하면 이 이미지는 서버에 남습니다. (전시에 저장되지 않은 파일)
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/exhibition.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 업로드 가능
current_admin();
require_post();

$file = exhibition_uploaded_editor_image();
$dir = upload_dir(EXHIBITION_EDITOR_DIR);

if ($dir === null) {
    json_error('이미지를 저장할 폴더를 만들 수 없습니다. 서버 권한을 확인해 주세요.', 500);
}

$moved = upload_move_file($file, $dir);

if ($moved === null) {
    json_error('이미지를 저장하지 못했습니다. 다시 시도해 주세요.', 500);
}

$url = upload_file_url(EXHIBITION_EDITOR_DIR, $moved['file']);

if ($url === '') {
    json_error('이미지 주소를 만들지 못했습니다.', 500);
}

json_ok([
    'url' => $url,
    'name' => (string) $file['name'],
    'width' => $moved['width'],
    'height' => $moved['height'],
]);
