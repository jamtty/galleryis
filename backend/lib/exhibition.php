<?php
/**
 * 전시 도메인 헬퍼
 *
 *   exhibition       — 전시 (제목 · 기간 · 장소 · 작가 · 전시개요 · 약력)
 *   exhibition_file  — 작품 이미지 (첨부파일)
 *
 * 실제 파일은 uploads/exhibition/ 에 평면으로 저장하고,
 * 에디터에 넣은 이미지는 uploads/exhibition/editor/ 에 따로 둡니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/upload.php';
require_once __DIR__ . '/html.php';

const EXHIBITION_TABLE = 'exhibition';
const EXHIBITION_FILE_TABLE = 'exhibition_file';

/** 첨부파일 폴더 (웹루트/uploads 아래) */
const EXHIBITION_UPLOAD_DIR = 'exhibition';

/** 에디터 본문에 넣은 이미지 폴더 */
const EXHIBITION_EDITOR_DIR = 'exhibition/editor';

/**
 * 분류 — apps/src/api/exhibitions.ts 의 EXHIBITION_STATUSES 와 동일하게 유지하세요.
 *
 *   current  현재전시 · upcoming 예정전시 · past 지난전시
 *
 * 전시 시작일이 되면 현재전시로, 종료일이 지나면 지난전시로 자동 변경됩니다.
 * (exhibition_sync_statuses() — 목록·등록 요청 때마다 한 번씩 돌립니다)
 */
const EXHIBITION_STATUSES = [
    'current' => '현재전시',
    'upcoming' => '예정전시',
    'past' => '지난전시',
];

/**
 * 등록할 때 고를 수 있는 분류 — 지난전시는 날짜가 지나면 자동으로 붙습니다.
 *
 * apps/src/api/exhibitions.ts 의 EXHIBITION_REGISTERED_STATUSES 와 동일하게 유지하세요.
 */
const EXHIBITION_REGISTERED_STATUSES = [
    'current' => '현재전시',
    'upcoming' => '예정전시',
];

/** 작품등록(이미지) 제한 — apps/src/api/exhibitions.ts 와 동일하게 유지하세요. */
const EXHIBITION_FILE_LIMIT = [
    'label' => '작품등록',
    'max' => 8,
    'size' => 10485760,  // 개당 10MB
    'total' => 83886080, // 전체 80MB
    'ext' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
];

/** 에디터 이미지 제한 — apps/src/api/exhibitions.ts 와 동일하게 유지하세요. */
const EXHIBITION_EDITOR_LIMIT = [
    'max' => 10485760, // 10MB
    'ext' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
];

/** 본문(HTML) 최대 길이 */
const EXHIBITION_HTML_MAX = 524288; // 512KB

/**
 * 테이블이 만들어져 있는지 확인합니다.
 *
 * @param string $table
 * @return bool
 */
function exhibition_table_exists($table)
{
    try {
        $stmt = db()->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES'
            . ' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
        );
        $stmt->execute([(string) $table]);

        return (int) $stmt->fetchColumn() > 0;
    } catch (Throwable $e) {
        return false;
    }
}

/** 테이블이 없을 때 안내 문구 */
function exhibition_missing_table_message()
{
    return '전시 테이블이 없습니다. phpMyAdmin 에서 backend/sql/exhibition.sql 을 실행해 주세요.';
}

/**
 * 컬럼이 있는지 확인합니다. (마이그레이션 전 서버 대비)
 *
 * @param string $column
 * @return bool
 */
function exhibition_has_column($column)
{
    static $cache = [];

    $column = (string) $column;

    if (array_key_exists($column, $cache)) {
        return $cache[$column];
    }

    $cache[$column] = false;

    try {
        $stmt = db()->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS'
            . ' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $stmt->execute([EXHIBITION_TABLE, $column]);

        $cache[$column] = (int) $stmt->fetchColumn() > 0;
    } catch (Throwable $e) {
        $cache[$column] = false;
    }

    return $cache[$column];
}

/**
 * $_FILES 의 배열 구조를 평탄화합니다.
 *
 * @param string $key
 * @return array<int, array>
 */
function exhibition_normalize_files($key)
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
 * 업로드 오류 코드를 사람이 읽을 수 있는 문구로 바꿉니다.
 *
 * @param int $error
 * @return string
 */
function exhibition_upload_error_text($error)
{
    switch ((int) $error) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return '파일 용량이 너무 큽니다.';
        case UPLOAD_ERR_PARTIAL:
            return '파일이 일부만 올라갔습니다. 다시 시도해 주세요.';
        case UPLOAD_ERR_NO_TMP_DIR:
        case UPLOAD_ERR_CANT_WRITE:
            return '서버가 파일을 저장하지 못했습니다.';
        default:
            return '파일을 올리지 못했습니다. 다시 시도해 주세요.';
    }
}

/**
 * 작품 이미지(files[])를 검증해 평탄화된 목록으로 돌려줍니다.
 *
 * @return array<int, array>
 */
function exhibition_uploaded_files()
{
    $accepted = [];
    $totalSize = 0;

    foreach (exhibition_normalize_files('files') as $file) {
        $error = (int) $file['error'];

        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;
        }

        if ($error !== UPLOAD_ERR_OK) {
            json_error('작품등록: ' . exhibition_upload_error_text($error), 422);
        }

        $original = (string) $file['name'];
        $extension = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));

        if (!in_array($extension, EXHIBITION_FILE_LIMIT['ext'], true)) {
            json_error($original . ': 올릴 수 없는 형식입니다.', 422);
        }

        if ((int) $file['size'] > EXHIBITION_FILE_LIMIT['size']) {
            json_error($original . ': 10MB 이하만 올릴 수 있습니다.', 422);
        }

        // 확장자만 이미지인 파일을 걸러냅니다.
        if (@getimagesize((string) $file['tmp_name']) === false) {
            json_error($original . ': 이미지 파일이 아닙니다.', 422);
        }

        $totalSize += (int) $file['size'];

        if ($totalSize > EXHIBITION_FILE_LIMIT['total']) {
            json_error('작품등록: 전체 용량은 80MB 이하만 가능합니다.', 422);
        }

        $accepted[] = $file;

        if (count($accepted) > EXHIBITION_FILE_LIMIT['max']) {
            json_error('작품등록: ' . EXHIBITION_FILE_LIMIT['max'] . '개까지만 올릴 수 있습니다.', 422);
        }
    }

    return $accepted;
}

/**
 * 에디터에서 올린 이미지 1건을 검증합니다. (editor_image.php)
 *
 * @return array $_FILES 항목
 */
function exhibition_uploaded_editor_image()
{
    $files = exhibition_normalize_files('image');

    if (count($files) === 0) {
        json_error('올릴 이미지가 없습니다.', 422);
    }

    $file = $files[0];
    $error = (int) $file['error'];

    if ($error === UPLOAD_ERR_NO_FILE) {
        json_error('올릴 이미지가 없습니다.', 422);
    }

    if ($error !== UPLOAD_ERR_OK) {
        json_error('이미지: ' . exhibition_upload_error_text($error), 422);
    }

    $original = (string) $file['name'];
    $extension = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));

    if (!in_array($extension, EXHIBITION_EDITOR_LIMIT['ext'], true)) {
        json_error('이미지는 jpg · png · gif · webp 만 올릴 수 있습니다.', 422);
    }

    if ((int) $file['size'] > EXHIBITION_EDITOR_LIMIT['max']) {
        json_error('이미지는 10MB 이하만 올릴 수 있습니다.', 422);
    }

    // 확장자만 이미지인 파일을 걸러냅니다.
    if (@getimagesize((string) $file['tmp_name']) === false) {
        json_error('이미지 파일이 아닙니다.', 422);
    }

    return $file;
}

/**
 * 에디터 본문(HTML)에서 위험한 태그·속성을 걷어냅니다.
 *
 * (실제 처리는 lib/html.php 의 html_clean_posted — 공지와 공유)
 *
 * @param string $html
 * @return string
 */
function exhibition_clean_html($html)
{
    return html_clean_posted($html, EXHIBITION_HTML_MAX);
}

/**
 * 날짜 기준 분류 계산식 (SQL)
 *
 *   오늘 > 종료일  →  past      (지난전시)
 *   오늘 < 시작일  →  upcoming  (예정전시)
 *   그 외        →  current   (현재전시)
 *
 * @return string
 */
function exhibition_status_case_sql()
{
    $pdo = db();

    return 'CASE'
        . ' WHEN ex_end_date IS NOT NULL AND ex_end_date < CURDATE() THEN ' . $pdo->quote('past')
        . ' WHEN ex_start_date IS NOT NULL AND ex_start_date > CURDATE() THEN ' . $pdo->quote('upcoming')
        . ' ELSE ' . $pdo->quote('current')
        . ' END';
}

/**
 * 날짜 기준으로 분류를 자동 갱신합니다. (지연 실행 — 크론 없이 동작)
 *
 * 목록·등록처럼 전시를 읽는 시점에 한 번씩 돌립니다.
 * 여러 번 불러도 바뀔 것이 없으면 UPDATE 대상이 없습니다.
 *
 * ⚠ 공개 사이트용 조회 API 를 만들 때도 가장 먼저 호출해 주세요.
 *
 * @return int 바뀐 건수 (테이블·컴럼이 없으면 0)
 */
function exhibition_sync_statuses()
{
    static $done = false;

    if ($done) {
        return 0;
    }

    $done = true;

    if (!exhibition_table_exists(EXHIBITION_TABLE) || !exhibition_has_column('ex_status')) {
        return 0;
    }

    $case = exhibition_status_case_sql();

    try {
        return (int) db()->exec(
            'UPDATE ' . EXHIBITION_TABLE . ' SET ex_status = ' . $case
            . ' WHERE ex_status <> ' . $case
        );
    } catch (Throwable $e) {
        return 0;
    }
}

/**
 * payload(JSON) 를 검증하고 저장에 쓸 값으로 정리합니다.
 *
 * @param array $payload
 * @return array
 */
function exhibition_input(array $payload)
{
    $title = isset($payload['title']) ? trim((string) $payload['title']) : '';
    $status = isset($payload['status']) ? trim((string) $payload['status']) : '';
    $place = isset($payload['place']) ? trim((string) $payload['place']) : '';
    $artist = isset($payload['artist']) ? trim((string) $payload['artist']) : '';
    $startDate = isset($payload['start_date']) ? trim((string) $payload['start_date']) : '';
    $endDate = isset($payload['end_date']) ? trim((string) $payload['end_date']) : '';
    $overview = isset($payload['overview']) ? (string) $payload['overview'] : '';
    $bio = isset($payload['bio']) ? (string) $payload['bio'] : '';
    $useYn = isset($payload['use_yn']) ? strtoupper(trim((string) $payload['use_yn'])) : 'Y';

    if ($title === '') {
        json_error('전시회명을 입력해 주세요.', 422);
    }

    if (exhibition_length($title) > 200) {
        json_error('전시회명은 200자까지 입력할 수 있습니다.', 422);
    }

    // 분류를 보내지 않으면 현재전시로 둡니다.
    if ($status === '') {
        $status = 'current';
    }

    if (!isset(EXHIBITION_REGISTERED_STATUSES[$status])) {
        json_error('분류를 선택해 주세요.', 422);
    }

    if ($place === '') {
        json_error('전시장소를 입력해 주세요.', 422);
    }

    if (exhibition_length($place) > 200) {
        json_error('전시장소는 200자까지 입력할 수 있습니다.', 422);
    }

    if ($artist === '') {
        json_error('작가명을 입력해 주세요.', 422);
    }

    if (exhibition_length($artist) > 200) {
        json_error('작가명은 200자까지 입력할 수 있습니다.', 422);
    }

    if (!exhibition_is_date($startDate)) {
        json_error('전시 시작일을 선택해 주세요.', 422);
    }

    if (!exhibition_is_date($endDate)) {
        json_error('전시 종료일을 선택해 주세요.', 422);
    }

    if ($startDate > $endDate) {
        json_error('전시 종료일은 시작일보다 빠를 수 없습니다.', 422);
    }

    return [
        'title' => $title,
        'status' => $status,
        'place' => $place,
        'artist' => $artist,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'overview' => exhibition_clean_html($overview),
        'bio' => exhibition_clean_html($bio),
        'use_yn' => $useYn === 'N' ? 'N' : 'Y',
    ];
}

/**
 * YYYY-MM-DD 형식인지 (실재하는 날짜인지까지) 확인합니다.
 *
 * @param string $value
 * @return bool
 */
function exhibition_is_date($value)
{
    $value = (string) $value;

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return false;
    }

    $parts = explode('-', $value);

    return checkdate((int) $parts[1], (int) $parts[2], (int) $parts[0]);
}

/**
 * 글자 수 (UTF-8)
 *
 * @param string $value
 * @return int
 */
function exhibition_length($value)
{
    return text_length($value);
}

/**
 * 전시 1건 저장 (첨부 포함)
 *
 * @param array  $input    exhibition_input() 결과
 * @param array  $files    exhibition_uploaded_files() 결과
 * @param string $adminId  등록한 관리자 아이디
 * @return int 생성된 ex_id
 */
function exhibition_create(array $input, array $files, $adminId)
{
    $pdo = db();
    $dir = upload_dir(EXHIBITION_UPLOAD_DIR);

    if ($dir === null) {
        json_error('파일을 저장할 폴더를 만들 수 없습니다. 서버 권한을 확인해 주세요.', 500);
    }

    $pdo->beginTransaction();
    $saved = [];

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO ' . EXHIBITION_TABLE
            . ' (ex_title, ex_status, ex_place, ex_artist, ex_start_date, ex_end_date,'
            . ' ex_overview, ex_bio, ex_hit, ex_use_yn, ex_admin_id, ex_created_at)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW())'
        );

        $stmt->execute([
            $input['title'],
            $input['status'],
            $input['place'],
            $input['artist'],
            $input['start_date'],
            $input['end_date'],
            $input['overview'],
            $input['bio'],
            $input['use_yn'],
            (string) $adminId,
        ]);

        $exId = (int) $pdo->lastInsertId();

        $saved = exhibition_save_files($pdo, $exId, $files);

        $pdo->commit();

        return $exId;
    } catch (Throwable $e) {
        $pdo->rollBack();

        // DB 는 되돌렸지만 이미 옮겨 둔 파일이 있으면 함께 지웁니다.
        upload_cleanup($saved);

        throw $e;
    }
}

/**
 * 작품 이미지 저장 (파일 + exhibition_file 행)
 *
 * @param PDO   $pdo
 * @param int   $exId
 * @param array $files exhibition_uploaded_files() 결과
 * @return array<int, string> 저장된 파일의 절대 경로 (실패 시 롤백 정리용)
 */
function exhibition_save_files($pdo, $exId, array $files)
{
    $dir = upload_dir(EXHIBITION_UPLOAD_DIR);

    if ($dir === null) {
        return [];
    }

    $saved = [];

    $last = $pdo->prepare(
        'SELECT COALESCE(MAX(ef_no), -1) FROM ' . EXHIBITION_FILE_TABLE . ' WHERE ex_id = ?'
    );
    $last->execute([(int) $exId]);
    $no = (int) $last->fetchColumn() + 1;

    foreach ($files as $file) {
        $moved = upload_move_file($file, $dir);

        if ($moved === null) {
            continue;
        }

        $saved[] = $dir . '/' . $moved['file'];

        $stmt = $pdo->prepare(
            'INSERT INTO ' . EXHIBITION_FILE_TABLE
            . ' (ex_id, ef_no, ef_ori_name, ef_save_name, ef_ext, ef_size,'
            . ' ef_width, ef_height, ef_is_image, ef_created_at)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
        );

        $stmt->execute([
            (int) $exId,
            $no,
            (string) $file['name'],
            $moved['file'],
            strtolower((string) pathinfo((string) $file['name'], PATHINFO_EXTENSION)),
            $moved['size'],
            $moved['width'],
            $moved['height'],
            $moved['is_image'] ? 1 : 0,
        ]);

        $no++;
    }

    return $saved;
}

/**
 * 저장된 작품 이미지 파일을 복제합니다.
 *
 * 복사본은 원본과 다른 파일을 써야 한쪽을 지울 때 다른 쪽이 깨지지 않습니다.
 *
 * @param string $dir      uploads/exhibition 폴더
 * @param string $saveName 원본 저장 파일명 (ef_save_name)
 * @return string 복제한 저장 파일명 (실패하면 빈 문자열)
 */
function exhibition_copy_file($dir, $saveName)
{
    $source = $dir . '/' . basename((string) $saveName);

    if (!is_file($source)) {
        return '';
    }

    $extension = strtolower((string) pathinfo($saveName, PATHINFO_EXTENSION));

    // 저장 파일명 앞의 `시각_랜덤_` 은 떼어 복사할수록 이름이 길어지지 않게 합니다.
    $base = (string) preg_replace(
        '/^\d+_[0-9a-f]{8}_/',
        '',
        (string) pathinfo($saveName, PATHINFO_FILENAME)
    );
    $base = trim((string) preg_replace('/[^A-Za-z0-9._-]+/', '_', $base), '_');

    if ($base === '') {
        $base = 'image';
    }

    $extension = $extension === '' ? '' : '.' . $extension;

    // 시각 + 랜덤으로 이름을 만들고, 같은 이름이 이미 있으면 다시 만듭니다.
    // (겹치는 일은 사실상 없지만, 기존 파일을 덮어쓰지 않도록 확인합니다)
    $stored = '';

    for ($attempt = 0; $attempt < 3; $attempt++) {
        $candidate = sprintf(
            '%d_%s_%s%s',
            time(),
            substr(bin2hex(random_bytes(4)), 0, 8),
            $base,
            $extension
        );

        if (!file_exists($dir . '/' . $candidate)) {
            $stored = $candidate;

            break;
        }
    }

    // 이름을 만들지 못하면 복사하지 않습니다. (원본은 그대로 둡니다)
    if ($stored === '') {
        return '';
    }

    if (!@copy($source, $dir . '/' . $stored)) {
        return '';
    }

    return $stored;
}

/**
 * 전시 1건 복사 (작품 이미지도 파일까지 함께 복제)
 *
 *   - 제목 뒤에 ` (복사)` 를 붙입니다. (200자를 넘지 않게 자릅니다)
 *   - 복사본은 **미사용(N)** 으로 만들어 공개 사이트에 바로 뜨지 않게 합니다.
 *   - 에디터 본문에 넣은 이미지는 같은 파일을 함께 쓰므로 따로 복제하지 않습니다.
 *
 * @param int    $exId    복사할 전시 번호
 * @param string $adminId
 * @return int 새로 만들어진 전시 번호
 */
function exhibition_copy($exId, $adminId)
{
    $pdo = db();

    $stmt = $pdo->prepare('SELECT * FROM ' . EXHIBITION_TABLE . ' WHERE ex_id = ?');
    $stmt->execute([(int) $exId]);
    $row = $stmt->fetch();

    if (!$row) {
        json_error('복사할 전시를 찾을 수 없습니다.', 404);
    }

    $suffix = ' (복사)';
    $title = (string) $row['ex_title'];

    if (exhibition_length($title . $suffix) > 200) {
        $limit = 200 - exhibition_length($suffix);
        $title = (function_exists('mb_substr')
            ? mb_substr($title, 0, $limit, 'UTF-8')
            : substr($title, 0, $limit)) . $suffix;
    } else {
        $title .= $suffix;
    }

    $dir = upload_dir(EXHIBITION_UPLOAD_DIR);

    if ($dir === null) {
        json_error('파일을 저장할 폴더를 만들 수 없습니다. 서버 권한을 확인해 주세요.', 500);
    }

    $pdo->beginTransaction();
    $saved = [];

    try {
        $insert = $pdo->prepare(
            'INSERT INTO ' . EXHIBITION_TABLE
            . ' (ex_title, ex_status, ex_place, ex_artist, ex_start_date, ex_end_date,'
            . ' ex_overview, ex_bio, ex_hit, ex_use_yn, ex_admin_id, ex_created_at)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW())'
        );

        $insert->execute([
            $title,
            (string) $row['ex_status'],
            (string) $row['ex_place'],
            (string) $row['ex_artist'],
            (string) $row['ex_start_date'],
            (string) $row['ex_end_date'],
            (string) $row['ex_overview'],
            (string) $row['ex_bio'],
            // 복사본은 숨긴 상태로 만들어, 내용을 확인한 뒤 공개하게 합니다.
            'N',
            (string) $adminId,
        ]);

        $newId = (int) $pdo->lastInsertId();

        // 작품 이미지 — 파일을 복제하고 행을 새로 넣습니다.
        $fileStmt = $pdo->prepare(
            'SELECT ef_no, ef_ori_name, ef_save_name, ef_ext, ef_size,'
            . ' ef_width, ef_height, ef_is_image'
            . ' FROM ' . EXHIBITION_FILE_TABLE . ' WHERE ex_id = ? ORDER BY ef_no ASC'
        );
        $fileStmt->execute([(int) $exId]);

        $insertFile = $pdo->prepare(
            'INSERT INTO ' . EXHIBITION_FILE_TABLE
            . ' (ex_id, ef_no, ef_ori_name, ef_save_name, ef_ext, ef_size,'
            . ' ef_width, ef_height, ef_is_image, ef_created_at)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
        );

        foreach ($fileStmt->fetchAll() as $file) {
            $copied = exhibition_copy_file($dir, (string) $file['ef_save_name']);

            // 원본 파일이 사라진 행은 복사하지 않습니다.
            if ($copied === '') {
                continue;
            }

            $saved[] = $dir . '/' . $copied;

            $insertFile->execute([
                $newId,
                (int) $file['ef_no'],
                (string) $file['ef_ori_name'],
                $copied,
                (string) $file['ef_ext'],
                (int) $file['ef_size'],
                (int) $file['ef_width'],
                (int) $file['ef_height'],
                (int) $file['ef_is_image'],
            ]);
        }

        $pdo->commit();

        return $newId;
    } catch (Throwable $e) {
        $pdo->rollBack();

        // DB 는 되돌렸지만 이미 복제한 파일이 있으면 함께 지웁니다.
        upload_cleanup($saved);

        throw $e;
    }
}

/**
 * 전시 1건의 첨부파일 목록
 *
 * @param int $exId
 * @return array<int, array>
 */
function exhibition_files_for($exId)
{
    $stmt = db()->prepare(
        'SELECT ef_id, ef_no, ef_ori_name, ef_save_name, ef_ext, ef_size,'
        . ' ef_width, ef_height, ef_is_image'
        . ' FROM ' . EXHIBITION_FILE_TABLE . ' WHERE ex_id = ? ORDER BY ef_no ASC'
    );
    $stmt->execute([(int) $exId]);

    $files = [];

    foreach ($stmt->fetchAll() as $row) {
        $url = upload_file_url(EXHIBITION_UPLOAD_DIR, (string) $row['ef_save_name']);

        // 실제 파일이 사라진 행은 목록에서 숨깁니다.
        if ($url === '') {
            continue;
        }

        $files[] = [
            'id' => (int) $row['ef_id'],
            'no' => (int) $row['ef_no'],
            'name' => (string) $row['ef_ori_name'],
            'ext' => (string) $row['ef_ext'],
            'size' => (int) $row['ef_size'],
            'width' => (int) $row['ef_width'],
            'height' => (int) $row['ef_height'],
            'isImage' => (int) $row['ef_is_image'] === 1,
            'url' => $url,
        ];
    }

    return $files;
}

/**
 * 전시 1건 삭제 (작품 이미지 파일 + exhibition_file 행 + exhibition 행)
 *
 * ⚠ 되돌릴 수 없습니다. 관리자 화면에서 확인 절차를 거쳐 호출하세요.
 * ※ 에디터 본문에 넣은 이미지(uploads/exhibition/editor)는 지우지 않습니다.
 *
 * @param int $exId
 * @return array{files: int, post: bool} 지운 파일 수 · 전시 행 삭제 여부
 */
function exhibition_delete($exId)
{
    $exId = (int) $exId;
    $pdo = db();

    // 전시 행을 지우면 파일명을 알 수 없으므로 먼저 모아 둡니다.
    $stmt = $pdo->prepare(
        'SELECT ef_save_name FROM ' . EXHIBITION_FILE_TABLE . ' WHERE ex_id = ?'
    );
    $stmt->execute([$exId]);
    $names = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $pdo->beginTransaction();

    try {
        $pdo->prepare('DELETE FROM ' . EXHIBITION_FILE_TABLE . ' WHERE ex_id = ?')
            ->execute([$exId]);

        $del = $pdo->prepare('DELETE FROM ' . EXHIBITION_TABLE . ' WHERE ex_id = ?');
        $del->execute([$exId]);
        $post = $del->rowCount() > 0;

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    // DB 정리가 끝난 뒤에 실제 파일을 지웁니다.
    $dir = upload_dir(EXHIBITION_UPLOAD_DIR, false);
    $removed = 0;

    if ($dir !== null) {
        foreach ($names as $name) {
            $path = $dir . '/' . basename((string) $name);

            if (is_file($path) && @unlink($path)) {
                $removed++;
            }
        }
    }

    return ['files' => $removed, 'post' => $post];
}

/**
 * 전시 1건 상세 (수정 화면)
 *
 * @param int $exId
 * @return array|null 없으면 null
 */
function exhibition_detail($exId)
{
    $stmt = db()->prepare('SELECT * FROM ' . EXHIBITION_TABLE . ' WHERE ex_id = ?');
    $stmt->execute([(int) $exId]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    // 분류 컴럼은 마이그레이션 전일 수 있습니다.
    $status = isset($row['ex_status']) ? (string) $row['ex_status'] : '';

    return [
        'id' => (int) $row['ex_id'],
        'title' => (string) $row['ex_title'],
        'status' => $status,
        'statusLabel' => isset(EXHIBITION_STATUSES[$status]) ? EXHIBITION_STATUSES[$status] : '',
        'place' => (string) $row['ex_place'],
        'artist' => (string) $row['ex_artist'],
        'startDate' => (string) $row['ex_start_date'],
        'endDate' => (string) $row['ex_end_date'],
        'overview' => (string) $row['ex_overview'],
        'bio' => (string) $row['ex_bio'],
        'useYn' => (string) $row['ex_use_yn'],
        'hit' => (int) $row['ex_hit'],
        'createdAt' => (string) $row['ex_created_at'],
        'files' => exhibition_files_for($exId),
    ];
}

/**
 * 전시 1건 수정 (작품 이미지 제외)
 *
 * @param int   $exId
 * @param array $input exhibition_input() 결과
 * @return void
 */
function exhibition_update($exId, array $input)
{
    $hasStatus = exhibition_has_column('ex_status');

    $sql = 'UPDATE ' . EXHIBITION_TABLE . ' SET'
        . ' ex_title = ?, ex_place = ?, ex_artist = ?,'
        . ' ex_start_date = ?, ex_end_date = ?, ex_overview = ?, ex_bio = ?,'
        . ' ex_use_yn = ?, ex_updated_at = NOW()'
        . ($hasStatus ? ', ex_status = ?' : '')
        . ' WHERE ex_id = ?';

    $params = [
        $input['title'],
        $input['place'],
        $input['artist'],
        $input['start_date'],
        $input['end_date'],
        $input['overview'],
        $input['bio'],
        $input['use_yn'],
    ];

    if ($hasStatus) {
        $params[] = $input['status'];
    }

    $params[] = (int) $exId;

    db()->prepare($sql)->execute($params);
}

/**
 * 남길 작품 이미지(ef_id)만 남기고 나머지는 행과 파일 모두 지웁니다.
 *
 * @param PDO        $pdo
 * @param int        $exId
 * @param array<int> $keepIds 남길 ef_id 목록
 * @return int 지운 파일 수
 */
function exhibition_prune_files($pdo, $exId, array $keepIds)
{
    $keep = array_map('intval', $keepIds);

    $stmt = $pdo->prepare(
        'SELECT ef_id, ef_save_name FROM ' . EXHIBITION_FILE_TABLE . ' WHERE ex_id = ?'
    );
    $stmt->execute([(int) $exId]);

    $dir = upload_dir(EXHIBITION_UPLOAD_DIR, false);
    $del = $pdo->prepare('DELETE FROM ' . EXHIBITION_FILE_TABLE . ' WHERE ef_id = ?');
    $removed = 0;

    foreach ($stmt->fetchAll() as $row) {
        if (in_array((int) $row['ef_id'], $keep, true)) {
            continue;
        }

        $del->execute([(int) $row['ef_id']]);

        if ($dir === null) {
            continue;
        }

        // basename 으로 경로 조작을 막습니다.
        $path = $dir . '/' . basename((string) $row['ef_save_name']);

        if (is_file($path) && @unlink($path)) {
            $removed++;
        }
    }

    return $removed;
}

/**
 * 공개 카드용 전시 1건 (대표 이미지 포함)
 *
 * @param array $row exhibition 행 + thumb_name(첫 작품 이미지 저장 파일명)
 * @return array
 */
function exhibition_public_item(array $row)
{
    $status = isset($row['ex_status']) ? (string) $row['ex_status'] : '';
    $thumb = isset($row['thumb_name']) ? (string) $row['thumb_name'] : '';

    return [
        'id' => (int) $row['ex_id'],
        'title' => (string) $row['ex_title'],
        'artist' => (string) $row['ex_artist'],
        'place' => (string) $row['ex_place'],
        'startDate' => (string) $row['ex_start_date'],
        'endDate' => (string) $row['ex_end_date'],
        'status' => $status,
        'statusLabel' => isset(EXHIBITION_STATUSES[$status]) ? EXHIBITION_STATUSES[$status] : '',
        // 대표 이미지가 없으면 빈 값 → 화면에서 placeholder 를 씁니다.
        'imageUrl' => $thumb === '' ? '' : upload_file_url(EXHIBITION_UPLOAD_DIR, $thumb),
    ];
}

/**
 * 공개 전시 목록
 *
 * 노출(Y) 중인 전시만 골라 카드에 쓸 대표 이미지(첫 작품 이미지)와 함께 돌려줍니다.
 *
 * @param array $query status(current|upcoming|past) · page · size
 * @return array{items: array, totalCount: int, totalPages: int, page: int, size: int}
 */
function exhibition_public_list(array $query)
{
    $pdo = db();

    // 시작일이 된 예정 전시 · 종료일이 지난 전시를 먼저 자동 분류합니다.
    exhibition_sync_statuses();

    $page = isset($query['page']) ? max(1, (int) $query['page']) : 1;
    $size = isset($query['size']) ? min(48, max(1, (int) $query['size'])) : 12;
    $status = isset($query['status']) ? trim((string) $query['status']) : '';

    // 분류 컴럼은 마이그레이션 전일 수 있으므로 있을 때만 쿼리에 넣습니다.
    $hasStatus = exhibition_has_column('ex_status');

    $where = ["ex_use_yn = 'Y'"];
    $params = [];

    if ($hasStatus && isset(EXHIBITION_STATUSES[$status])) {
        $where[] = 'ex_status = ?';
        $params[] = $status;
    }

    // 정렬 — 예정 전시는 곧 시작하는 순, 나머지는 최근 시작한 순
    $orderSql = $status === 'upcoming'
        ? 'ex_start_date ASC, ex_id ASC'
        : 'ex_start_date DESC, ex_id DESC';

    $whereSql = implode(' AND ', $where);

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM ' . EXHIBITION_TABLE . ' WHERE ' . $whereSql);
    $countStmt->execute($params);
    $totalCount = (int) $countStmt->fetchColumn();

    $sql = 'SELECT ex_id, ex_title, ex_place, ex_artist, ex_start_date, ex_end_date,'
        . ($hasStatus ? ' ex_status,' : '')
        . ' (SELECT f.ef_save_name FROM ' . EXHIBITION_FILE_TABLE . ' f'
        . '   WHERE f.ex_id = e.ex_id AND f.ef_is_image = 1'
        . '   ORDER BY f.ef_no ASC LIMIT 1) AS thumb_name'
        . ' FROM ' . EXHIBITION_TABLE . ' e'
        . ' WHERE ' . $whereSql
        . ' ORDER BY ' . $orderSql
        . ' LIMIT ' . $size . ' OFFSET ' . (($page - 1) * $size);

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $items = [];

    foreach ($stmt->fetchAll() as $row) {
        $items[] = exhibition_public_item($row);
    }

    return [
        'items' => $items,
        'totalCount' => $totalCount,
        'totalPages' => max(1, (int) ceil($totalCount / $size)),
        'page' => $page,
        'size' => $size,
    ];
}

/**
 * 공개 전시 상세 (노출 중인 전시만)
 *
 * @param int $exId
 * @return array|null 없으면 null
 */
function exhibition_public_detail($exId)
{
    // 상세 주소로 바로 들어온 경우에도 분류를 오늘 날짜 기준으로 맞춥니다.
    exhibition_sync_statuses();

    $stmt = db()->prepare('SELECT * FROM ' . EXHIBITION_TABLE . ' WHERE ex_id = ?');
    $stmt->execute([(int) $exId]);
    $row = $stmt->fetch();

    if (!$row || (string) $row['ex_use_yn'] !== 'Y') {
        return null;
    }

    $status = isset($row['ex_status']) ? (string) $row['ex_status'] : '';

    return [
        'id' => (int) $row['ex_id'],
        'title' => (string) $row['ex_title'],
        'status' => $status,
        'statusLabel' => isset(EXHIBITION_STATUSES[$status]) ? EXHIBITION_STATUSES[$status] : '',
        'place' => (string) $row['ex_place'],
        'artist' => (string) $row['ex_artist'],
        'startDate' => (string) $row['ex_start_date'],
        'endDate' => (string) $row['ex_end_date'],
        'overview' => (string) $row['ex_overview'],
        'bio' => (string) $row['ex_bio'],
        'hit' => (int) $row['ex_hit'],
        'files' => exhibition_files_for($exId),
    ];
}

/**
 * 조회수 1 증가 (공개 상세를 열 때)
 *
 * @param int $exId
 * @return void
 */
function exhibition_add_hit($exId)
{
    db()->prepare(
        'UPDATE ' . EXHIBITION_TABLE . ' SET ex_hit = COALESCE(ex_hit, 0) + 1 WHERE ex_id = ?'
    )->execute([(int) $exId]);
}

/**
 * 목록용 전시 1건 변환
 *
 * @param array $row   exhibition 행
 * @param int   $files 첨부 수
 * @return array
 */
function exhibition_list_item(array $row, $files = 0)
{
    $status = isset($row['ex_status']) ? (string) $row['ex_status'] : '';

    return [
        'id' => (int) $row['ex_id'],
        'title' => (string) $row['ex_title'],
        'status' => $status,
        'statusLabel' => isset(EXHIBITION_STATUSES[$status]) ? EXHIBITION_STATUSES[$status] : '',
        'place' => (string) $row['ex_place'],
        'artist' => (string) $row['ex_artist'],
        'startDate' => (string) $row['ex_start_date'],
        'endDate' => (string) $row['ex_end_date'],
        'useYn' => (string) $row['ex_use_yn'],
        'hit' => (int) $row['ex_hit'],
        'fileCount' => (int) $files,
        'createdAt' => (string) $row['ex_created_at'],
    ];
}

/**
 * 전시 목록 (관리자)
 *
 * @param array $query page · size · keyword · use_yn
 * @return array{items: array, totalCount: int, totalPages: int, page: int, size: int}
 */
function exhibition_list(array $query)
{
    $pdo = db();

    // 시작일이 된 예정 전시 · 종료일이 지난 전시를 먼저 자동 분류합니다.
    exhibition_sync_statuses();

    $page = isset($query['page']) ? max(1, (int) $query['page']) : 1;
    $size = isset($query['size']) ? min(100, max(1, (int) $query['size'])) : 15;
    $keyword = isset($query['keyword']) ? trim((string) $query['keyword']) : '';
    $useYn = isset($query['use_yn']) ? strtoupper(trim((string) $query['use_yn'])) : '';
    $status = isset($query['status']) ? trim((string) $query['status']) : '';
    $dateFrom = isset($query['from']) ? trim((string) $query['from']) : '';
    $dateTo = isset($query['to']) ? trim((string) $query['to']) : '';

    // 분류 컴럼은 마이그레이션 전일 수 있으므로 있을 때만 쿼리에 넣습니다.
    $hasStatus = exhibition_has_column('ex_status');

    $where = ['1 = 1'];
    $params = [];

    if ($keyword !== '') {
        $where[] = '(ex_title LIKE ? OR ex_place LIKE ? OR ex_artist LIKE ?)';
        $like = '%' . $keyword . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }

    if ($useYn === 'Y' || $useYn === 'N') {
        $where[] = 'ex_use_yn = ?';
        $params[] = $useYn;
    }

    if ($hasStatus && isset(EXHIBITION_STATUSES[$status])) {
        $where[] = 'ex_status = ?';
        $params[] = $status;
    }

    // 전시기간 검색 — 고른 기간과 하루라도 겹치는 전시
    //   (전시 종료일 >= 검색 시작일 AND 전시 시작일 <= 검색 종료일)
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
        $where[] = 'ex_end_date >= ?';
        $params[] = $dateFrom;
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
        $where[] = 'ex_start_date <= ?';
        $params[] = $dateTo;
    }

    $whereSql = implode(' AND ', $where);

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM ' . EXHIBITION_TABLE . ' WHERE ' . $whereSql);
    $countStmt->execute($params);
    $totalCount = (int) $countStmt->fetchColumn();

    $totalPages = max(1, (int) ceil($totalCount / $size));
    $offset = ($page - 1) * $size;

    $sql = 'SELECT ex_id, ex_title, ex_place, ex_artist, ex_start_date, ex_end_date,'
        . ' ex_use_yn, ex_hit, ex_created_at,'
        . ($hasStatus ? ' ex_status,' : '')
        . ' (SELECT COUNT(*) FROM ' . EXHIBITION_FILE_TABLE . ' f WHERE f.ex_id = e.ex_id) AS file_count'
        . ' FROM ' . EXHIBITION_TABLE . ' e'
        . ' WHERE ' . $whereSql
        . ' ORDER BY ex_id DESC LIMIT ' . $size . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $items = [];

    foreach ($stmt->fetchAll() as $row) {
        $items[] = exhibition_list_item($row, (int) $row['file_count']);
    }

    return [
        'items' => $items,
        'totalCount' => $totalCount,
        'totalPages' => $totalPages,
        'page' => $page,
        'size' => $size,
    ];
}
