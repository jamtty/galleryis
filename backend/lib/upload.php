<?php
/**
 * 업로드 공통 헬퍼
 *
 * 대관(lib/rental.php) 과 같은 방식으로 파일을 보관합니다.
 *   1) 웹루트/uploads/{폴더}      — 지금 쓰는 평면 폴더
 *   2) backend/uploads/{폴더}     — 호스팅 정책상 1) 을 못 쓸 때
 *
 * 폴더 안에는 실행 방지 .htaccess 를 함께 둡니다.
 */
declare(strict_types=1);

/**
 * $_FILES 의 배열 구조를 평탄화합니다. (파일 여러 장)
 *
 * @param string $key
 * @return array<int, array>
 */
function upload_normalize_files($key)
{
    if (!isset($_FILES[$key])) {
        return [];
    }

    $entry = $_FILES[$key];

    if (!is_array($entry['name'])) {
        return [$entry];
    }

    $files = [];

    foreach ($entry['name'] as $index => $name) {
        $files[] = [
            'name' => $name,
            'type' => $entry['type'][$index],
            'tmp_name' => $entry['tmp_name'][$index],
            'error' => $entry['error'][$index],
            'size' => $entry['size'][$index],
        ];
    }

    return $files;
}

/**
 * 업로드 폴더의 최상위 (웹루트/uploads 또는 backend/uploads)
 *
 * @return string|null 쓸 수 있는 폴더가 없으면 null
 */
function upload_root()
{
    static $root = false;

    if ($root !== false) {
        return $root;
    }

    $root = null;

    $candidates = [
        // 웹루트/uploads
        dirname(__DIR__, 2) . '/uploads',
        // backend/uploads
        dirname(__DIR__) . '/uploads',
    ];

    foreach ($candidates as $path) {
        if (!is_dir($path) && !@mkdir($path, 0755, true) && !is_dir($path)) {
            continue;
        }

        if (is_writable($path)) {
            $root = $path;
            upload_guard_dir($path);
            break;
        }
    }

    return $root;
}

/**
 * 업로드 폴더에 실행 방지 .htaccess 를 둡니다. (없을 때만)
 *
 * @param string $dir
 * @return void
 */
function upload_guard_dir($dir)
{
    $htaccess = $dir . '/.htaccess';

    if (is_file($htaccess)) {
        return;
    }

    $rules = "Options -Indexes\n\n"
        . "<FilesMatch \"\\.(php|phtml|php3|php4|php5|php7|phps|pht|cgi|pl|py|sh|shtml)$\">\n"
        . "  <IfModule mod_authz_core.c>\n"
        . "    Require all denied\n"
        . "  </IfModule>\n"
        . "  <IfModule !mod_authz_core.c>\n"
        . "    Deny from all\n"
        . "  </IfModule>\n"
        . "</FilesMatch>\n";

    @file_put_contents($htaccess, $rules);
}

/**
 * 업로드 폴더 경로
 *
 * @param string $name   폴더 이름 ('exhibition', 'exhibition/editor' …)
 * @param bool   $create false 면 폴더를 만들지 않습니다 (조회할 때)
 * @return string|null
 */
function upload_dir($name, $create = true)
{
    $root = upload_root();

    if ($root === null) {
        return null;
    }

    $path = $root . '/' . trim((string) $name, '/');

    if (!is_dir($path)) {
        if (!$create) {
            return null;
        }

        if (!@mkdir($path, 0755, true) && !is_dir($path)) {
            return null;
        }
    }

    return $path;
}

/**
 * 업로드된 파일 1건을 폴더로 옮깁니다.
 *
 * @param array  $file $_FILES 항목
 * @param string $dir
 * @return array|null ['file' => 저장 파일명, 'size', 'width', 'height', 'is_image']
 */
function upload_move_file($file, $dir)
{
    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        return null;
    }

    $original = isset($file['name']) ? (string) $file['name'] : 'file';
    $extension = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));
    $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', (string) pathinfo($original, PATHINFO_FILENAME));
    $safe = trim((string) $safe, '_');

    if ($safe === '') {
        $safe = 'file';
    }

    $stored = sprintf(
        '%d_%s_%s%s',
        time(),
        substr(bin2hex(random_bytes(4)), 0, 8),
        $safe,
        $extension === '' ? '' : '.' . $extension
    );

    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $stored)) {
        return null;
    }

    $size = (int) filesize($dir . '/' . $stored);
    $width = 0;
    $height = 0;

    $imageSize = @getimagesize($dir . '/' . $stored);

    if (is_array($imageSize)) {
        $width = (int) $imageSize[0];
        $height = (int) $imageSize[1];
    }

    return [
        'file' => $stored,
        'size' => $size,
        'width' => $width,
        'height' => $height,
        'is_image' => $width > 0 && $height > 0,
    ];
}

/**
 * 저장에 실패했을 때 옮겨 둔 파일을 되돌립니다. (트랜잭션 롤백용)
 *
 * @param array<int, string> $paths
 * @return void
 */
function upload_cleanup(array $paths)
{
    foreach ($paths as $path) {
        if (is_file($path)) {
            @unlink($path);
        }
    }
}

/**
 * 요청이 들어온 서버 주소 (예: https://galleryiscom.mycafe24.com)
 *
 * @return string
 */
function request_origin()
{
    $host = isset($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : '';

    if ($host === '') {
        return '';
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    return ($https ? 'https://' : 'http://') . $host;
}

/**
 * 업로드 파일을 웹에서 부를 때 쓸 주소 (예: https://.../uploads)
 *
 * 개발 중에는 프론트(localhost)와 API(운영 서버)의 출처가 달라
 * 상대 경로가 깨지므로 절대 주소로 돌려줍니다.
 *
 * @return string 빈 문자열이면 URL 을 만들 수 없습니다.
 */
function upload_url_base()
{
    $root = upload_root();
    $origin = request_origin();

    if ($root === null || $origin === '') {
        return '';
    }

    return $origin . ($root === dirname(__DIR__, 2) . '/uploads' ? '/uploads' : '/backend/uploads');
}

/**
 * 저장된 파일 1건의 웹 주소
 *
 * @param string $name     폴더 이름
 * @param string $filename 저장 파일명
 * @return string 없으면 빈 문자열
 */
function upload_file_url($name, $filename)
{
    $dir = upload_dir($name, false);
    $base = upload_url_base();

    if ($dir === null || $base === '') {
        return '';
    }

    // basename 으로 경로 조작을 막습니다.
    $safe = basename((string) $filename);

    if ($safe === '' || !is_file($dir . '/' . $safe)) {
        return '';
    }

    return $base . '/' . trim((string) $name, '/') . '/' . rawurlencode($safe);
}

/**
 * 저장된 파일의 절대 경로
 *
 * @param string $name
 * @param string $filename
 * @return string 없으면 빈 문자열
 */
function upload_file_path($name, $filename)
{
    $dir = upload_dir($name, false);
    $safe = basename((string) $filename);

    if ($dir === null || $safe === '') {
        return '';
    }

    $path = $dir . '/' . $safe;

    return is_file($path) ? $path : '';
}
