<?php
/**
 * 사이트 환경설정 도메인 헬퍼
 *
 *   site_setting — '키 = 값' 한 줄짜리 설정 표 (st_key 가 기본키)
 *
 * ---------------------------------------------------------------------------
 * 새 설정을 추가할 때 (고칠 곳은 두 곳뿐입니다)
 *   1) 아래 setting_definitions() 의 알맞은 그룹 → fields 에 한 줄 추가
 *   2) 필요하면 backend/sql/site_setting.sql 에 초기값 한 줄 추가 (선택)
 *   3) 공개 화면에서 쓰는 값이면 'public' => true 로 적고,
 *      apps/src/api/settings.ts 의 SETTING_KEYS 에 같은 키를 추가
 *
 * 관리자 [환경설정] 화면(apps/src/pages/admin/AdminSettingPage.tsx)은
 * 이 정의를 그대로 내려받아 입력칸을 만들기 때문에 프론트는 고칠 필요가 없습니다.
 * ---------------------------------------------------------------------------
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/html.php';
require_once __DIR__ . '/response.php';

const SETTING_TABLE = 'site_setting';

/** 값 한 개의 최대 길이 (TEXT 컬럼이지만 폭주를 막습니다) */
const SETTING_VALUE_MAX = 2000;

/**
 * 값 한 개의 최대 바이트
 *
 * 컬럼이 TEXT(65,535바이트) 일 때를 기준으로 봐야 하지만, MEDIUMTEXT 로 넓혀 쓸 수도 있어서
 * 여기서는 아주 큰 값만 막고, 실제 컬럼 한도는 DB 오류를 잡아 422 로 안내합니다.
 */
const SETTING_VALUE_MAX_BYTES = 1000000;

/** 설정 키 형식 (영문 소문자로 시작, 소문자·숫자·밑줄) */
const SETTING_KEY_PATTERN = '/^[a-z][a-z0-9_]{1,59}$/';

/**
 * 설정 정의 — 관리자 화면과 '저장 가능한 키'의 단일 기준입니다.
 *
 *   그룹키 => [
 *     label  : 화면에 보이는 그룹 제목
 *     help   : 그룹 설명 (선택)
 *     fields : 설정 키 => [
 *       label    : 입력칸 제목
 *       type     : text | textarea           (종류가 필요해지면 여기를 늘립니다)
 *       default  : 값이 없을 때 쓸 기본값
 *       max      : 최대 글자 수 (선택 — 없으면 SETTING_VALUE_MAX)
 *       hint     : 입력칸 아래 도움말 (선택)
 *       public   : 공개 API 로 내보낼지 (선택 — 기본 false)
 *       required : 비워 두지 못하게 할지 (선택 — 기본 false)
 *     ]
 *   ]
 *
 * @return array
 */
function setting_definitions()
{
    return [
        'page_lede' => [
            'label' => '페이지 안내문구',
            'help' => '각 페이지 제목(서브 타이틀) 바로 아래에 나오는 문구입니다. 비워 두면 표시되지 않습니다.',
            // 순서는 사이트 상단 메뉴와 같게 맞춥니다. (전시 · 갤러리 이즈 · 전시장 · 대관 · 소식)
            'fields' => [
                'page_exhibitions_lede' => [
                    'label' => '전시',
                    'type' => 'textarea',
                    'default' => '',
                    'max' => 200,
                    'hint' => '/exhibitions — 목록 상단 탭 위',
                    'public' => true,
                ],
                'page_about_lede' => [
                    'label' => '갤러리 이즈',
                    'type' => 'textarea',
                    'default' => '',
                    'max' => 200,
                    'hint' => '/about — 제목 아래 (원본은 비어 있고, 소개 문구는 본문 인트로 제목으로 들어감)',
                    'public' => true,
                ],
                'page_halls_lede' => [
                    'label' => '전시장',
                    'type' => 'textarea',
                    'default' => '하나의 건축물 안에 네 개의 독립적인 전시실',
                    'max' => 200,
                    'hint' => '/halls — 제목 아래',
                    'public' => true,
                ],
                'page_rental_lede' => [
                    'label' => '대관',
                    'type' => 'textarea',
                    'default' => '',
                    'max' => 200,
                    'hint' => '/rental — 안내 01~04 위',
                    'public' => true,
                ],
                'page_notices_lede' => [
                    'label' => '소식',
                    'type' => 'textarea',
                    'default' => '',
                    'max' => 200,
                    'hint' => '/notices — 목록 위',
                    'public' => true,
                ],
            ],
        ],
        'page_content' => [
            'label' => '개인정보처리방침',
            'help' => '개인정보처리방침 페이지(/privacy)의 내용입니다. 에디터로 제목·목록 같은 서식을 넣을 수 있습니다.',
            'fields' => [
                'page_privacy_html' => [
                    'label' => '처리방침 내용',
                    'type' => 'html',
                    'default' => '',
                    'max' => 50000,
                    'hint' => '/privacy — 제목 아래 본문',
                    'public' => true,
                ],
            ],
        ],
    ];
}

/**
 * 설정 키 => 정의 (그룹 정보를 함께 붙여서 평평하게 만든 것)
 *
 * @return array
 */
function setting_field_map()
{
    static $map = null;

    if ($map !== null) {
        return $map;
    }

    $map = [];

    foreach (setting_definitions() as $groupKey => $group) {
        $groupLabel = isset($group['label']) ? (string) $group['label'] : (string) $groupKey;
        $fields = isset($group['fields']) && is_array($group['fields']) ? $group['fields'] : [];

        foreach ($fields as $key => $field) {
            $field['key'] = (string) $key;
            $field['group'] = (string) $groupKey;
            $field['groupLabel'] = $groupLabel;

            $map[(string) $key] = $field;
        }
    }

    return $map;
}

/**
 * 설정 키 => 기본값
 *
 * @return array
 */
function setting_defaults()
{
    $defaults = [];

    foreach (setting_field_map() as $key => $field) {
        $defaults[$key] = isset($field['default']) ? (string) $field['default'] : '';
    }

    return $defaults;
}

/**
 * 정의에서 '공개'로 표시한 키 목록
 *
 * @return array
 */
function setting_public_keys()
{
    $keys = [];

    foreach (setting_field_map() as $key => $field) {
        if (!empty($field['public'])) {
            $keys[] = $key;
        }
    }

    return $keys;
}

/**
 * 설정 테이블이 있는지 확인합니다.
 *
 * @return bool
 */
function setting_table_exists()
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
        $stmt->execute([SETTING_TABLE]);

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
function setting_missing_table_message()
{
    return '환경설정 테이블이 없습니다. phpMyAdmin 에서 backend/sql/site_setting.sql 을 실행해 주세요.';
}

/**
 * DB 에 저장된 값 (설정 키 => 값)
 *
 * 테이블이 없으면 빈 배열입니다.
 *
 * @return array
 */
function setting_rows()
{
    static $rows = null;

    if ($rows !== null) {
        return $rows;
    }

    $rows = [];

    if (!setting_table_exists()) {
        return $rows;
    }

    try {
        $stmt = db()->query('SELECT st_key, st_value FROM ' . SETTING_TABLE);

        foreach ($stmt->fetchAll() as $row) {
            $rows[(string) $row['st_key']] = (string) $row['st_value'];
        }
    } catch (Throwable $e) {
        error_log('[setting rows] ' . $e->getMessage());

        $rows = [];
    }

    return $rows;
}

/**
 * 저장된 값에 기본값을 채워서 돌려줍니다. (정의에 있는 키만)
 *
 * 행이 있으면 그 값(빈 문자열 포함)을 그대로 씁니다.
 * 행이 없을 때만 기본값을 씁니다. → 관리자가 일부러 비운 값이 되살아나지 않습니다.
 *
 * @return array
 */
function setting_values()
{
    $rows = setting_rows();
    $values = [];

    foreach (setting_defaults() as $key => $default) {
        $values[$key] = array_key_exists($key, $rows) ? $rows[$key] : $default;
    }

    return $values;
}

/**
 * 공개 화면에서 쓰는 값만 (정의에서 'public' => true 인 키)
 *
 * @return array
 */
function setting_public_values()
{
    $values = setting_values();
    $out = [];

    foreach (setting_public_keys() as $key) {
        $out[$key] = isset($values[$key]) ? $values[$key] : '';
    }

    return $out;
}

/**
 * 관리자 화면용 — 그룹 · 입력칸 정의 · 현재 값
 *
 * @return array
 */
function setting_groups()
{
    $values = setting_values();
    $groups = [];

    foreach (setting_definitions() as $groupKey => $group) {
        $fields = [];

        $defs = isset($group['fields']) && is_array($group['fields']) ? $group['fields'] : [];

        foreach ($defs as $key => $field) {
            $key = (string) $key;

            $fields[] = [
                'key' => $key,
                'label' => isset($field['label']) ? (string) $field['label'] : $key,
                'type' => isset($field['type']) ? (string) $field['type'] : 'text',
                'hint' => isset($field['hint']) ? (string) $field['hint'] : '',
                'max' => isset($field['max']) ? (int) $field['max'] : SETTING_VALUE_MAX,
                'required' => !empty($field['required']),
                'value' => isset($values[$key]) ? $values[$key] : '',
            ];
        }

        $groups[] = [
            'key' => (string) $groupKey,
            'label' => isset($group['label']) ? (string) $group['label'] : (string) $groupKey,
            'help' => isset($group['help']) ? (string) $group['help'] : '',
            'fields' => $fields,
        ];
    }

    return $groups;
}

/**
 * 설정값을 저장합니다. (정의에 있는 키만, 없는 키는 조용히 무시)
 *
 * 값이 길거나 필수값이 비어 있으면 422 로 종료합니다.
 *
 * @param array  $input   설정 키 => 값
 * @param string $adminId 마지막 수정 관리자
 *
 * @return array 저장한 값 (설정 키 => 값)
 */
function setting_update(array $input, $adminId = '')
{
    if (!setting_table_exists()) {
        json_error(setting_missing_table_message(), 500);
    }

    $map = setting_field_map();
    $saved = [];

    foreach ($input as $key => $value) {
        $key = (string) $key;

        if (!isset($map[$key]) || !preg_match(SETTING_KEY_PATTERN, $key)) {
            continue;
        }

        $field = $map[$key];
        $type = isset($field['type']) ? (string) $field['type'] : 'text';

        // 에디터로 넣은 HTML 은 위험한 태그·속성을 걷어낸 뒤 저장합니다.
        $text = $type === 'html'
            ? html_clean_posted((string) $value)
            : trim((string) $value);

        $max = isset($field['max']) ? (int) $field['max'] : SETTING_VALUE_MAX;

        if ($max <= 0) {
            $max = SETTING_VALUE_MAX;
        }

        $label = isset($field['label']) ? (string) $field['label'] : $key;

        if (!empty($field['required']) && $text === '') {
            json_error($label . ' 을(를) 입력해 주세요.', 422);
        }

        if (text_length($text) > $max) {
            json_error($label . ' 은(는) ' . $max . '자까지 입력할 수 있습니다.', 422);
        }

        // 컬럼 한도(TEXT = 65,535바이트) 를 넘는 것은 넉넉한 상한으로만 막고,
        // 실제 컬럼 길이 초과는 저장할 때 DB 오류를 잡아 안내합니다.
        if (strlen($text) > SETTING_VALUE_MAX_BYTES) {
            json_error($label . ' 이 너무 큽니다. 내용을 나누어 주세요.', 422);
        }

        $saved[$key] = $text;
    }

    if ($saved === []) {
        json_error('저장할 설정값이 없습니다.', 422);
    }

    // 있으면 수정, 없으면 추가 (MySQL 5.7 · MariaDB 에서도 되는 형식으로 씁니다)
    $stmt = db()->prepare(
        'INSERT INTO ' . SETTING_TABLE . ' (st_key, st_value, updated_by, updated_at)'
        . ' VALUES (?, ?, ?, NOW())'
        . ' ON DUPLICATE KEY UPDATE st_value = ?, updated_by = ?, updated_at = NOW()'
    );

    // 한 항목이라도 실패하면 아무것도 저장되지 않도록 묶습니다.
    db()->beginTransaction();

    try {
        foreach ($saved as $key => $text) {
            $stmt->execute([$key, $text, (string) $adminId, $text, (string) $adminId]);
        }

        db()->commit();
    } catch (PDOException $e) {
        db()->rollBack();

        $driverCode = isset($e->errorInfo[1]) ? (int) $e->errorInfo[1] : 0;

        // 1406 = Data too long for column (컬럼 길이 초과)
        if ((string) $e->getCode() === '22001' || $driverCode === 1406) {
            json_error(
                '저장할 내용이 너무 깁니다. site_setting.sql 안내대로 st_value 를 MEDIUMTEXT 로 넓혀 주세요.',
                422
            );
        }

        throw $e;
    }

    return $saved;
}
