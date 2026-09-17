<?php
/**
 * 공지 도메인 헬퍼
 *
 *   g4_write_notice  — 그누보드4 공지 게시판 (레거시 테이블)
 *   g4_board_file    — 첨부파일 (bo_table = 'notice')
 *
 * 실제 파일은 웹루트 uploads/notice/ 에 평면으로 저장합니다.
 * (서버 기준 /uploads/notice)
 *
 * ⚠ 레거시 테이블은 euc-kr 입니다. lib/db.php 의 SET NAMES utf8mb4 가
 *    한글 저장·조회 시 문자셋 변환을 담당합니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/upload.php';
require_once __DIR__ . '/html.php';

const NOTICE_TABLE = 'g4_write_notice';
const NOTICE_BOARD = 'notice';

/** 게시판 설정 테이블 — 상단 고정 공지 목록(bo_notice)이 여기에 있습니다. */
const NOTICE_BOARD_TABLE = 'g4_board';

/** 첨부파일 폴더 (웹루트/uploads 아래 = /uploads/notice) */
const NOTICE_UPLOAD_DIR = 'notice';

/** 첨부 제한 — apps/src/api/notices.ts 와 동일하게 유지하세요. */
const NOTICE_FILE_LIMIT = [
    'label' => '파일첨부',
    'max' => 5,
    'size' => 10485760,  // 개당 10MB
    'total' => 52428800, // 전체 50MB
    'ext' => [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
        'pdf', 'hwp', 'hwpx', 'txt',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'zip',
    ],
];

/** 제목 · 링크 길이 (그누보드 wr_subject varchar(255)) */
const NOTICE_TITLE_MAX = 255;
const NOTICE_LINK_MAX = 255;

/**
 * 공지 테이블이 있는지 확인합니다.
 *
 * @return bool
 */
function notice_table_exists()
{
    static $exists = null;

    if ($exists !== null) {
        return $exists;
    }

    $exists = false;

    try {
        $stmt = db()->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES'
            . ' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
        );
        $stmt->execute([NOTICE_TABLE]);

        $exists = (int) $stmt->fetchColumn() > 0;
    } catch (Throwable $e) {
        $exists = false;
    }

    return $exists;
}

/** 테이블이 없을 때 안내 문구 */
function notice_missing_table_message()
{
    return '공지 테이블(' . NOTICE_TABLE . ')이 없습니다. 서버 DB 를 확인해 주세요.';
}

/**
 * 게시판 설정(g4_board) 행이 있는지
 *
 * @return bool
 */
function notice_board_configured()
{
    try {
        $stmt = db()->prepare(
            'SELECT COUNT(*) FROM ' . NOTICE_BOARD_TABLE . ' WHERE bo_table = ?'
        );
        $stmt->execute([NOTICE_BOARD]);

        return (int) $stmt->fetchColumn() > 0;
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * g4_board.bo_notice 원본 값 (콤마로 구분된 wr_id 문자열)
 *
 * @param bool $reload true 면 캐시를 버리고 다시 읽습니다.
 * @return string 없으면 빈 문자열
 */
function notice_pinned_raw($reload = false)
{
    static $raw = null;

    if ($raw !== null && !$reload) {
        return $raw;
    }

    $raw = '';

    try {
        $stmt = db()->prepare(
            'SELECT bo_notice FROM ' . NOTICE_BOARD_TABLE . ' WHERE bo_table = ? LIMIT 1'
        );
        $stmt->execute([NOTICE_BOARD]);
        $value = $stmt->fetchColumn();

        $raw = ($value === false || $value === null) ? '' : (string) $value;
    } catch (Throwable $e) {
        $raw = '';
    }

    return $raw;
}

/**
 * 상단 고정된 공지 wr_id 목록 (g4_board.bo_notice — 적힌 순서 그대로)
 *
 * 콤마·공백·줄바꿈을 모두 구분자로 보고 해석합니다.
 *
 * @param bool $reload true 면 캐시를 버리고 다시 읽습니다.
 * @return array<int> 없으면 빈 배열
 */
function notice_pinned_ids($reload = false)
{
    static $ids = null;

    if ($ids !== null && !$reload) {
        return $ids;
    }

    $ids = [];
    $raw = notice_pinned_raw($reload);

    if ($raw === '') {
        return $ids;
    }

    foreach (preg_split('/[\s,]+/', trim($raw)) ?: [] as $id) {
        $id = (int) $id;

        if ($id > 0 && !in_array($id, $ids, true)) {
            $ids[] = $id;
        }
    }

    return $ids;
}

/**
 * 고정 설정에는 있는데 공지 목록(댓글 제외)에는 없는 번호
 *
 * 삭제되었거나 다른 설정이 꾸인 경우입니다. 화면에 안내로 보여 줍니다.
 *
 * @return array<int>
 */
function notice_pinned_not_listed()
{
    $ids = notice_pinned_ids();

    if (!$ids) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    try {
        $stmt = db()->prepare(
            'SELECT wr_id FROM ' . NOTICE_TABLE
            . ' WHERE wr_is_comment = 0 AND wr_id IN (' . $placeholders . ')'
        );
        $stmt->execute($ids);

        $alive = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    } catch (Throwable $e) {
        return [];
    }

    return array_values(array_filter($ids, function ($id) use ($alive) {
        return !in_array($id, $alive, true);
    }));
}

/**
 * 고정 목록(bo_notice)에서 사라진 공지를 정리합니다.
 *
 * 공지를 지우면 bo_notice 에 wr_id 만 남아 DB 와 화면이 어긋납니다.
 * (예: DB 에는 고정 3개로 보이는데 목록에는 1개만 나옴)
 * 목록을 읽을 때 한 번씩 돌려 실제로 남아 있는 공지만 남깁니다.
 *
 * @return int 정리한 건수
 */
function notice_prune_pinned()
{
    static $done = false;

    if ($done) {
        return 0;
    }

    $done = true;

    $ids = notice_pinned_ids();

    if (!$ids || !notice_board_configured()) {
        return 0;
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    try {
        // 테이블에 아예 없는 번호만 지웁니다.
        // (뻐뛰기/검색 조건과는 무관하게 확인 — 멀줘 있는 공지를 함부로 지우지 않도록)
        $stmt = db()->prepare(
            'SELECT wr_id FROM ' . NOTICE_TABLE . ' WHERE wr_id IN (' . $placeholders . ')'
        );
        $stmt->execute($ids);

        $alive = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    } catch (Throwable $e) {
        return 0;
    }

    $next = array_values(array_filter($ids, function ($id) use ($alive) {
        return in_array($id, $alive, true);
    }));

    if (count($next) === count($ids)) {
        return 0;
    }

    try {
        db()->prepare('UPDATE ' . NOTICE_BOARD_TABLE . ' SET bo_notice = ? WHERE bo_table = ?')
            ->execute([implode(',', $next), NOTICE_BOARD]);

        // 캐시를 새 값으로 다시 읽습니다.
        notice_pinned_ids(true);

        return count($ids) - count($next);
    } catch (Throwable $e) {
        return 0;
    }
}

/**
 * 공지를 상단 고정 / 해제합니다. (g4_board.bo_notice 갱신)
 *
 * 고정하면 목록 맨 앞으로 보내고, 해제하면 목록에서 뻐집니다.
 *
 * @param int  $wrId
 * @param bool $pinned
 * @return bool 저장했는지 (게시판 설정이 없으면 false)
 */
function notice_set_pinned($wrId, $pinned)
{
    $wrId = (int) $wrId;

    if ($wrId <= 0 || !notice_board_configured()) {
        return false;
    }

    $ids = notice_pinned_ids();
    $keep = array_values(array_filter($ids, function ($id) use ($wrId) {
        return $id !== $wrId;
    }));

    if (!$pinned && count($keep) === count($ids)) {
        // 이미 해제된 상태
        return true;
    }

    if ($pinned) {
        // 새로 고정한 공지를 맨 앞에 둡니다.
        array_unshift($keep, $wrId);
    }

    try {
        db()->prepare('UPDATE ' . NOTICE_BOARD_TABLE . ' SET bo_notice = ? WHERE bo_table = ?')
            ->execute([implode(',', $keep), NOTICE_BOARD]);

        return true;
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * 업로드 오류 코드를 문구로 바꿉니다.
 *
 * @param int $error
 * @return string
 */
function notice_upload_error_text($error)
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
 * 첨부파일(files[])을 검증해 평탄화된 목록으로 돌려줍니다.
 *
 * @return array<int, array>
 */
function notice_uploaded_files()
{
    $accepted = [];
    $totalSize = 0;

    foreach (upload_normalize_files('files') as $file) {
        $error = (int) $file['error'];

        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;
        }

        if ($error !== UPLOAD_ERR_OK) {
            json_error('파일첨부: ' . notice_upload_error_text($error), 422);
        }

        $original = (string) $file['name'];
        $extension = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));

        if (!in_array($extension, NOTICE_FILE_LIMIT['ext'], true)) {
            json_error($original . ': 첨부할 수 없는 형식입니다.', 422);
        }

        if ((int) $file['size'] > NOTICE_FILE_LIMIT['size']) {
            json_error($original . ': 10MB 이하만 첨부할 수 있습니다.', 422);
        }

        $totalSize += (int) $file['size'];

        if ($totalSize > NOTICE_FILE_LIMIT['total']) {
            json_error('파일첨부: 전체 용량은 50MB 이하만 가능합니다.', 422);
        }

        $accepted[] = $file;

        if (count($accepted) > NOTICE_FILE_LIMIT['max']) {
            json_error('파일첨부: ' . NOTICE_FILE_LIMIT['max'] . '개까지만 첨부할 수 있습니다.', 422);
        }
    }

    return $accepted;
}

/**
 * 레거시 테이블(g4_write_notice)의 문자셋
 *
 * 그누보드4 시절 테이블이라 euc-kr 인 경우가 많습니다.
 * euc-kr 로 표현할 수 없는 글자(이모지 등)를 그대로 넣으면 DB 가 예외를 내므로,
 * 저장 전에 걸러 내기 위해 실제 문자셋을 확인합니다.
 *
 * @return string 소문자 문자셋 이름 (확인 실패 시 euckr)
 */
function notice_legacy_charset()
{
    static $charset = null;

    if ($charset !== null) {
        return $charset;
    }

    $charset = 'euckr';

    try {
        $stmt = db()->prepare(
            'SELECT character_set_name FROM information_schema.COLUMNS'
            . ' WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1'
        );
        $stmt->execute([NOTICE_TABLE, 'wr_content']);
        $found = $stmt->fetchColumn();

        if (is_string($found) && $found !== '') {
            $charset = strtolower($found);
        }
    } catch (Throwable $e) {
        // information_schema 조회가 막혀 있으면 euc-kr 로 가정합니다.
        $charset = 'euckr';
    }

    return $charset;
}

/**
 * 레거시 문자셋에 저장할 수 없는 글자를 제거합니다.
 *
 * 이모지처럼 euc-kr 에 없는 글자를 그대로 저장하면 DB 오류(500)가 나므로,
 * 저장 가능한 글자만 남깁니다. 남는 글자는 UTF-8 그대로 두어야
 * 접속 문자셋(utf8mb4)이 DB 문자셋으로 알아서 변환해 줍니다.
 *
 * @param string $text
 * @return string
 */
function notice_legacy_text($text)
{
    $text = (string) $text;

    if ($text === '') {
        return '';
    }

    $charset = notice_legacy_charset();

    // utf8mb4 는 이모지까지 저장할 수 있습니다.
    if ($charset === 'utf8mb4') {
        return $text;
    }

    // utf8(3바이트) 은 이모지처럼 BMP 밖 글자를 저장할 수 없습니다.
    if ($charset === 'utf8' || $charset === 'utf8mb3') {
        $stripped = preg_replace('/[\x{10000}-\x{10FFFF}]/u', '', $text);

        return is_string($stripped) ? $stripped : $text;
    }

    $iconvName = $charset === 'euckr' ? 'EUC-KR' : strtoupper($charset);

    // 표현할 수 없는 글자는 버리고(//IGNORE) 다시 UTF-8 로 되돌립니다.
    $encoded = @iconv('UTF-8', $iconvName . '//IGNORE', $text);

    if ($encoded === false) {
        return $text;
    }

    $decoded = @iconv($iconvName, 'UTF-8//IGNORE', $encoded);

    return $decoded === false ? $text : $decoded;
}

/**
 * 본문(HTML)용 — 저장할 수 없는 글자를 숫자 엔티티로 바꿔 내용을 보존합니다.
 *
 * 이모지처럼 그냥 버리면 본문이 손실되므로 `&#NNNN;` 형태로 남깁니다.
 * 엔티티는 ASCII 라 레거시 문자셋에도 안전하게 저장되고,
 * 화면에서는 브라우저가 원래 글자로 되돌려 그립니다.
 *
 * @param string $html
 * @return string
 */
function notice_legacy_html($html)
{
    $html = (string) $html;

    if ($html === '') {
        return '';
    }

    $charset = notice_legacy_charset();

    if ($charset === 'utf8mb4') {
        return $html;
    }

    $iconvName = $charset === 'euckr' ? 'EUC-KR' : strtoupper($charset);

    // 살아남는 글자만 추려 냅니다 (버려지는 글자를 찾기 위한 비교용).
    $encoded = @iconv('UTF-8', $iconvName . '//IGNORE', $html);

    if ($encoded === false) {
        return $html;
    }

    $survived = @iconv($iconvName, 'UTF-8//IGNORE', $encoded);

    if ($survived === false) {
        return $html;
    }

    $original = preg_split('//u', $html, -1, PREG_SPLIT_NO_EMPTY);
    $kept = preg_split('//u', $survived, -1, PREG_SPLIT_NO_EMPTY);

    if ($original === false || $kept === false) {
        return $html;
    }

    // 남은 글자와 차례대로 비교해, 사라진 글자만 엔티티로 대체합니다.
    $result = '';
    $index = 0;
    $total = count($kept);

    foreach ($original as $char) {
        if ($index < $total && $char === $kept[$index]) {
            $index++;
            $result .= $char;
            continue;
        }

        if (function_exists('mb_ord')) {
            $result .= '&#' . mb_ord($char, 'UTF-8') . ';';
        }
        // mbstring 이 없으면 남길 방법이 없어 그대로 버립니다.
    }

    return $result;
}

/**
 * payload(JSON) 를 검증하고 저장에 쓸 값으로 정리합니다.
 *
 * @param array $payload
 * @return array
 */
function notice_input(array $payload)
{
    $rawTitle = isset($payload['title']) ? trim((string) $payload['title']) : '';
    $title = notice_legacy_text($rawTitle);
    $content = isset($payload['content']) ? (string) $payload['content'] : '';
    $link1 = notice_legacy_text(isset($payload['link1']) ? trim((string) $payload['link1']) : '');
    $link2 = notice_legacy_text(isset($payload['link2']) ? trim((string) $payload['link2']) : '');
    $pinned = isset($payload['pinned']) ? strtoupper(trim((string) $payload['pinned'])) : 'N';

    if ($title === '') {
        json_error(
            $rawTitle === ''
                ? '제목을 입력해 주세요.'
                : '제목에 저장할 수 없는 문자만 있습니다. (이모지 등은 사용할 수 없습니다)',
            422
        );
    }

    if (text_length($title) > NOTICE_TITLE_MAX) {
        json_error('제목은 ' . NOTICE_TITLE_MAX . '자까지 입력할 수 있습니다.', 422);
    }

    if (text_length($link1) > NOTICE_LINK_MAX || text_length($link2) > NOTICE_LINK_MAX) {
        json_error('링크는 ' . NOTICE_LINK_MAX . '자까지 입력할 수 있습니다.', 422);
    }

    return [
        'title' => $title,
        'content' => notice_legacy_html(html_clean_posted($content)),
        'link1' => $link1,
        'link2' => $link2,
        // 상단 고정 여부 (g4_board.bo_notice 에 저장)
        'pinned' => $pinned === 'Y',
    ];
}

/**
 * 작성자 IP
 *
 * @return string
 */
function notice_client_ip()
{
    $keys = ['HTTP_X_FORWARDED_FOR', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'];

    foreach ($keys as $key) {
        if (empty($_SERVER[$key])) {
            continue;
        }

        $value = explode(',', (string) $_SERVER[$key]);
        $ip = trim($value[0]);

        if ($ip !== '') {
            return $ip;
        }
    }

    return '';
}

/**
 * 첨부파일 저장 폴더 (uploads/notice)
 *
 * @param bool $create
 * @return string|null
 */
function notice_upload_dir($create = true)
{
    return upload_dir(NOTICE_UPLOAD_DIR, $create);
}

/**
 * 첨부파일이 있을 수 있는 폴더 목록
 *
 *   1) uploads/notice              — 지금 쓰는 평면 폴더 (서버 /uploads/notice)
 *   2) uploads/notice/{wr_id}      — 이전 버전이 쓰던 글별 폴더
 *   3) backend/data/file/notice    — 그 이전 경로
 *
 * @param int  $wrId
 * @param bool $create
 * @return array<int, string>
 */
function notice_file_dirs($wrId, $create = false)
{
    $dirs = [];
    $current = notice_upload_dir($create);

    if ($current !== null && is_dir($current)) {
        $dirs[] = $current;
    }

    $root = upload_root();
    $perId = $root === null ? null : $root . '/' . NOTICE_UPLOAD_DIR . '/' . (int) $wrId;

    if ($perId !== null && is_dir($perId)) {
        $dirs[] = $perId;
    }

    $legacy = dirname(__DIR__) . '/data/file/' . NOTICE_UPLOAD_DIR;

    if (is_dir($legacy)) {
        $dirs[] = $legacy;
    }

    return $dirs;
}

/**
 * 첨부파일을 웹에서 부를 수 있는 주소
 *
 * @param int    $wrId
 * @param string $filename 저장 파일명 (bf_file)
 * @return string 없으면 빈 문자열
 */
function notice_file_url($wrId, $filename)
{
    $name = basename((string) $filename);

    if ($name === '') {
        return '';
    }

    // 1) uploads/notice (서버 /uploads/notice)
    $url = upload_file_url(NOTICE_UPLOAD_DIR, $name);

    if ($url !== '') {
        return $url;
    }

    // 2) 이전 경로 (backend/data/file/notice)
    if (is_file(dirname(__DIR__) . '/data/file/' . NOTICE_UPLOAD_DIR . '/' . $name)) {
        $origin = request_origin();

        return $origin === ''
            ? ''
            : $origin . '/backend/data/file/' . NOTICE_UPLOAD_DIR . '/' . rawurlencode($name);
    }

    return '';
}

/**
 * 첨부파일 저장 (파일 + g4_board_file 행)
 *
 * @param PDO   $pdo
 * @param int   $wrId
 * @param array $files notice_uploaded_files() 결과
 * @return array<int, string> 저장된 파일의 절대 경로 (실패 시 롤백 정리용)
 */
function notice_save_files($pdo, $wrId, array $files)
{
    $dir = notice_upload_dir();

    if ($dir === null) {
        return [];
    }

    $saved = [];

    $last = $pdo->prepare(
        'SELECT COALESCE(MAX(bf_no), -1) FROM g4_board_file WHERE bo_table = ? AND wr_id = ?'
    );
    $last->execute([NOTICE_BOARD, (int) $wrId]);
    $bfNo = (int) $last->fetchColumn() + 1;

    foreach ($files as $file) {
        $moved = upload_move_file($file, $dir);

        if ($moved === null) {
            continue;
        }

        $saved[] = $dir . '/' . $moved['file'];

        $stmt = $pdo->prepare(
            'INSERT INTO g4_board_file'
            . ' (bo_table, wr_id, bf_no, bf_source, bf_file, bf_download, bf_content,'
            . ' bf_filesize, bf_width, bf_height, bf_type, bf_datetime)'
            . ' VALUES (?, ?, ?, ?, ?, 0, "", ?, ?, ?, ?, NOW())'
        );

        $stmt->execute([
            NOTICE_BOARD,
            (int) $wrId,
            $bfNo,
            notice_legacy_text((string) $file['name']),
            $moved['file'],
            $moved['size'],
            $moved['width'],
            $moved['height'],
            $moved['is_image'] ? 2 : 1, // 그누보드: 1 = 일반, 2 = 이미지
        ]);

        $bfNo++;
    }

    return $saved;
}

/**
 * 남길 첨부(bf_no)만 남기고 나머지는 행과 파일 모두 지웁니다.
 *
 * @param PDO        $pdo
 * @param int        $wrId
 * @param array<int> $keepNos 남길 bf_no 목록
 * @return int 지운 파일 수
 */
function notice_prune_files($pdo, $wrId, array $keepNos)
{
    $keep = array_map('intval', $keepNos);

    $stmt = $pdo->prepare(
        'SELECT bf_no, bf_file FROM g4_board_file WHERE bo_table = ? AND wr_id = ?'
    );
    $stmt->execute([NOTICE_BOARD, (int) $wrId]);

    $dirs = notice_file_dirs($wrId);
    $del = $pdo->prepare('DELETE FROM g4_board_file WHERE bo_table = ? AND wr_id = ? AND bf_no = ?');
    $removed = 0;

    foreach ($stmt->fetchAll() as $row) {
        if (in_array((int) $row['bf_no'], $keep, true)) {
            continue;
        }

        $del->execute([NOTICE_BOARD, (int) $wrId, (int) $row['bf_no']]);

        foreach ($dirs as $dir) {
            // basename 으로 경로 조작을 막습니다.
            $path = $dir . '/' . basename((string) $row['bf_file']);

            if (is_file($path) && @unlink($path)) {
                $removed++;
            }
        }
    }

    return $removed;
}

/**
 * 공지 1건의 첨부파일 목록 (없는 파일은 건너뜀)
 *
 * @param int $wrId
 * @return array<int, array>
 */
function notice_files_for($wrId)
{
    $stmt = db()->prepare(
        'SELECT bf_no, bf_source, bf_file, bf_filesize, bf_width, bf_height, bf_type'
        . ' FROM g4_board_file WHERE bo_table = ? AND wr_id = ? ORDER BY bf_no ASC'
    );
    $stmt->execute([NOTICE_BOARD, (int) $wrId]);

    $files = [];

    foreach ($stmt->fetchAll() as $row) {
        if (trim((string) $row['bf_file']) === '') {
            continue;
        }

        $url = notice_file_url($wrId, (string) $row['bf_file']);

        if ($url === '') {
            continue;
        }

        $files[] = [
            'no' => (int) $row['bf_no'],
            'name' => (string) $row['bf_source'],
            'size' => (int) $row['bf_filesize'],
            'width' => (int) $row['bf_width'],
            'height' => (int) $row['bf_height'],
            'isImage' => (int) $row['bf_type'] === 2,
            'url' => $url,
        ];
    }

    return $files;
}

/**
 * 공지 1건 저장 (첨부 포함)
 *
 * @param array $input    notice_input() 결과
 * @param array $files    notice_uploaded_files() 결과
 * @param array $admin    current_admin() 결과
 * @return int 생성된 wr_id
 */
function notice_create(array $input, array $files, array $admin)
{
    $pdo = db();
    $now = (new DateTimeImmutable())->format('Y-m-d H:i:s');

    if (notice_upload_dir() === null) {
        json_error('파일을 저장할 폴더를 만들 수 없습니다. 서버 권한을 확인해 주세요.', 500);
    }

    $values = [
        'wr_reply' => '',
        'wr_parent' => 0,
        'wr_is_comment' => 0,
        'wr_comment' => 0,
        'wr_comment_reply' => '',
        'ca_name' => '',
        'wr_option' => 'html1',
        'wr_subject' => (string) $input['title'],
        'wr_content' => (string) $input['content'],
        'wr_link1' => (string) $input['link1'],
        'wr_link2' => (string) $input['link2'],
        'wr_hit' => 0,
        'wr_good' => 0,
        'wr_nogood' => 0,
        'mb_id' => (string) $admin['id'],
        'wr_password' => bin2hex(random_bytes(8)),
        'wr_name' => notice_legacy_text((string) $admin['name']),
        'wr_email' => (string) $admin['email'],
        'wr_homepage' => '',
        'wr_datetime' => $now,
        'wr_last' => $now,
        'wr_ip' => notice_client_ip(),
    ];

    $pdo->beginTransaction();
    $saved = [];

    try {
        // 그누보드 방식: wr_num 은 최소값 - 1
        $minNum = $pdo->query('SELECT MIN(wr_num) FROM ' . NOTICE_TABLE)->fetchColumn();
        $values['wr_num'] = (int) $minNum - 1;

        $columns = array_keys($values);
        $placeholders = array_map(function ($column) {
            return ':' . $column;
        }, $columns);

        $stmt = $pdo->prepare(
            'INSERT INTO ' . NOTICE_TABLE
            . ' (`' . implode('`, `', $columns) . '`)'
            . ' VALUES (' . implode(', ', $placeholders) . ')'
        );

        foreach ($values as $column => $value) {
            $stmt->bindValue(':' . $column, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }

        $stmt->execute();

        $wrId = (int) $pdo->lastInsertId();

        // 그누보드는 wr_parent 를 자기 자신의 wr_id 로 둡니다.
        $pdo->prepare('UPDATE ' . NOTICE_TABLE . ' SET wr_parent = ? WHERE wr_id = ?')
            ->execute([$wrId, $wrId]);

        $saved = notice_save_files($pdo, $wrId, $files);

        $pdo->commit();

        return $wrId;
    } catch (Throwable $e) {
        $pdo->rollBack();

        // DB 는 되돌렸지만 이미 옮겨 둔 파일이 있으면 함께 지웁니다.
        upload_cleanup($saved);

        throw $e;
    }
}

/**
 * 공지 1건 수정 (첨부 제외)
 *
 * @param int   $wrId
 * @param array $input notice_input() 결과
 * @return void
 */
function notice_update($wrId, array $input)
{
    db()->prepare(
        'UPDATE ' . NOTICE_TABLE
        . ' SET wr_subject = ?, wr_content = ?, wr_link1 = ?, wr_link2 = ?, wr_last = ?'
        . ' WHERE wr_id = ?'
    )->execute([
        (string) $input['title'],
        (string) $input['content'],
        (string) $input['link1'],
        (string) $input['link2'],
        (new DateTimeImmutable())->format('Y-m-d H:i:s'),
        (int) $wrId,
    ]);
}

/**
 * 공지 1건 상세
 *
 * @param int $wrId
 * @return array|null 없으면 null
 */
function notice_detail($wrId)
{
    $stmt = db()->prepare(
        'SELECT wr_id, wr_subject, wr_content, wr_link1, wr_link2, wr_name,'
        . ' wr_email, wr_hit, wr_datetime'
        . ' FROM ' . NOTICE_TABLE . ' WHERE wr_id = ? AND wr_is_comment = 0'
    );
    $stmt->execute([(int) $wrId]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    return [
        'id' => (int) $row['wr_id'],
        'title' => (string) $row['wr_subject'],
        'content' => (string) $row['wr_content'],
        'link1' => (string) $row['wr_link1'],
        'link2' => (string) $row['wr_link2'],
        'pinned' => in_array((int) $row['wr_id'], notice_pinned_ids(), true),
        'author' => (string) $row['wr_name'],
        'email' => (string) $row['wr_email'],
        'hit' => (int) $row['wr_hit'],
        'createdAt' => (string) $row['wr_datetime'],
        'files' => notice_files_for($wrId),
    ];
}

/**
 * 공지 1건 삭제 (첨부 파일 + g4_board_file 행 + g4_write_notice 행)
 *
 * ⚠ 되돌릴 수 없습니다.
 *
 * @param int $wrId
 * @return array{files: int, post: bool}
 */
function notice_delete($wrId)
{
    $wrId = (int) $wrId;
    $pdo = db();

    // 글을 지우면 파일명을 알 수 없으므로 먼저 모읍니다.
    $stmt = $pdo->prepare(
        'SELECT bf_file FROM g4_board_file WHERE bo_table = ? AND wr_id = ?'
    );
    $stmt->execute([NOTICE_BOARD, $wrId]);
    $names = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $pdo->beginTransaction();

    try {
        $pdo->prepare('DELETE FROM g4_board_file WHERE bo_table = ? AND wr_id = ?')
            ->execute([NOTICE_BOARD, $wrId]);

        $del = $pdo->prepare('DELETE FROM ' . NOTICE_TABLE . ' WHERE wr_id = ?');
        $del->execute([$wrId]);
        $post = $del->rowCount() > 0;

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    // DB 정리가 끝난 뒤에 실제 파일을 지웁니다.
    $removed = 0;

    foreach (notice_file_dirs($wrId) as $dir) {
        foreach ($names as $name) {
            $path = $dir . '/' . basename((string) $name);

            if (is_file($path) && @unlink($path)) {
                $removed++;
            }
        }
    }

    // 고정 공지였다면 고정 목록(bo_notice)에서도 뻐집니다.
    if ($post && in_array($wrId, notice_pinned_ids(), true)) {
        notice_set_pinned($wrId, false);
    }

    return ['files' => $removed, 'post' => $post];
}

/**
 * 조회수 1 증가 (공개 상세를 열 때)
 *
 * 레거시 행은 wr_hit 이 NULL 일 수 있어 COALESCE 로 받습니다.
 *
 * @param int $wrId
 * @return void
 */
function notice_add_hit($wrId)
{
    db()->prepare(
        'UPDATE ' . NOTICE_TABLE . ' SET wr_hit = COALESCE(wr_hit, 0) + 1 WHERE wr_id = ?'
    )->execute([(int) $wrId]);
}

/**
 * 목록 정렬(wr_id DESC) 기준 이전글 · 다음글
 *
 * @param int $wrId
 * @return array{prev: array|null, next: array|null}
 */
function notice_neighbours($wrId)
{
    $pdo = db();
    $wrId = (int) $wrId;

    $prev = $pdo->prepare(
        'SELECT wr_id, wr_subject FROM ' . NOTICE_TABLE
        . ' WHERE wr_is_comment = 0 AND wr_id > ? ORDER BY wr_id ASC LIMIT 1'
    );
    $prev->execute([$wrId]);
    $prevRow = $prev->fetch();

    $next = $pdo->prepare(
        'SELECT wr_id, wr_subject FROM ' . NOTICE_TABLE
        . ' WHERE wr_is_comment = 0 AND wr_id < ? ORDER BY wr_id DESC LIMIT 1'
    );
    $next->execute([$wrId]);
    $nextRow = $next->fetch();

    $shape = function ($row) {
        if ($row === false) {
            return null;
        }

        return [
            'id' => (int) $row['wr_id'],
            'title' => (string) $row['wr_subject'],
        ];
    };

    return ['prev' => $shape($prevRow), 'next' => $shape($nextRow)];
}

/**
 * 공개 화면용 공지 상세
 *
 * 관리자 상세에서 이메일 같은 내부 정보를 빼고, 이전글 · 다음글을 붙입니다.
 *
 * @param int $wrId
 * @return array|null 없으면 null
 */
function notice_public_detail($wrId)
{
    $detail = notice_detail($wrId);

    if ($detail === null) {
        return null;
    }

    $files = [];

    foreach ($detail['files'] as $file) {
        $files[] = [
            'no' => (int) $file['no'],
            'name' => (string) $file['name'],
            'size' => (int) $file['size'],
            'width' => (int) $file['width'],
            'height' => (int) $file['height'],
            'isImage' => (bool) $file['isImage'],
            'url' => (string) $file['url'],
        ];
    }

    $neighbours = notice_neighbours($wrId);

    return [
        'id' => $detail['id'],
        'title' => $detail['title'],
        'content' => $detail['content'],
        'link1' => $detail['link1'],
        'link2' => $detail['link2'],
        'pinned' => $detail['pinned'],
        'author' => $detail['author'],
        'hit' => $detail['hit'],
        'createdAt' => $detail['createdAt'],
        'files' => $files,
        'prev' => $neighbours['prev'],
        'next' => $neighbours['next'],
    ];
}

/**
 * 목록용 공지 1건 변환
 *
 * @param array $row
 * @param int   $files 첨부 수
 * @return array
 */
function notice_list_item(array $row, $files = 0)
{
    $wrId = (int) $row['wr_id'];

    return [
        'id' => $wrId,
        'title' => (string) $row['wr_subject'],
        'pinned' => in_array($wrId, notice_pinned_ids(), true),
        'author' => (string) $row['wr_name'],
        'hit' => (int) $row['wr_hit'],
        'fileCount' => (int) $files,
        'hasLink' => trim((string) $row['wr_link1']) !== '' || trim((string) $row['wr_link2']) !== '',
        'createdAt' => (string) $row['wr_datetime'],
    ];
}

/**
 * 공지 목록 (관리자)
 *
 * @param array $query page · size · keyword · from · to
 * @return array{items: array, totalCount: int, totalPages: int, page: int, size: int}
 */
function notice_list(array $query)
{
    $pdo = db();

    // DB(bo_notice)에 남아 있는 고정 공지 중 사라진 글을 먼저 정리합니다.
    notice_prune_pinned();

    $page = isset($query['page']) ? max(1, (int) $query['page']) : 1;
    $size = isset($query['size']) ? min(100, max(1, (int) $query['size'])) : 15;
    $keyword = isset($query['keyword']) ? trim((string) $query['keyword']) : '';
    $dateFrom = isset($query['from']) ? trim((string) $query['from']) : '';
    $dateTo = isset($query['to']) ? trim((string) $query['to']) : '';

    $where = ['wr_is_comment = 0'];
    $params = [];

    if ($keyword !== '') {
        $where[] = '(wr_subject LIKE ? OR wr_content LIKE ?)';
        $like = '%' . $keyword . '%';
        $params[] = $like;
        $params[] = $like;
    }

    // 작성일 기간
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
        $where[] = 'wr_datetime >= ?';
        $params[] = $dateFrom . ' 00:00:00';
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
        $where[] = 'wr_datetime <= ?';
        $params[] = $dateTo . ' 23:59:59';
    }

    $whereSql = implode(' AND ', $where);

    // 상단 고정 공지가 있으면 맨 위에 (bo_notice 에 적힌 순서 그대로)
    $pinned = notice_pinned_ids();
    $orderSql = 'wr_id DESC';

    if ($pinned) {
        // FIELD() 는 목록에 없는 값이면 0 → 고정 공지가 먼저 오게 합니다.
        $ids = implode(',', array_map('intval', $pinned));
        $orderSql = 'FIELD(wr_id, ' . $ids . ') = 0, FIELD(wr_id, ' . $ids . '), wr_id DESC';
    }

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM ' . NOTICE_TABLE . ' WHERE ' . $whereSql);
    $countStmt->execute($params);
    $totalCount = (int) $countStmt->fetchColumn();

    $totalPages = max(1, (int) ceil($totalCount / $size));
    $offset = ($page - 1) * $size;

    $sql = 'SELECT wr_id, wr_subject, wr_name, wr_hit, wr_link1, wr_link2, wr_datetime,'
        . ' (SELECT COUNT(*) FROM g4_board_file f WHERE f.bo_table = ? AND f.wr_id = e.wr_id) AS file_count'
        . ' FROM ' . NOTICE_TABLE . ' e'
        . ' WHERE ' . $whereSql
        . ' ORDER BY ' . $orderSql . ' LIMIT ' . $size . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge([NOTICE_BOARD], $params));

    $items = [];

    foreach ($stmt->fetchAll() as $row) {
        $items[] = notice_list_item($row, (int) $row['file_count']);
    }

    return [
        'items' => $items,
        'totalCount' => $totalCount,
        'totalPages' => $totalPages,
        'page' => $page,
        'size' => $size,
        // 고정 설정 상태 — 화면에서 바로 확인할 수 있게 함께 돌려줍니다.
        'pinnedRaw' => notice_pinned_raw(),
        'pinnedIds' => $pinned,
        'pinnedNotListed' => notice_pinned_not_listed(),
    ];
}
