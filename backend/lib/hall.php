<?php
/**
 * 전시장 도메인 헬퍼
 *
 *   hall       — 전시장 (h_key = hall1~hall4 · 대관 신청·일정 표와 같은 키)
 *   hall_photo — 전시장 사진 (공개 페이지의 가로 스크롤 갤러리)
 *
 * 전시장은 4개가 고정입니다. (대관 시스템이 hall1~hall4 로 동작하므로 추가·삭제는 없습니다)
 * 관리자는 내용·사진·노출 여부만 고칩니다.
 *
 * 실제 파일은 uploads/hall/ 에 평면으로 저장합니다.
 *   도면·조감도  hall1-sheet.jpg ~ hall4-sheet.jpg
 *   도면 파일     hall1-plan.jpg  ~ hall4-plan.jpg
 *   전시장 사진  hall1-photo-01.jpg ~ 08.jpg  (전시장마다 8장)
 *
 * 전시장 사진은 공개 /halls 의 사진 갤러리와 3D 둘러보기 벽면에 함께 쓰입니다.
 *
 * ⚠ h_studio_url 은 더 쓰지 않습니다. (예전에 외부 3D 주소를 적던 칼럼 —
 *    3D 둘러보기는 /halls/:key/studio 화면으로 사이트 안에 들어와 있습니다)
 *
 * ⚠ 프론트(apps/src/api/halls.ts)의 HALL_KEYS / HALL_PHOTO_LIMIT 과 맞춰 주세요.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/upload.php';

const HALL_TABLE = 'hall';
const HALL_PHOTO_TABLE = 'hall_photo';
const HALL_UPLOAD_DIR = 'hall';

/** 전시장 키 — apps/src/api/rentals.ts 의 RENTAL_HALLS 와 같은 순서로 유지하세요. */
const HALL_KEYS = ['hall1', 'hall2', 'hall3', 'hall4'];

/** 사진은 원본과 같이 최대 8장 */
const HALL_PHOTO_LIMIT = 8;

/** 이미지 1장 제한 — 10MB · jpg/jpeg/png/gif/webp */
const HALL_FILE_MAX_BYTES = 10485760;
const HALL_FILE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

/** 글자 수 제한 */
const HALL_TEXT_MAX = [
    'name' => 100,
    'floor' => 20,
    'spec' => 200,
    'month' => 50,
    'note' => 100,
];

/**
 * 테이블이 만들어져 있는지 확인합니다.
 *
 * @param string $table
 * @return bool
 */
function hall_table_exists($table)
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
function hall_missing_table_message()
{
    return '전시장 테이블이 없습니다. phpMyAdmin 에서 backend/sql/hall.sql 을 실행해 주세요.';
}

/**
 * 칼럼이 있는지 확인합니다. (마이그레이션 전 서버 대비)
 *
 * @param string $column
 * @return bool
 */
function hall_has_column($column)
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
        $stmt->execute([HALL_TABLE, $column]);

        $cache[$column] = (int) $stmt->fetchColumn() > 0;
    } catch (Throwable $e) {
        $cache[$column] = false;
    }

    return $cache[$column];
}

/** 도면 칼럼이 없을 때 안내 문구 */
function hall_missing_plan_column_message()
{
    return '전시장 도면 칼럼이 없습니다. phpMyAdmin 에서 backend/sql/hall_plan_name_column.sql 을 실행해 주세요.';
}

/**
 * 업로드 오류 코드를 사람이 읽을 수 있는 문구로 바꿉니다.
 *
 * @param int $error
 * @return string
 */
function hall_upload_error_text($error)
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
 * 올린 이미지 1장을 검증합니다. (도면·사진 공통)
 *
 * @param array  $file  $_FILES 항목
 * @param string $label 오류 문구 앞에 붙일 이름
 * @return array 검증을 통과한 $_FILES 항목
 */
function hall_accepted_file(array $file, $label)
{
    $error = (int) $file['error'];

    if ($error !== UPLOAD_ERR_OK) {
        json_error($label . ': ' . hall_upload_error_text($error), 422);
    }

    $original = (string) $file['name'];
    $extension = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));

    if (!in_array($extension, HALL_FILE_EXT, true)) {
        json_error($label . ': 올릴 수 없는 형식입니다. (jpg · png · gif · webp)', 422);
    }

    if ((int) $file['size'] > HALL_FILE_MAX_BYTES) {
        json_error($label . ': 10MB 이하만 올릴 수 있습니다.', 422);
    }

    // 확장자만 이미지인 파일을 걸러냅니다.
    if (@getimagesize((string) $file['tmp_name']) === false) {
        json_error($label . ': 이미지 파일이 아닙니다.', 422);
    }

    return $file;
}

/**
 * 도면·조감도 이미지 1장 (sheet) — 안 올렸으면 null
 *
 * @return array|null
 */
function hall_sheet_uploaded()
{
    $files = upload_normalize_files('sheet');
    $file = isset($files[0]) ? $files[0] : null;

    if ($file === null || (int) $file['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    return hall_accepted_file($file, '도면·조감도');
}

/**
 * [도면 내려받기] 파일 1개 (plan) — 안 올렸으면 null
 *
 * @return array|null
 */
function hall_plan_uploaded()
{
    $files = upload_normalize_files('plan');
    $file = isset($files[0]) ? $files[0] : null;

    if ($file === null || (int) $file['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    return hall_accepted_file($file, '도면 파일');
}

/**
 * 전시장 사진 (files[])
 *
 * @return array<int, array>
 */
function hall_photos_uploaded()
{
    $accepted = [];

    foreach (upload_normalize_files('files') as $file) {
        if ((int) $file['error'] === UPLOAD_ERR_NO_FILE) {
            continue;
        }

        $accepted[] = hall_accepted_file($file, (string) $file['name']);

        if (count($accepted) > HALL_PHOTO_LIMIT) {
            json_error('전시장 사진은 ' . HALL_PHOTO_LIMIT . '장까지만 올릴 수 있습니다.', 422);
        }
    }

    return $accepted;
}

/**
 * 저장된 사진 1건 → API 모양
 *
 * @param array $row
 * @return array
 */
function hall_photo_item(array $row)
{
    return [
        'id' => (int) $row['hp_id'],
        'url' => upload_file_url(HALL_UPLOAD_DIR, (string) $row['hp_save_name']),
        'name' => (string) $row['hp_ori_name'],
        'width' => (int) $row['hp_width'],
        'height' => (int) $row['hp_height'],
    ];
}

/**
 * 전시장 1행 → API 모양
 *
 * @param array $row    hall 행
 * @param array $photos hall_photo_item() 목록
 * @return array
 */
function hall_item(array $row, array $photos = [])
{
    // 마이그레이션 전 서버에서는 칼럼이 없을 수 있습니다.
    $planName = isset($row['h_plan_name']) ? (string) $row['h_plan_name'] : '';

    return [
        'id' => (int) $row['h_id'],
        'key' => (string) $row['h_key'],
        'name' => (string) $row['h_name'],
        'floor' => (string) $row['h_floor'],
        'spec' => (string) $row['h_spec'],
        'pricePeak' => (int) $row['h_price_peak'],
        'monthPeak' => (string) $row['h_month_peak'],
        'priceOff' => (int) $row['h_price_off'],
        'monthOff' => (string) $row['h_month_off'],
        'priceHigh' => (int) $row['h_price_high'],
        'monthHigh' => (string) $row['h_month_high'],
        'priceNote' => (string) $row['h_price_note'],
        'sheetName' => (string) $row['h_sheet_name'],
        'sheetUrl' => upload_file_url(HALL_UPLOAD_DIR, (string) $row['h_sheet_name']),
        'planName' => $planName,
        'planExt' => $planName === '' ? '' : strtolower((string) pathinfo($planName, PATHINFO_EXTENSION)),
        'planUrl' => upload_file_url(HALL_UPLOAD_DIR, $planName),
        'useYn' => (string) $row['h_use_yn'],
        'updatedAt' => (string) $row['h_updated_at'],
        'photos' => $photos,
    ];
}

/**
 * 전시장 사진 목록 (순서대로)
 *
 * @param int $hallId
 * @return array<int, array>
 */
function hall_photos_for($hallId)
{
    $stmt = db()->prepare(
        'SELECT * FROM ' . HALL_PHOTO_TABLE . ' WHERE h_id = ? ORDER BY hp_no ASC, hp_id ASC'
    );
    $stmt->execute([(int) $hallId]);

    $items = [];

    foreach ($stmt->fetchAll() as $row) {
        $items[] = hall_photo_item($row);
    }

    return $items;
}

/**
 * 관리자 — 전시장 4개
 *
 * @return array<int, array>
 */
function hall_list()
{
    if (!hall_table_exists(HALL_TABLE)) {
        json_error(hall_missing_table_message(), 500);
    }

    $rows = db()->query('SELECT * FROM ' . HALL_TABLE . ' ORDER BY h_id ASC')->fetchAll();

    $items = [];

    foreach ($rows as $row) {
        $items[] = hall_item($row, hall_photos_for((int) $row['h_id']));
    }

    return $items;
}

/**
 * 관리자 — 전시장 1건 (사진 포함)
 *
 * @param int $hallId
 * @return array
 */
function hall_detail($hallId)
{
    $stmt = db()->prepare('SELECT * FROM ' . HALL_TABLE . ' WHERE h_id = ?');
    $stmt->execute([(int) $hallId]);
    $row = $stmt->fetch();

    if (!$row) {
        json_error('전시장을 찾을 수 없습니다.', 404);
    }

    return hall_item($row, hall_photos_for((int) $row['h_id']));
}

/**
 * 공개 — 노출(Y) 중인 전시장 (순서대로 · 사진 포함)
 *
 * 테이블이 없으면 빈 목록을 돌려줍니다. (공개 화면이 깨지지 않게)
 *
 * @return array<int, array>
 */
function hall_public_list()
{
    if (!hall_table_exists(HALL_TABLE)) {
        return [];
    }

    $rows = db()->query(
        'SELECT * FROM ' . HALL_TABLE . " WHERE h_use_yn = 'Y' ORDER BY h_id ASC"
    )->fetchAll();

    $items = [];

    foreach ($rows as $row) {
        $items[] = hall_item($row, hall_photos_for((int) $row['h_id']));
    }

    return $items;
}

/**
 * 금액 문자열 → 정수 (₩ 5,500,000 · 5500000 · 빈 값 → 0)
 *
 * @param mixed $value
 * @return int
 */
function hall_price($value)
{
    $digits = preg_replace('/[^0-9]/', '', (string) $value);

    if ($digits === '' || $digits === null) {
        return 0;
    }

    return min((int) $digits, 999999999);
}

/**
 * payload(JSON) 를 검증하고 저장에 쓸 값으로 정리합니다.
 *
 * @param array $payload
 * @return array
 */
function hall_input(array $payload)
{
    $name = isset($payload['name']) ? trim((string) $payload['name']) : '';
    $floor = isset($payload['floor']) ? trim((string) $payload['floor']) : '';

    if ($name === '') {
        json_error('전시장명을 입력해 주세요.', 422);
    }

    if ($floor === '') {
        json_error('층(위치)을 입력해 주세요.', 422);
    }

    if (mb_strlen($name) > HALL_TEXT_MAX['name']) {
        json_error('전시장명이 너무 깁니다.', 422);
    }

    if (mb_strlen($floor) > HALL_TEXT_MAX['floor']) {
        json_error('층(위치)이 너무 깁니다.', 422);
    }

    $spec = isset($payload['spec']) ? trim((string) $payload['spec']) : '';
    $note = isset($payload['price_note']) ? trim((string) $payload['price_note']) : '';

    if (mb_strlen($spec) > HALL_TEXT_MAX['spec']) {
        json_error('규모 설명이 너무 깁니다.', 422);
    }

    if (mb_strlen($note) > HALL_TEXT_MAX['note']) {
        json_error('요금 안내 문구가 너무 깁니다.', 422);
    }

    $months = [];

    foreach (['peak', 'off', 'high'] as $season) {
        $key = 'month_' . $season;
        $value = isset($payload[$key]) ? trim((string) $payload[$key]) : '';

        if (mb_strlen($value) > HALL_TEXT_MAX['month']) {
            json_error('요금 해당 월이 너무 깁니다.', 422);
        }

        $months[$key] = $value;
    }

    $useYn = isset($payload['use_yn']) ? strtoupper(trim((string) $payload['use_yn'])) : 'Y';

    if ($useYn !== 'Y' && $useYn !== 'N') {
        json_error('노출 여부는 Y 또는 N 이어야 합니다.', 422);
    }

    return [
        'name' => $name,
        'floor' => $floor,
        'spec' => $spec,
        'price_peak' => hall_price(isset($payload['price_peak']) ? $payload['price_peak'] : ''),
        'month_peak' => $months['month_peak'],
        'price_off' => hall_price(isset($payload['price_off']) ? $payload['price_off'] : ''),
        'month_off' => $months['month_off'],
        'price_high' => hall_price(isset($payload['price_high']) ? $payload['price_high'] : ''),
        'month_high' => $months['month_high'],
        'price_note' => $note,
        'use_yn' => $useYn,
    ];
}

/**
 * 새 사진을 저장합니다. (hp_no 는 기존 뒤에 이어 붙입니다)
 *
 * @param PDO   $pdo
 * @param int   $hallId
 * @param array $files hall_photos_uploaded() 결과
 * @return array<int, string> 저장한 파일의 절대 경로 (롤백 정리용)
 */
function hall_save_photos($pdo, $hallId, array $files)
{
    $dir = upload_dir(HALL_UPLOAD_DIR);

    if ($dir === null) {
        return [];
    }

    $saved = [];

    $last = $pdo->prepare(
        'SELECT COALESCE(MAX(hp_no), -1) FROM ' . HALL_PHOTO_TABLE . ' WHERE h_id = ?'
    );
    $last->execute([(int) $hallId]);
    $no = (int) $last->fetchColumn() + 1;

    foreach ($files as $file) {
        $moved = upload_move_file($file, $dir);

        if ($moved === null) {
            continue;
        }

        $saved[] = $dir . '/' . $moved['file'];

        $stmt = $pdo->prepare(
            'INSERT INTO ' . HALL_PHOTO_TABLE
            . ' (h_id, hp_no, hp_save_name, hp_ori_name, hp_ext, hp_size,'
            . ' hp_width, hp_height, hp_created_at)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())'
        );

        $stmt->execute([
            (int) $hallId,
            $no,
            $moved['file'],
            (string) $file['name'],
            strtolower((string) pathinfo((string) $file['name'], PATHINFO_EXTENSION)),
            $moved['size'],
            $moved['width'],
            $moved['height'],
        ]);

        $no++;
    }

    return $saved;
}

/**
 * 남길 사진(hp_id)만 남기고 나머지는 행에서 지웁니다.
 *
 * 파일은 커밋한 뒤에 지웁니다(롤백해도 파일이 사라지지 않게) → 지울 경로를 돌려줍니다.
 * 순서는 keep 에 들어온 차례대로 다시 매깁니다.
 *
 * @param PDO        $pdo
 * @param int        $hallId
 * @param array<int> $keepIds 남길 hp_id (화면에 남아 있는 순서)
 * @return array<int, string> 지울 파일의 절대 경로
 */
function hall_prune_photos($pdo, $hallId, array $keepIds)
{
    $keep = array_map('intval', $keepIds);

    $stmt = $pdo->prepare(
        'SELECT hp_id, hp_save_name FROM ' . HALL_PHOTO_TABLE . ' WHERE h_id = ?'
    );
    $stmt->execute([(int) $hallId]);

    $rows = $stmt->fetchAll();
    $dir = upload_dir(HALL_UPLOAD_DIR, false);
    $del = $pdo->prepare('DELETE FROM ' . HALL_PHOTO_TABLE . ' WHERE hp_id = ?');
    $renumber = $pdo->prepare('UPDATE ' . HALL_PHOTO_TABLE . ' SET hp_no = ? WHERE hp_id = ?');
    $obsolete = [];

    // 남길 것만 순서대로 번호를 다시 매깁니다.
    $order = 0;

    foreach ($keep as $id) {
        $renumber->execute([$order, $id]);
        $order++;
    }

    foreach ($rows as $row) {
        if (in_array((int) $row['hp_id'], $keep, true)) {
            continue;
        }

        $del->execute([(int) $row['hp_id']]);

        if ($dir === null) {
            continue;
        }

        // basename 으로 경로 조작을 막습니다.
        $path = $dir . '/' . basename((string) $row['hp_save_name']);

        if (is_file($path)) {
            $obsolete[] = $path;
        }
    }

    return $obsolete;
}

/**
 * 교체하며 버려질 예전 파일의 경로 (없으면 빈 문자열)
 *
 * @param string|null $dir
 * @param string      $filename
 * @return string
 */
function hall_old_file($dir, $filename)
{
    $name = basename((string) $filename);

    if ($dir === null || $name === '' || !is_file($dir . '/' . $name)) {
        return '';
    }

    return $dir . '/' . $name;
}

/**
 * 전시장 1건을 저장합니다. (도면·조감도 · 도면 파일 교체 포함)
 *
 * @param int        $hallId
 * @param array      $input  hall_input() 결과
 * @param array|null $sheet  hall_sheet_uploaded() 결과 (안 바꾸면 null)
 * @param array|null $plan   hall_plan_uploaded() 결과 (안 바꾸면 null)
 * @param array      $photos hall_photos_uploaded() 결과
 * @param array<int> $keep   남길 사진 hp_id
 * @param string     $adminId
 * @return int $hallId
 */
function hall_update($hallId, array $input, $sheet, $plan, array $photos, array $keep, $adminId)
{
    $pdo = db();

    $check = $pdo->prepare(
        'SELECT h_sheet_name, h_plan_name FROM ' . HALL_TABLE . ' WHERE h_id = ?'
    );
    $check->execute([(int) $hallId]);
    $current = $check->fetch();

    if (!$current) {
        json_error('전시장을 찾을 수 없습니다.', 404);
    }

    $saved = [];
    $obsolete = [];
    $sheetName = null;
    $planName = null;

    $pdo->beginTransaction();

    try {
        $dir = upload_dir(HALL_UPLOAD_DIR);

        if ($sheet !== null) {
            $moved = $dir === null ? null : upload_move_file($sheet, $dir);

            if ($moved === null) {
                throw new RuntimeException('도면·조감도 이미지를 저장하지 못했습니다.');
            }

            $saved[] = $dir . '/' . $moved['file'];
            $sheetName = $moved['file'];
            $obsolete[] = hall_old_file($dir, (string) $current['h_sheet_name']);
        }

        if ($plan !== null) {
            $moved = $dir === null ? null : upload_move_file($plan, $dir);

            if ($moved === null) {
                throw new RuntimeException('도면 파일을 저장하지 못했습니다.');
            }

            $saved[] = $dir . '/' . $moved['file'];
            $planName = $moved['file'];
            $obsolete[] = hall_old_file($dir, (string) $current['h_plan_name']);
        }

        $obsolete = array_merge($obsolete, hall_prune_photos($pdo, $hallId, $keep));
        $saved = array_merge($saved, hall_save_photos($pdo, $hallId, $photos));

        $sql = 'UPDATE ' . HALL_TABLE . ' SET'
            . ' h_name = ?, h_floor = ?, h_spec = ?,'
            . ' h_price_peak = ?, h_month_peak = ?,'
            . ' h_price_off = ?, h_month_off = ?,'
            . ' h_price_high = ?, h_month_high = ?,'
            . ' h_price_note = ?,'
            . ' h_use_yn = ?, h_admin_id = ?, h_updated_at = NOW()';

        $params = [
            $input['name'],
            $input['floor'],
            $input['spec'],
            $input['price_peak'],
            $input['month_peak'],
            $input['price_off'],
            $input['month_off'],
            $input['price_high'],
            $input['month_high'],
            $input['price_note'],
            $input['use_yn'],
            (string) $adminId,
        ];

        if ($sheetName !== null) {
            $sql .= ', h_sheet_name = ?';
            $params[] = $sheetName;
        }

        if ($planName !== null) {
            $sql .= ', h_plan_name = ?';
            $params[] = $planName;
        }

        $sql .= ' WHERE h_id = ?';
        $params[] = (int) $hallId;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();

        // DB 는 되돌렸지만 이미 옮겨 둔 파일이 있으면 함께 지웁니다.
        upload_cleanup($saved);

        throw $e;
    }

    // 커밋 후 정리 (실패해도 무해)
    foreach ($obsolete as $path) {
        if ($path !== '' && is_file($path)) {
            @unlink($path);
        }
    }

    return (int) $hallId;
}
