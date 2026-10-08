<?php
/**
 * 영문 번역 저장소
 *
 * 관리자가 쓴 한국어 원문(전시·공지·전시장·팝업·개인정보처리방침)의 **영문**을
 * 한 표에 모아 둡니다. 행마다 원문의 지문(sha1)을 함께 적어 두기 때문에,
 * 관리자가 한국어를 고치면 그 항목만 "오래됨" 으로 잡혀 다시 번역됩니다.
 *
 * 왜 각 테이블에 `*_en` 컬럼을 붙이지 않았나
 *   전시는 `exhibition`, 공지는 그누보드 `g4_write_notice`, 전시장은 `hall`,
 *   팝업은 `popup_banner`, 방침은 `site_setting`… 다섯 곳의 스키마를 각각
 *   고치면 마이그레이션도 코드도 다섯 벌이 됩니다. 번역은 언제든 다시 만들 수
 *   있는 파생 데이터라, 한 표에 모으고 (대상, 번호, 항목) 으로 찾습니다.
 *
 * 표가 아직 없어도(마이그레이션 전) 아무 일도 일어나지 않습니다 —
 * 읽기는 빈 값, 쓰기는 조용히 건너뜀. 화면은 한국어로 정상 동작합니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/translate.php';

/** 번역 표 (backend/sql/translation.sql) */
const TRANSLATION_TABLE = 'translation';

/**
 * 대상별 원문 테이블 — 각 도메인 lib 의 상수를 그대로 옮겨 적었습니다.
 * (translation.php 는 도메인 lib 을 require 하지 않습니다 — 서로 물고 도는 것을 피하려고)
 *   exhibition   ·  backend/lib/exhibition.php  EXHIBITION_TABLE
 *   notice       ·  backend/lib/notice.php      NOTICE_TABLE
 *   hall         ·  backend/lib/hall.php        HALL_TABLE
 *   popup        ·  backend/lib/popup.php       POPUP_TABLE
 *   setting      ·  backend/lib/setting.php     SETTING_TABLE
 */
const TRANSLATION_TABLES = [
    'exhibition' => 'exhibition',
    'notice' => 'g4_write_notice',
    'hall' => 'hall',
    'popup' => 'popup_banner',
    'setting' => 'site_setting',
];

/** 번역 대상 그룹 이름 (관리자 화면) */
const TRANSLATION_ENTITY_LABELS = [
    'exhibition' => '전시',
    'notice' => '공지',
    'hall' => '전시장',
    'popup' => '팝업',
    'setting' => '개인정보처리방침',
];

/** 원문이 HTML 인 항목 (태그를 살려서 번역해야 하는 것) */
const TRANSLATION_HTML_FIELDS = [
    'exhibition' => ['overview', 'bio'],
    'notice' => ['body'],
    'setting' => ['html'],
];

/**
 * 항목 이름 — API 필드 이름과 화면에 쓸 이름
 *
 * @param string $entity
 * @return array<string, string> field => 한글 이름
 */
function translation_fields($entity)
{
    $fields = [
        'exhibition' => [
            'title' => '전시명',
            'artist' => '작가명',
            'place' => '전시장소',
            'overview' => '전시개요',
            'bio' => '작가약력',
        ],
        'notice' => [
            'title' => '제목',
            'body' => '본문',
        ],
        'hall' => [
            'name' => '전시장명',
            'spec' => '규모',
        ],
        'popup' => [
            'title' => '제목',
        ],
        'setting' => [
            'html' => '본문',
        ],
    ];

    return isset($fields[$entity]) ? $fields[$entity] : [];
}

/** 이 항목이 HTML 인지 */
function translation_field_is_html($entity, $field)
{
    $list = isset(TRANSLATION_HTML_FIELDS[$entity]) ? TRANSLATION_HTML_FIELDS[$entity] : [];

    return in_array((string) $field, $list, true);
}

/** 표가 있는지 (없으면 모든 함수가 조용히 빈 값을 돌려줍니다) */
function translation_table_exists()
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
        $stmt->execute([TRANSLATION_TABLE]);

        $exists = (int) $stmt->fetchColumn() > 0;
    } catch (Throwable $e) {
        $exists = false;
    }

    return $exists;
}

/** 표가 없을 때 관리자에게 보여 줄 안내 */
function translation_missing_table_message()
{
    return '번역 표가 없습니다. phpMyAdmin 에서 backend/sql/translation.sql 을 실행해 주세요.';
}

/** 원문 지문 — 공백 차이로 다시 번역하지 않도록 줄바꿈·끝공백만 정리합니다 */
function translation_hash($text)
{
    $normalized = str_replace(["\r\n", "\r"], "\n", (string) $text);

    return sha1(trim($normalized));
}

/** 이 요청 동안의 메모리 캐시 — 목록 한 번에 한 쿼리만 나가게 */
function translation_cache_rows($entity, $fresh = false)
{
    static $cache = [];

    $entity = (string) $entity;

    if ($fresh) {
        unset($cache[$entity]);
    }

    if (isset($cache[$entity])) {
        return $cache[$entity];
    }

    $cache[$entity] = [];

    if (!translation_table_exists()) {
        return $cache[$entity];
    }

    try {
        $stmt = db()->prepare(
            'SELECT tr_ref, tr_field, tr_source_hash, tr_text, tr_provider'
            . ' FROM ' . TRANSLATION_TABLE . ' WHERE tr_entity = ?'
        );
        $stmt->execute([$entity]);

        foreach ($stmt->fetchAll() as $row) {
            $cache[$entity][(string) $row['tr_ref']][(string) $row['tr_field']] = [
                'hash' => (string) $row['tr_source_hash'],
                'text' => (string) $row['tr_text'],
                'provider' => (string) $row['tr_provider'],
            ];
        }
    } catch (Throwable $e) {
        error_log('[translation read] ' . $e->getMessage());
    }

    return $cache[$entity];
}

/**
 * 한 항목의 영문들
 *
 * @param string     $entity
 * @param string|int $ref    번호를 문자열로 받습니다 (전시 ex_id · 공지 wr_id …)
 * @return array<string, string> field => 영문 (없는 항목은 아예 빠집니다)
 */
function translation_texts($entity, $ref)
{
    $rows = translation_cache_rows($entity);
    $key = (string) $ref;

    if (!isset($rows[$key])) {
        return [];
    }

    $out = [];

    foreach ($rows[$key] as $field => $row) {
        if (trim($row['text']) !== '') {
            $out[$field] = $row['text'];
        }
    }

    return $out;
}

/**
 * 여러 항목의 영문 한 번에
 *
 * @param string             $entity
 * @param array<int, string> $refs
 * @return array<string, array<string, string>>
 */
function translation_texts_many($entity, array $refs)
{
    $out = [];

    foreach ($refs as $ref) {
        $out[(string) $ref] = translation_texts($entity, $ref);
    }

    return $out;
}

/**
 * 원문을 읽어 영문을 채웁니다. 이미 같은 원문으로 번역해 두었으면 건너뜁니다.
 *
 * 저장(등록·수정) 직후에 부르는 자리라 **절대 예외를 던지지 않습니다** —
 * 번역이 안 됐다고 해서 관리자가 쓴 글이 저장되지 않으면 안 됩니다.
 *
 * @param string               $entity
 * @param string|int           $ref    번호를 문자열로 받습니다 (전시 ex_id · 공지 wr_id …)
 * @param array<string, mixed> $texts field => 한국어 원문
 * @param bool                 $force  true 면 원문이 같아도 다시 번역합니다
 *                                     (관리자가 "이 항목 다시 번역" 을 눌렀을 때)
 * @return array{done: int, skipped: int, failed: int}
 */
function translation_ensure($entity, $ref, array $texts, $force = false)
{
    $result = ['done' => 0, 'skipped' => 0, 'failed' => 0];
    $fields = translation_fields($entity);

    if ($fields === [] || !translation_table_exists()) {
        return $result;
    }

    $ref = (string) $ref;

    foreach ($fields as $field => $label) {
        if (!array_key_exists($field, $texts)) {
            continue;
        }

        $source = (string) $texts[$field];

        if (trim($source) === '') {
            continue;
        }

        $hash = translation_hash($source);
        $rows = translation_cache_rows($entity);
        $saved = isset($rows[$ref][$field]) ? $rows[$ref][$field] : null;

        if (!$force && $saved !== null && $saved['hash'] === $hash && trim($saved['text']) !== '') {
            $result['skipped']++;
            continue;
        }

        $english = translate_to_en($source, translation_field_is_html($entity, $field));

        if ($english === null) {
            $result['failed']++;
            continue;
        }

        if (translation_store($entity, $ref, $field, $hash, $english)) {
            $result['done']++;
        } else {
            $result['failed']++;
        }
    }

    // 저장이 있었으면 이 요청의 캐시를 다시 읽습니다.
    if ($result['done'] > 0) {
        translation_cache_rows($entity, true);
    }

    return $result;
}

/**
 * 영문 1건 저장 (있으면 갱신)
 *
 * @param string $entity
 * @param string $ref
 * @param string $field
 * @param string $hash
 * @param string $text
 * @return bool
 */
function translation_store($entity, $ref, $field, $hash, $text)
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO ' . TRANSLATION_TABLE
            . ' (tr_entity, tr_ref, tr_field, tr_source_hash, tr_text, tr_provider, tr_updated_at)'
            . ' VALUES (?, ?, ?, ?, ?, ?, NOW())'
            . ' ON DUPLICATE KEY UPDATE'
            . '   tr_source_hash = VALUES(tr_source_hash),'
            . '   tr_text = VALUES(tr_text),'
            . '   tr_provider = VALUES(tr_provider),'
            . '   tr_updated_at = NOW()'
        );
        $stmt->execute([
            (string) $entity,
            (string) $ref,
            (string) $field,
            (string) $hash,
            (string) $text,
            translate_settings()['provider'],
        ]);

        return true;
    } catch (Throwable $e) {
        error_log('[translation write] ' . $e->getMessage());

        return false;
    }
}

/**
 * 항목의 영문 전부 지우기 (글을 지웠을 때)
 *
 * @param string     $entity
 * @param string|int $ref
 * @return void
 */
function translation_forget($entity, $ref)
{
    if (!translation_table_exists()) {
        return;
    }

    try {
        db()->prepare(
            'DELETE FROM ' . TRANSLATION_TABLE . ' WHERE tr_entity = ? AND tr_ref = ?'
        )->execute([(string) $entity, (string) $ref]);

        translation_cache_rows($entity, true);
    } catch (Throwable $e) {
        error_log('[translation delete] ' . $e->getMessage());
    }
}

/**
 * 번역할 원문 목록 — 관리자 화면과 일괄 번역이 같은 목록을 봅니다.
 *
 * @param string $entity
 * @return array<int, array{ref: string, label: string, fields: array<string, string>}>
 */
function translation_sources($entity)
{
    $table = isset(TRANSLATION_TABLES[$entity]) ? TRANSLATION_TABLES[$entity] : '';

    if ($table === '' || !translation_source_table_exists($table)) {
        return [];
    }

    try {
        $pdo = db();

        switch ($entity) {
            case 'exhibition':
                $rows = $pdo->query(
                    'SELECT ex_id, ex_title, ex_place, ex_artist, ex_overview, ex_bio'
                    . ' FROM exhibition ORDER BY ex_start_date DESC, ex_id DESC'
                )->fetchAll();
                break;

            case 'notice':
                $rows = $pdo->query(
                    'SELECT wr_id, wr_subject, wr_content FROM g4_write_notice'
                    . ' WHERE wr_is_comment = 0 ORDER BY wr_id DESC'
                )->fetchAll();
                break;

            case 'hall':
                $rows = $pdo->query(
                    'SELECT h_key, h_name, h_spec FROM hall ORDER BY h_id ASC'
                )->fetchAll();
                break;

            case 'popup':
                $rows = $pdo->query(
                    'SELECT id, admin_title FROM popup_banner ORDER BY sort_order ASC, id DESC'
                )->fetchAll();
                break;

            case 'setting':
                $rows = $pdo->query(
                    "SELECT st_key, st_value FROM site_setting WHERE st_key = 'page_privacy_html'"
                )->fetchAll();
                break;

            default:
                $rows = [];
        }
    } catch (Throwable $e) {
        error_log('[translation sources] ' . $e->getMessage());

        return [];
    }

    $items = [];

    foreach ($rows as $row) {
        switch ($entity) {
            case 'exhibition':
                $ref = (string) $row['ex_id'];
                $label = (string) $row['ex_title'];
                $fields = [
                    'title' => (string) $row['ex_title'],
                    'artist' => (string) $row['ex_artist'],
                    'place' => (string) $row['ex_place'],
                    'overview' => (string) $row['ex_overview'],
                    'bio' => (string) $row['ex_bio'],
                ];
                break;

            case 'notice':
                $ref = (string) $row['wr_id'];
                $label = (string) $row['wr_subject'];
                $fields = [
                    'title' => (string) $row['wr_subject'],
                    'body' => (string) $row['wr_content'],
                ];
                break;

            case 'hall':
                $ref = (string) $row['h_key'];
                $label = (string) $row['h_name'];
                $fields = [
                    'name' => (string) $row['h_name'],
                    // 규모 문장도 그대로 보여 주므로 함께 번역합니다.
                    'spec' => (string) $row['h_spec'],
                ];
                break;

            case 'popup':
                $ref = (string) $row['id'];
                $label = (string) $row['admin_title'];
                $fields = ['title' => (string) $row['admin_title']];
                break;

            default:
                $ref = (string) $row['st_key'];
                $label = '개인정보처리방침 본문';
                $fields = ['html' => (string) $row['st_value']];
        }

        $items[] = [
            'ref' => $ref,
            'label' => $label,
            'fields' => $fields,
        ];
    }

    return $items;
}

/** 원문 테이블이 있는지 (없으면 빈 목록) */
function translation_source_table_exists($table)
{
    static $cache = [];

    $table = (string) $table;

    if (array_key_exists($table, $cache)) {
        return $cache[$table];
    }

    $cache[$table] = false;

    try {
        $stmt = db()->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES'
            . ' WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
        );
        $stmt->execute([$table]);

        $cache[$table] = (int) $stmt->fetchColumn() > 0;
    } catch (Throwable $e) {
        $cache[$table] = false;
    }

    return $cache[$table];
}

/**
 * 대상 하나의 번역 현황
 *
 * @param string $entity
 * @return array{entity: string, label: string, total: int, items: int, done: int, missing: int, stale: int}
 */
function translation_status($entity)
{
    $items = translation_sources($entity);
    $rows = translation_cache_rows($entity);
    $fields = translation_fields($entity);

    $total = 0;
    $done = 0;
    $missing = 0;
    $stale = 0;

    foreach ($items as $item) {
        foreach ($fields as $field => $label) {
            $source = isset($item['fields'][$field]) ? trim((string) $item['fields'][$field]) : '';

            if ($source === '') {
                continue;
            }

            $total++;

            $saved = isset($rows[$item['ref']][$field]) ? $rows[$item['ref']][$field] : null;

            if ($saved === null || trim($saved['text']) === '') {
                $missing++;
                continue;
            }

            if ($saved['hash'] !== translation_hash($source)) {
                $stale++;
                continue;
            }

            $done++;
        }
    }

    return [
        'entity' => (string) $entity,
        'label' => isset(TRANSLATION_ENTITY_LABELS[$entity])
            ? TRANSLATION_ENTITY_LABELS[$entity]
            : (string) $entity,
        'total' => $total,
        'items' => count($items),
        'done' => $done,
        'missing' => $missing,
        'stale' => $stale,
    ];
}

/**
 * 모든 대상의 현황
 *
 * @return array<int, array>
 */
function translation_status_all()
{
    $out = [];

    foreach (array_keys(TRANSLATION_ENTITY_LABELS) as $entity) {
        $out[] = translation_status($entity);
    }

    return $out;
}

/**
 * 번역이 필요한 항목만 골라 돌려줍니다. (일괄 번역이 한 번에 몇 건씩 처리)
 *
 * @param string $entity
 * @param string $only   'missing' 남은 것 · 'stale' 원문이 바뀐 것 · 'all' 전부
 * @param int    $limit  한 번에 처리할 항목 수
 * @param string $ref    이 번호만 (빈 값이면 전체)
 * @return array<int, array> translation_sources() 의 부분집합
 */
function translation_pending($entity, $only = 'missing', $limit = 5, $ref = '')
{
    $items = translation_sources($entity);
    $rows = translation_cache_rows($entity);
    $fields = translation_fields($entity);
    $picked = [];

    foreach ($items as $item) {
        if ($ref !== '' && $item['ref'] !== (string) $ref) {
            continue;
        }

        $missing = false;
        $stale = false;

        foreach ($fields as $field => $label) {
            $source = isset($item['fields'][$field]) ? trim((string) $item['fields'][$field]) : '';

            if ($source === '') {
                continue;
            }

            $saved = isset($rows[$item['ref']][$field]) ? $rows[$item['ref']][$field] : null;

            if ($saved === null || trim($saved['text']) === '') {
                $missing = true;
                continue;
            }

            if ($saved['hash'] !== translation_hash($source)) {
                $stale = true;
            }
        }

        if ($only === 'all') {
            $wanted = true;
        } elseif ($only === 'stale') {
            $wanted = $stale;
        } else {
            $wanted = $missing;
        }

        if (!$wanted) {
            continue;
        }

        $picked[] = $item;

        if (count($picked) >= max(1, (int) $limit)) {
            break;
        }
    }

    return $picked;
}
