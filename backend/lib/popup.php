<?php
/**
 * 팝업 배너 도메인 헬퍼
 *
 *   popup_banner — 팝업 1건 (제목·링크·노출기간·사용여부·위치·이미지 1장)
 *   이미지       — 웹루트 uploads/popup/ (서버 /uploads/popup) 에 평면 저장
 *
 * 참고: 위드원상담코칭연구소_리뉴얼 의 팝업 로직을 같은 구조로 옮겼습니다.
 *       (테이블·컬럼 이름을 그대로 쓰고, 프론트 응답만 기존 API 규약대로 camelCase)
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/upload.php';
require_once __DIR__ . '/html.php';

const POPUP_TABLE = 'popup_banner';

/** 이미지 폴더 (웹루트/uploads 아래 = /uploads/popup) */
const POPUP_UPLOAD_DIR = 'popup';

/** 이미지 제한 — apps/src/api/popups.ts 와 동일하게 유지하세요. */
const POPUP_IMAGE_MAX_BYTES = 10485760; // 10MB
const POPUP_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

/** 제목 · 주소 길이 */
const POPUP_TITLE_MAX = 200;
const POPUP_URL_MAX = 500;

/** 정렬 순서 범위 (앱의 선택 목록과 동일) */
const POPUP_SORT_MAX = 10;

/** 위치 지정 범위 (px) */
const POPUP_POSITION_MAX = 9999;

/**
 * 팝업 테이블이 있는지 확인합니다.
 *
 * @return bool
 */
function popup_table_exists()
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
        $stmt->execute([POPUP_TABLE]);

        $exists = (int) $stmt->fetchColumn() > 0;
    } catch (Throwable $e) {
        $exists = false;
    }

    return $exists;
}

/**
 * 테이블이 없을 때 안내 문구
 *
 * @return string
 */
function popup_missing_table_message()
{
    return '팝업 테이블이 없습니다. phpMyAdmin 에서 backend/sql/popup_banner.sql 을 실행해 주세요.';
}

/**
 * 검색용 날짜 (형식이 아니면 빈 값)
 *
 * @param mixed $value
 * @return string
 */
function popup_filter_date($value)
{
    $value = trim((string) $value);

    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
}

/**
 * payload(JSON) 를 검증하고 저장에 쓸 값으로 정리합니다.
 *
 * @param array $payload
 * @return array
 */
function popup_input(array $payload)
{
    $title = isset($payload['title']) ? trim((string) $payload['title']) : '';
    $url = isset($payload['url']) ? trim((string) $payload['url']) : '';
    $linkTarget = isset($payload['link_target']) ? trim((string) $payload['link_target']) : '_self';
    $start = popup_filter_date($payload['period_start'] ?? '');
    $end = popup_filter_date($payload['period_end'] ?? '');
    $useYn = isset($payload['use_yn']) ? strtoupper(trim((string) $payload['use_yn'])) : 'Y';
    $sortOrder = isset($payload['sort_order']) ? (int) $payload['sort_order'] : 1;
    $posLeft = isset($payload['img_pos_left']) ? (int) $payload['img_pos_left'] : 0;
    $posTop = isset($payload['img_pos_top']) ? (int) $payload['img_pos_top'] : 0;

    if ($title === '') {
        json_error('제목을 입력해 주세요.', 422);
    }

    if (text_length($title) > POPUP_TITLE_MAX) {
        json_error('제목은 ' . POPUP_TITLE_MAX . '자까지 입력할 수 있습니다.', 422);
    }

    if (text_length($url) > POPUP_URL_MAX) {
        json_error('링크 주소는 ' . POPUP_URL_MAX . '자까지 입력할 수 있습니다.', 422);
    }

    // 주소는 http(s) 또는 사이트 내부 경로(/...) 만 허용합니다.
    if ($url !== '' && !preg_match('#^(https?://|/)#i', $url)) {
        json_error('링크 주소는 http:// 또는 / 로 시작해야 합니다.', 422);
    }

    if ($linkTarget !== '_self' && $linkTarget !== '_blank') {
        $linkTarget = '_self';
    }

    if (isset($payload['period_start']) && trim((string) $payload['period_start']) !== '' && $start === '') {
        json_error('노출 시작일 형식이 올바르지 않습니다. (YYYY-MM-DD)', 422);
    }

    if (isset($payload['period_end']) && trim((string) $payload['period_end']) !== '' && $end === '') {
        json_error('노출 종료일 형식이 올바르지 않습니다. (YYYY-MM-DD)', 422);
    }

    if ($start !== '' && $end !== '' && $start > $end) {
        json_error('노출 종료일은 시작일보다 빠를 수 없습니다.', 422);
    }

    if ($useYn !== 'Y' && $useYn !== 'N') {
        $useYn = 'N';
    }

    if ($sortOrder < 1) {
        $sortOrder = 1;
    }

    if ($sortOrder > POPUP_SORT_MAX) {
        $sortOrder = POPUP_SORT_MAX;
    }

    return [
        'title' => $title,
        'url' => $url,
        'link_target' => $linkTarget,
        'period_start' => $start === '' ? null : $start,
        'period_end' => $end === '' ? null : $end,
        'use_yn' => $useYn,
        'sort_order' => $sortOrder,
        'img_pos_left' => max(-POPUP_POSITION_MAX, min(POPUP_POSITION_MAX, $posLeft)),
        'img_pos_top' => max(-POPUP_POSITION_MAX, min(POPUP_POSITION_MAX, $posTop)),
    ];
}

/**
 * 올린 팝업 이미지 ($_FILES['image']).
 *
 * 없으면 null, 잘못된 파일이면 422 로 종료합니다.
 *
 * @return array|null
 */
function popup_uploaded_image()
{
    if (empty($_FILES['image']) || !is_array($_FILES['image'])) {
        return null;
    }

    $file = $_FILES['image'];

    // 여러 장이 올라온 경우는 받지 않습니다.
    if (isset($file['error']) && is_array($file['error'])) {
        json_error('팝업 이미지는 1장만 올릴 수 있습니다.', 422);
    }

    $error = isset($file['error']) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;

    if ($error === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if ($error !== UPLOAD_ERR_OK) {
        json_error('이미지를 올리지 못했습니다. (오류 ' . $error . ')', 422);
    }

    if ((int) $file['size'] <= 0) {
        json_error('빈 파일은 올릴 수 없습니다.', 422);
    }

    if ((int) $file['size'] > POPUP_IMAGE_MAX_BYTES) {
        json_error(
            '이미지는 ' . round(POPUP_IMAGE_MAX_BYTES / 1048576) . 'MB 이하만 올릴 수 있습니다.',
            422
        );
    }

    $extension = strtolower((string) pathinfo((string) $file['name'], PATHINFO_EXTENSION));

    if (!in_array($extension, POPUP_IMAGE_EXT, true)) {
        json_error('jpg · png · gif · webp 이미지만 올릴 수 있습니다.', 422);
    }

    return $file;
}

/**
 * 이미지를 폴더로 옮깁니다.
 *
 * @param array $file popup_uploaded_image() 결과
 * @return array{ori: string, save: string, path: string, width: int, height: int}
 */
function popup_store_image(array $file)
{
    $dir = upload_dir(POPUP_UPLOAD_DIR);

    if ($dir === null) {
        json_error('이미지를 저장할 폴더를 만들 수 없습니다. 서버 권한을 확인해 주세요.', 500);
    }

    $moved = upload_move_file($file, $dir);

    if ($moved === null) {
        json_error('이미지를 저장하지 못했습니다.', 500);
    }

    // 확장자만 이미지인 파일을 막습니다.
    if (!$moved['is_image']) {
        @unlink($dir . '/' . $moved['file']);
        json_error('이미지 파일이 아닙니다.', 422);
    }

    return [
        'ori' => (string) $file['name'],
        'save' => $moved['file'],
        'path' => $dir . '/' . $moved['file'],
        'width' => (int) $moved['width'],
        'height' => (int) $moved['height'],
    ];
}

/**
 * 저장된 이미지 파일을 지웁니다.
 *
 * @param string $saveName img_save_name
 * @return int 지운 파일 수 (0 또는 1)
 */
function popup_remove_image($saveName)
{
    $path = upload_file_path(POPUP_UPLOAD_DIR, (string) $saveName);

    if ($path !== '' && is_file($path)) {
        @unlink($path);

        return 1;
    }

    return 0;
}

/**
 * DB 행 → 화면에 넘길 값 (camelCase)
 *
 * @param array $row
 * @return array
 */
function popup_out(array $row)
{
    $saveName = isset($row['img_save_name']) ? (string) $row['img_save_name'] : '';

    return [
        'id' => (int) $row['id'],
        'title' => (string) $row['admin_title'],
        'url' => (string) $row['url'],
        'linkTarget' => (string) $row['link_target'],
        'periodStart' => isset($row['period_start']) && $row['period_start'] !== null
            ? (string) $row['period_start']
            : '',
        'periodEnd' => isset($row['period_end']) && $row['period_end'] !== null
            ? (string) $row['period_end']
            : '',
        'useYn' => (string) $row['use_yn'],
        'sortOrder' => (int) $row['sort_order'],
        'posLeft' => (int) $row['img_pos_left'],
        'posTop' => (int) $row['img_pos_top'],
        'imageName' => (string) $row['img_ori_name'],
        'imageUrl' => $saveName === '' ? '' : upload_file_url(POPUP_UPLOAD_DIR, $saveName),
        'width' => (int) $row['img_width'],
        'height' => (int) $row['img_height'],
        'createdAt' => (string) $row['created_at'],
        'updatedAt' => (string) $row['updated_at'],
    ];
}

/**
 * 팝업 1건의 DB 행
 *
 * @param int $id
 * @return array|null
 */
function popup_row($id)
{
    $stmt = db()->prepare('SELECT * FROM ' . POPUP_TABLE . ' WHERE id = ? LIMIT 1');
    $stmt->execute([(int) $id]);
    $row = $stmt->fetch();

    return $row === false ? null : $row;
}

/**
 * 관리자 목록
 *
 * @param array $query page, size, keyword, use_yn, from, to
 * @return array{items: array, totalCount: int, totalPages: int, page: int, size: int}
 */
function popup_list(array $query)
{
    $page = max(1, (int) ($query['page'] ?? 1));
    $size = (int) ($query['size'] ?? 15);
    $size = $size < 1 ? 15 : min(100, $size);
    $keyword = trim((string) ($query['keyword'] ?? ''));
    $useYn = strtoupper(trim((string) ($query['use_yn'] ?? '')));
    $from = popup_filter_date($query['from'] ?? '');
    $to = popup_filter_date($query['to'] ?? '');

    $where = [];
    $params = [];

    if ($keyword !== '') {
        $where[] = 'admin_title LIKE ?';
        $params[] = '%' . $keyword . '%';
    }

    if ($useYn === 'Y' || $useYn === 'N') {
        $where[] = 'use_yn = ?';
        $params[] = $useYn;
    }

    // 노출기간 검색 — 기간을 정하지 않은(상시) 팝업도 함께 봅니다.
    if ($from !== '') {
        $where[] = '(period_end IS NULL OR period_end >= ?)';
        $params[] = $from;
    }

    if ($to !== '') {
        $where[] = '(period_start IS NULL OR period_start <= ?)';
        $params[] = $to;
    }

    $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';
    $pdo = db();

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM ' . POPUP_TABLE . $whereSql);
    $countStmt->execute($params);
    $totalCount = (int) $countStmt->fetchColumn();

    $listStmt = $pdo->prepare(
        'SELECT * FROM ' . POPUP_TABLE . $whereSql
        . ' ORDER BY use_yn DESC, sort_order ASC, id ASC'
        . ' LIMIT ' . $size . ' OFFSET ' . (($page - 1) * $size)
    );
    $listStmt->execute($params);

    $items = [];

    foreach ($listStmt->fetchAll() as $row) {
        $items[] = popup_out($row);
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
 * 팝업 1건 상세
 *
 * @param int $id
 * @return array|null 없으면 null
 */
function popup_detail($id)
{
    $row = popup_row($id);

    return $row === null ? null : popup_out($row);
}

/**
 * 공개 사이트에 띄울 팝업 (사용 중 + 오늘 기준 노출기간 안)
 *
 * @return array<int, array>
 */
function popup_active_list()
{
    $today = (new DateTimeImmutable())->format('Y-m-d');

    $stmt = db()->prepare(
        'SELECT * FROM ' . POPUP_TABLE
        . " WHERE use_yn = 'Y'"
        . ' AND (period_start IS NULL OR period_start <= ?)'
        . ' AND (period_end IS NULL OR period_end >= ?)'
        . ' ORDER BY sort_order ASC, id ASC'
    );
    $stmt->execute([$today, $today]);

    $items = [];

    foreach ($stmt->fetchAll() as $row) {
        $items[] = popup_out($row);
    }

    return $items;
}

/**
 * 팝업 등록
 *
 * @param array      $input   popup_input() 결과
 * @param array|null $image   popup_uploaded_image() 결과 (등록 시 필수)
 * @param string     $adminId
 * @return int 생성된 id
 */
function popup_create(array $input, $image, $adminId)
{
    $pdo = db();
    $pdo->beginTransaction();
    $stored = null;

    try {
        $stored = popup_store_image($image);

        $stmt = $pdo->prepare(
            'INSERT INTO ' . POPUP_TABLE
            . ' (admin_title, url, link_target, period_start, period_end,'
            . ' use_yn, sort_order, img_pos_left, img_pos_top,'
            . ' img_ori_name, img_save_name, img_url, img_width, img_height,'
            . ' author, created_by, updated_by)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $input['title'],
            $input['url'],
            $input['link_target'],
            $input['period_start'],
            $input['period_end'],
            $input['use_yn'],
            $input['sort_order'],
            $input['img_pos_left'],
            $input['img_pos_top'],
            $stored['ori'],
            $stored['save'],
            '/uploads/' . POPUP_UPLOAD_DIR . '/' . $stored['save'],
            $stored['width'],
            $stored['height'],
            $adminId,
            $adminId,
            $adminId,
        ]);

        $id = (int) $pdo->lastInsertId();

        $pdo->commit();

        return $id;
    } catch (Throwable $e) {
        $pdo->rollBack();

        // DB 는 되돌렸지만 이미 옮겨 둔 파일이 있으면 함께 지웁니다.
        if ($stored !== null) {
            upload_cleanup([$stored['path']]);
        }

        throw $e;
    }
}

/**
 * 팝업 수정
 *
 * @param int        $id
 * @param array      $input
 * @param array|null $image 새 이미지 (없으면 기존 이미지 유지)
 * @param string     $adminId
 * @return void
 */
function popup_update($id, array $input, $image, $adminId)
{
    $row = popup_row($id);

    if ($row === null) {
        json_error('해당 팝업을 찾을 수 없습니다.', 404);
    }

    $pdo = db();
    $pdo->beginTransaction();
    $stored = null;
    $oldSave = (string) $row['img_save_name'];
    $oldOri = (string) $row['img_ori_name'];

    try {
        if ($image !== null) {
            $stored = popup_store_image($image);
            $oldSave = (string) $row['img_save_name'];
            $oldOri = $stored['ori'];
        }

        $stmt = $pdo->prepare(
            'UPDATE ' . POPUP_TABLE
            . ' SET admin_title = ?, url = ?, link_target = ?,'
            . ' period_start = ?, period_end = ?, use_yn = ?, sort_order = ?,'
            . ' img_pos_left = ?, img_pos_top = ?,'
            . ' img_ori_name = ?, img_save_name = ?, img_url = ?, img_width = ?, img_height = ?,'
            . ' updated_by = ?, updated_at = NOW()'
            . ' WHERE id = ?'
        );

        $stmt->execute([
            $input['title'],
            $input['url'],
            $input['link_target'],
            $input['period_start'],
            $input['period_end'],
            $input['use_yn'],
            $input['sort_order'],
            $input['img_pos_left'],
            $input['img_pos_top'],
            $oldOri,
            $stored === null ? (string) $row['img_save_name'] : $stored['save'],
            $stored === null ? (string) $row['img_url'] : '/uploads/' . POPUP_UPLOAD_DIR . '/' . $stored['save'],
            $stored === null ? (int) $row['img_width'] : $stored['width'],
            $stored === null ? (int) $row['img_height'] : $stored['height'],
            $adminId,
            (int) $id,
        ]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();

        if ($stored !== null) {
            upload_cleanup([$stored['path']]);
        }

        throw $e;
    }

    // DB 반영이 끝난 뒤에 기존 파일을 지웁니다. (새 이미지가 있을 때만)
    if ($stored !== null && $oldSave !== '' && $oldSave !== $stored['save']) {
        popup_remove_image($oldSave);
    }
}

/**
 * 사용 여부만 변경 (목록의 토글)
 *
 * @param int    $id
 * @param string $useYn 'Y' | 'N'
 * @param string $adminId
 * @return void
 */
function popup_set_use($id, $useYn, $adminId)
{
    if ($useYn !== 'Y' && $useYn !== 'N') {
        json_error('사용 여부는 Y 또는 N 이어야 합니다.', 422);
    }

    if (popup_row($id) === null) {
        json_error('해당 팝업을 찾을 수 없습니다.', 404);
    }

    db()->prepare(
        'UPDATE ' . POPUP_TABLE . ' SET use_yn = ?, updated_by = ?, updated_at = NOW() WHERE id = ?'
    )->execute([$useYn, $adminId, (int) $id]);
}

/**
 * 팝업 삭제 (이미지 파일도 함께)
 *
 * @param int $id
 * @return array{deleted: bool, files: int}
 */
function popup_delete($id)
{
    $row = popup_row($id);

    if ($row === null) {
        return ['deleted' => false, 'files' => 0];
    }

    db()->prepare('DELETE FROM ' . POPUP_TABLE . ' WHERE id = ?')->execute([(int) $id]);

    return ['deleted' => true, 'files' => popup_remove_image((string) $row['img_save_name'])];
}
