<?php
/**
 * 대관(전시장 대여) 도메인 로직
 *
 * 저장 위치: 그누보드4 게시판 테이블 g4_write_order (기존 데이터와 호환)
 *
 *   wr_subject : 신청자명 (레거시 데이터와 동일 — 관리자 목록의 '신청자' 열)
 *   wr_name    : 신청자명          wr_email : 이메일
 *   wr_1       : 이메일  "아이디|도메인|"
 *   wr_2       : 장르    "서양화|"
 *   wr_3       : 관리자 확인용 메모 (자유 텍스트)
 *   wr_5       : 전시구분 (개인전 / 그룹전 / 석·박사 청구전)
 *   wr_8       : 전시장  "제1전시장(1F)"
 *   wr_9       : 주소    "우편번호|주소1|주소2"
 *   wr_10      : 연락처  "010|1234|5678|||||||"
 *   wr_11      : 시작일  unix timestamp
 *   wr_12      : 종료일  unix timestamp
 *   wr_13      : 상태    1=심사중, 2=대관완료
 *
 * ⚠ g4_write_order 는 euc-kr 테이블입니다.
 *    lib/db.php 에서 SET NAMES utf8mb4 를 실행하므로 PHP 쪽은 UTF-8 로만 다루면 됩니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

const RENTAL_TABLE = 'g4_write_order';
const RENTAL_BOARD = 'order';
/** 한 주 = 수요일 ~ 다음 주 화요일 */
const RENTAL_WEEK_DAYS = 7;
/** 페이지당 주 수 */
const RENTAL_WEEKS_PER_PAGE = 12;
/** 안내 마지막 연도 */
const RENTAL_YEAR_LIMIT = 2027;
/** 전시장(랭킹) 위치 — 첨부파일 저장 경로 */
const RENTAL_BOARD_DIR = 'order';

/** 첨부 제한 — 프론트 src/api/rentals.ts 와 동일하게 유지하세요. */
const RENTAL_FILE_LIMITS = [
    'bio' => [
        'label' => '약력 소개',
        'max' => 3,
        'size' => 15728640,
        'ext' => ['hwp', 'hwpx', 'txt', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'pdf'],
    ],
    'portfolio' => [
        'label' => '포트폴리오',
        'max' => 8,
        'size' => 10485760,
        'ext' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    ],
];

/** 전시구분 매핑 */
const RENTAL_KINDS = [
    'solo' => '개인전',
    'group' => '그룹전',
    'thesis' => '석·박사 청구전',
];

/**
 * 첨부파일이 약력(bio)인지 포트폴리오(portfolio)인지 확장자로 판별합니다.
 * 두 입력란의 허용 확장자가 겹치지 않으므로 확장자만으로 구분할 수 있습니다.
 *
 * @param string $filename
 * @return string 'bio' | 'portfolio'
 */
function rental_file_group($filename)
{
    $extension = strtolower((string) pathinfo($filename, PATHINFO_EXTENSION));

    return in_array($extension, RENTAL_FILE_LIMITS['portfolio']['ext'], true)
        ? 'portfolio'
        : 'bio';
}

/**
 * 전시구분 라벨 → 키
 *
 * @param string $label
 * @return string 모르는 라벨이면 빈 문자열
 */
function rental_kind_key($label)
{
    $key = array_search((string) $label, RENTAL_KINDS, true);

    return $key === false ? '' : (string) $key;
}

/**
 * 관리자 확인용으로 덧붙인 줄을 걷어내고 신청자가 쓴 메모만 남깁니다.
 *
 * @param string $memo wr_3 값
 * @return string
 */
function rental_memo_only($memo)
{
    $lines = preg_split('/\r\n|\r|\n/', (string) $memo);
    $kept = [];

    foreach ((array) $lines as $line) {
        if (preg_match('/^(참여 작가 수|작품 수|장르|첨부) *:/u', trim($line))) {
            continue;
        }

        $kept[] = $line;
    }

    return trim(implode("\n", $kept));
}

/**
 * 메모에 남은 요약 줄에서 참여 작가 수 · 작품 수를 읽어 옵니다.
 * (rt_* 확장 컴럼이 아직 없을 때를 대비한 대비책)
 *
 * @param string $memo
 * @return array{artist_count:int, work_count:int}
 */
function rental_parse_detail($memo)
{
    $text = (string) $memo;
    $artist = 0;
    $work = 0;

    if (preg_match('/참여 작가 수 *: *([0-9]+)/u', $text, $matched)) {
        $artist = (int) $matched[1];
    }

    if (preg_match('/작품 수 *: *([0-9]+)/u', $text, $matched)) {
        $work = (int) $matched[1];
    }

    return ['artist_count' => $artist, 'work_count' => $work];
}

/**
 * 신청자명
 *
 * 새 신청은 wr_name, 레거시 행은 wr_subject 에 들어 있습니다.
 * (레거시 중 관리자가 대신 올린 행은 wr_name = '관리자' 입니다)
 *
 * @param string $name    wr_name
 * @param string $subject wr_subject
 * @return string
 */
function rental_applicant_name($name, $subject)
{
    $applicant = trim((string) $name);
    $subject = trim((string) $subject);

    if ($applicant === '' || ($applicant === '관리자' && $subject !== '')) {
        return $subject;
    }

    return $applicant;
}

/**
 * wr_1 (파이프 형식 이메일) → 읽기 좋은 주소
 *
 * 레거시는 "아이디|도메인|" 또는 "아이디|직접입력|도메인" 두 형태가 섞여 있습니다.
 *
 * @param string $value
 * @return string 만들 수 없으면 빈 문자열
 */
function rental_email_from_pipe($value)
{
    $parts = explode('|', (string) $value);

    if (count($parts) < 2) {
        return '';
    }

    $id = trim($parts[0]);
    $second = trim((string) $parts[1]);
    $third = isset($parts[2]) ? trim((string) $parts[2]) : '';

    if ($id === '') {
        return '';
    }

    // "아이디|직접입력|도메인" 형태
    if ($third !== '') {
        return $id . '@' . $third;
    }

    // "아이디|도메인|" 형태 — '직접입력' 같은 선택 문구는 도메인이 아닙니다.
    if ($second === '' || $second === '직접입력' || $second === '선택하세요') {
        return '';
    }

    return $id . '@' . $second;
}

/**
 * 요청이 들어온 서버 주소 (예: https://galleryiscom.mycafe24.com)
 *
 * 첨부파일 주소를 절대 경로로 돌려주기 위해 씁니다.
 * 개발 중에는 프론트는 localhost, API 는 운영 서버라 상대 경로가 깨집니다.
 *
 * @return string
 */
function rental_request_origin()
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
 * 첨부파일을 웹에서 부를 때 쓸 주소 (예: https://.../uploads)
 *
 * @return string 빈 문자열이면 URL 을 만들 수 없습니다.
 */
function rental_upload_url_base()
{
    $root = rental_upload_root();
    $origin = rental_request_origin();

    if ($root === null || $origin === '') {
        return '';
    }

    return $origin . ($root === dirname(__DIR__, 2) . '/uploads' ? '/uploads' : '/backend/uploads');
}

/** 전시장 목록. DB 의 wr_8 값과 정확히 일치해야 합니다. */
function rental_halls()
{
    return [
        'hall1' => '제1전시장(1F)',
        'hall2' => '제2전시장(2F)',
        'hall3' => '제3전시장(3F)',
        'hall4' => '제4전시장(B1)',
    ];
}

/**
 * 전시장 키 → DB 저장값
 *
 * @param string $hallId
 * @return string|null
 */
function rental_hall_label($hallId)
{
    $halls = rental_halls();
    return isset($halls[$hallId]) ? $halls[$hallId] : null;
}

/**
 * DB 저장값 → 전시장 키
 *
 * @param string $label
 * @return string|null
 */
function rental_hall_id($label)
{
    $index = array_search($label, rental_halls(), true);
    return $index === false ? null : $index;
}

/**
 * 테이블에 해당 컬럼이 있는지
 *
 * sql/rental_extra_columns.sql 을 아직 실행하지 않았어도 오류 없이
 * 동작하도록 하기 위한 장치입니다. 한 요청 안에서는 SHOW COLUMNS 결과를
 * 재사용하므로 반복 호출해도 쿼리는 한 번만 나갑니다.
 *
 * @param string $column
 * @return bool
 */
function rental_has_column($column)
{
    static $columns = null;

    if ($columns === null) {
        $columns = [];

        $rows = db()->query('SHOW COLUMNS FROM ' . RENTAL_TABLE)->fetchAll();

        foreach ($rows as $row) {
            $columns[(string) $row['Field']] = true;
        }
    }

    return isset($columns[$column]);
}

/**
 * 해당 날짜가 속한 주의 수요일 (00:00)
 *
 * @param DateTimeImmutable $date
 * @return DateTimeImmutable
 */
function rental_week_start(DateTimeImmutable $date)
{
    $dayOfWeek = (int) $date->format('N'); // 1=월 … 3=수 … 7=일
    $diff = ($dayOfWeek - 3 + 7) % 7;

    return $date->modify('-' . $diff . ' days')->setTime(0, 0, 0);
}

/**
 * 페이지 번호 → 주 목록
 *
 * @param int $page 0부터 시작
 * @return array<int, array{start: string, end: string}>
 */
function rental_weeks_for_page($page)
{
    $today = new DateTimeImmutable('today');
    $base = rental_week_start($today);
    $offset = max(0, (int) $page) * RENTAL_WEEKS_PER_PAGE * RENTAL_WEEK_DAYS;

    $weeks = [];
    for ($i = 0; $i < RENTAL_WEEKS_PER_PAGE; $i++) {
        $start = $base->modify('+' . ($offset + $i * RENTAL_WEEK_DAYS) . ' days');
        $end = $start->modify('+' . (RENTAL_WEEK_DAYS - 1) . ' days');

        // 주의 끝(화요일)이 안내 마지막 연도를 넘으면 넣지 않습니다.
        // (시작일만 보면 2027-12-29 주가 들어와 2028-01-04 로 끝나버립니다)
        if ((int) $end->format('Y') > RENTAL_YEAR_LIMIT) {
            break;
        }

        $weeks[] = [
            'start' => $start->format('Y-m-d'),
            'end' => $end->format('Y-m-d'),
        ];
    }

    return $weeks;
}

/**
 * 기간 검색 단위. 최대 2년까지 조회할 수 있습니다.
 *
 * 주 수는 "달력 기준"이 아니라 7일 단위 주 개수입니다.
 *   1개월 → 5주, 6개월 → 27주, 1년 → 53주, 2년 → 105주
 *
 * @return array<string, array{label: string, weeks: int}>
 */
function rental_units()
{
    return [
        '1m' => ['label' => '1개월', 'weeks' => 5],
        '6m' => ['label' => '6개월', 'weeks' => 27],
        '1y' => ['label' => '1년', 'weeks' => 53],
        '2y' => ['label' => '2년', 'weeks' => 105],
    ];
}

/**
 * 기간 단위가 유효한지
 *
 * @param string $unit
 * @return bool
 */
function rental_unit_exists($unit)
{
    $units = rental_units();
    return isset($units[$unit]);
}

/**
 * 기간 단위 → 주 목록 (이번 주부터)
 *
 * RENTAL_YEAR_LIMIT 를 넘어가면 거기서 멈춥니다.
 *
 * @param string $unit
 * @return array<int, array{start: string, end: string}>
 */
function rental_weeks_for_unit($unit)
{
    $units = rental_units();

    if (!isset($units[$unit])) {
        return [];
    }

    $base = rental_week_start(new DateTimeImmutable('today'));
    $weeks = [];

    for ($i = 0; $i < $units[$unit]['weeks']; $i++) {
        $start = $base->modify('+' . ($i * RENTAL_WEEK_DAYS) . ' days');
        $end = $start->modify('+' . (RENTAL_WEEK_DAYS - 1) . ' days');

        // 주의 끝(화요일)이 안내 마지막 연도를 넘으면 넣지 않습니다.
        if ((int) $end->format('Y') > RENTAL_YEAR_LIMIT) {
            break;
        }

        $weeks[] = [
            'start' => $start->format('Y-m-d'),
            'end' => $end->format('Y-m-d'),
        ];
    }

    return $weeks;
}

/**
 * 주 목록의 마지막 주 이후가 더 있는지
 *
 * @param array $weeks
 * @return array{last: bool, edge: string}
 */
function rental_range_info(array $weeks)
{
    if (!$weeks) {
        return ['last' => true, 'edge' => ''];
    }

    $lastWeek = $weeks[count($weeks) - 1];
    $edge = new DateTimeImmutable($lastWeek['end']);
    $limit = new DateTimeImmutable(RENTAL_YEAR_LIMIT . '-12-31');

    // 주의 끝이 안내 마지막 연도에 들어오면 더 볼 것이 없습니다.
    return [
        'last' => (int) $edge->format('Y') >= RENTAL_YEAR_LIMIT,
        'edge' => $limit->format('Y-m-d'),
    ];
}

/**
 * 주 목록별·전시장별 대관 상태
 *
 * @param array $weeks
 * @return array<int, array{start: string, end: string, halls: array<string, string>}>
 */
function rental_availability(array $weeks)
{
    if (!$weeks) {
        return [];
    }

    $first = new DateTimeImmutable($weeks[0]['start']);
    $last = new DateTimeImmutable($weeks[count($weeks) - 1]['end']);
    $fromTs = $first->getTimestamp();
    $toTs = $last->setTime(23, 59, 59)->getTimestamp();

    $sql = 'SELECT wr_8, wr_11, wr_12, wr_13 FROM ' . RENTAL_TABLE
        . ' WHERE wr_is_comment = 0'
        . ' AND wr_11 <> "" AND wr_12 <> ""'
        . ' AND CAST(wr_11 AS UNSIGNED) <= ?'
        . ' AND CAST(wr_12 AS UNSIGNED) >= ?';

    $stmt = db()->prepare($sql);
    $stmt->execute([$toTs, $fromTs]);

    $rows = $stmt->fetchAll();
    $byHall = [];

    foreach ($rows as $row) {
        $hallId = rental_hall_id((string) $row['wr_8']);

        if ($hallId === null) {
            continue;
        }

        $byHall[$hallId][] = [
            'start' => (int) $row['wr_11'],
            'end' => (int) $row['wr_12'],
            'status' => ((string) $row['wr_13'] === '2') ? 'approved' : 'pending',
        ];
    }

    $result = [];

    foreach ($weeks as $week) {
        $weekStart = new DateTimeImmutable($week['start']);
        $weekEnd = new DateTimeImmutable($week['end']);
        $weekStartTs = $weekStart->getTimestamp();
        $weekEndTs = $weekEnd->setTime(23, 59, 59)->getTimestamp();

        $halls = [];

        foreach (array_keys(rental_halls()) as $hallId) {
            $status = 'available';

            foreach (isset($byHall[$hallId]) ? $byHall[$hallId] : [] as $booking) {
                if ($booking['start'] > $weekEndTs || $booking['end'] < $weekStartTs) {
                    continue;
                }

                if ($booking['status'] === 'approved') {
                    $status = 'approved';
                    break;
                }

                $status = 'pending';
            }

            $halls[$hallId] = $status;
        }

        $result[] = [
            'start' => $week['start'],
            'end' => $week['end'],
            'halls' => $halls,
        ];
    }

    return $result;
}

/**
 * 전시장 + 주(수요일 시작) 기준으로 이미 예약이 있는지
 *
 * @param string $hallId
 * @param string $weekStartYmd
 * @return bool
 */
function rental_is_taken($hallId, $weekStartYmd)
{
    $label = rental_hall_label($hallId);

    if ($label === null) {
        return false;
    }

    $start = new DateTimeImmutable($weekStartYmd);
    $startTs = $start->getTimestamp();
    $endTs = $start->modify('+' . (RENTAL_WEEK_DAYS - 1) . ' days')->setTime(23, 59, 59)->getTimestamp();

    $sql = 'SELECT COUNT(*) FROM ' . RENTAL_TABLE
        . ' WHERE wr_is_comment = 0 AND wr_8 = ?'
        . ' AND wr_11 <> "" AND wr_12 <> ""'
        . ' AND CAST(wr_11 AS UNSIGNED) <= ?'
        . ' AND CAST(wr_12 AS UNSIGNED) >= ?';

    $stmt = db()->prepare($sql);
    $stmt->execute([$label, $endTs, $startTs]);

    return (int) $stmt->fetchColumn() > 0;
}

/**
 * 신청 1건 저장
 *
 * @param array $input 신청 데이터
 * @param array $files 업로드된 파일 (['bio' => [], 'portfolio' => []])
 * @return int 생성된 wr_id
 */
function rental_create_booking(array $input, array $files)
{
    $hall = $input['hall'];
    $weekStart = $input['week_start'];

    $pdo = db();
    $now = (new DateTimeImmutable())->format('Y-m-d H:i:s');

    $start = new DateTimeImmutable($weekStart);
    $end = $start->modify('+' . (RENTAL_WEEK_DAYS - 1) . ' days');

    $email = (string) $input['email'];
    $atPos = strpos($email, '@');

    $values = [
        'wr_reply' => '',
        'wr_parent' => 0,
        'wr_is_comment' => 0,
        'wr_comment' => 0,
        'wr_comment_reply' => '',
        'ca_name' => '',
        'wr_option' => 'html1',
        'wr_subject' => (string) $input['title'],
        'wr_content' => (string) $input['memo'],
        'wr_link1' => '',
        'wr_link2' => '',
        'wr_hit' => 0,
        'wr_good' => 0,
        'wr_nogood' => 0,
        'mb_id' => '',
        'wr_password' => bin2hex(random_bytes(8)),
        'wr_name' => (string) $input['name'],
        'wr_email' => $email,
        'wr_homepage' => '',
        'wr_datetime' => $now,
        'wr_last' => $now,
        'wr_ip' => rental_client_ip(),
        'wr_1' => ($atPos === false ? $email : substr($email, 0, $atPos)) . '|'
            . ($atPos === false ? '' : substr($email, $atPos + 1)) . '|',
        'wr_2' => (string) $input['genre'] . '|',
        'wr_3' => (string) $input['memo'],
        'wr_4' => '',
        'wr_5' => (string) $input['kind'],
        'wr_6' => '',
        'wr_7' => '',
        'wr_8' => $hall,
        'wr_9' => (string) $input['postcode'] . '|' . (string) $input['address1'] . '|' . (string) $input['address2'],
        'wr_10' => rental_phone_pipe((string) $input['phone']),
        'wr_11' => (string) $start->getTimestamp(),
        'wr_12' => (string) $end->getTimestamp(),
        'wr_13' => '1',
    ];

    // 확장 컴럼 (sql/rental_extra_columns.sql).
    // 마이그레이션 전이라 컴럼이 없으면 조용히 건넌뜁니다.
    $extras = [
        'rt_artist_cnt' => (int) $input['artist_count'],
        'rt_work_cnt' => (int) $input['work_count'],
        'rt_terms' => (string) $input['terms_version'],
    ];

    if ((string) $input['terms_version'] !== '') {
        $extras['rt_terms_at'] = $now;
    }

    foreach ($extras as $column => $value) {
        if (rental_has_column($column)) {
            $values[$column] = $value;
        }
    }

    $pdo->beginTransaction();
    $savedFiles = [];

    try {
        // 그누보드 방식: wr_num 은 최소값 - 1
        $minNum = $pdo->query('SELECT MIN(wr_num) FROM ' . RENTAL_TABLE)->fetchColumn();
        $values['wr_num'] = (int) $minNum - 1;

        $columns = array_keys($values);
        $placeholders = array_map(function ($column) {
            return ':' . $column;
        }, $columns);

        $sql = 'INSERT INTO ' . RENTAL_TABLE
            . ' (`' . implode('`, `', $columns) . '`)'
            . ' VALUES (' . implode(', ', $placeholders) . ')';

        $stmt = $pdo->prepare($sql);
        foreach ($values as $column => $value) {
            $stmt->bindValue(':' . $column, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->execute();

        $wrId = (int) $pdo->lastInsertId();

        // 그누보드는 wr_parent 를 자기 자신의 wr_id 로 둡니다.
        $pdo->prepare('UPDATE ' . RENTAL_TABLE . ' SET wr_parent = ? WHERE wr_id = ?')
            ->execute([$wrId, $wrId]);

        $savedFiles = rental_save_attachments($pdo, $wrId, $files);

        $pdo->commit();

        return $wrId;
    } catch (Throwable $e) {
        $pdo->rollBack();

        // DB 는 되돌렸지만 이미 옮겨 둔 파일이 있으면 함께 지웁니다.
        rental_cleanup_uploaded($savedFiles);

        throw $e;
    }
}

/**
 * 첨부파일 저장 (파일 + g4_board_file 등록)
 *
 * @param PDO   $pdo
 * @param int   $wrId
 * @param array $files
 * @return array<int, string> 저장된 파일의 절대 경로 (실패 시 롤백 정리용)
 */
function rental_save_attachments($pdo, $wrId, array $files)
{
    $dir = rental_upload_dir();

    if ($dir === null) {
        return [];
    }

    $savedFiles = [];

    // 수정할 때 이어서 저장할 수 있도록 마지막 번호 다음부터 매깁니다.
    $last = $pdo->prepare(
        'SELECT COALESCE(MAX(bf_no), -1) FROM g4_board_file WHERE bo_table = ? AND wr_id = ?'
    );
    $last->execute([RENTAL_BOARD, (int) $wrId]);

    $bfNo = (int) $last->fetchColumn() + 1;

    foreach ($files as $file) {
        $moved = rental_move_uploaded_file($file, $dir);

        if ($moved === null) {
            continue;
        }

        $savedFiles[] = $dir . '/' . $moved['file'];

        $stmt = $pdo->prepare(
            'INSERT INTO g4_board_file'
            . ' (bo_table, wr_id, bf_no, bf_source, bf_file, bf_download, bf_content, bf_filesize, bf_width, bf_height, bf_type, bf_datetime)'
            . ' VALUES (?, ?, ?, ?, ?, 0, "", ?, ?, ?, ?, NOW())'
        );

        $stmt->execute([
            RENTAL_BOARD,
            $wrId,
            $bfNo,
            $file['name'],
            $moved['file'],
            $moved['size'],
            $moved['width'],
            $moved['height'],
            $moved['type'],
        ]);

        $bfNo++;
    }

    return $savedFiles;
}

/**
 * 첨부파일 저장 루트
 *
 * 웹 루트의 uploads/ 를 우선 쓰고, 호스팅 정책상 쓸 수 없으면
 * backend/uploads/ 로 대체합니다. 둘 다 안 되면 null 입니다.
 *
 * @return string|null
 */
function rental_upload_root()
{
    static $root = false;

    if ($root !== false) {
        return $root;
    }

    $root = null;

    $candidates = [
        // 웹 루트/uploads  (/galleryiscom/www/uploads)
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
            rental_guard_upload_dir($path);
            break;
        }
    }

    return $root;
}

/**
 * 업로드 폴더에 실행 방지 .htaccess 를 둡니다. (없을 때만)
 *
 * 파일명을 위장한 스크립트가 실행되는 것을 막습니다.
 *
 * @param string $dir
 * @return void
 */
function rental_guard_upload_dir($dir)
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
 * 첨부파일 저장 폴더 (uploads/order)
 *
 * 그누보드처럼 게시판 단위 **평면** 폴더를 씁니다.
 * 어느 신청의 파일인지는 g4_board_file(wr_id ↔ bf_file) 이 기억합니다.
 *
 * @param bool $create false 면 폴더를 만들지 않습니다 (조회할 때)
 * @return string|null
 */
function rental_upload_dir($create = true)
{
    $root = rental_upload_root();

    if ($root === null) {
        return null;
    }

    $path = $root . '/' . RENTAL_BOARD_DIR;

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
 * 업로드 파일 저장
 *
 * @param array  $file
 * @param string $dir
 * @return array|null
 */
function rental_move_uploaded_file($file, $dir)
{
    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        return null;
    }

    $original = isset($file['name']) ? (string) $file['name'] : 'file';
    $extension = strtolower(pathinfo($original, PATHINFO_EXTENSION));
    $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', pathinfo($original, PATHINFO_FILENAME));
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
    $type = 0;

    $imageSize = @getimagesize($dir . '/' . $stored);

    if (is_array($imageSize)) {
        $width = (int) $imageSize[0];
        $height = (int) $imageSize[1];
        $type = 2; // 그누보드: 2 = 이미지
    }

    return [
        'file' => $stored,
        'size' => $size,
        'width' => $width,
        'height' => $height,
        'type' => $type,
    ];
}

/**
 * 저장에 실패했을 때 옮겨 둔 파일을 되돌립니다. (트랜잭션 롤백용)
 *
 * @param array<int, string> $paths
 * @return void
 */
function rental_cleanup_uploaded(array $paths)
{
    foreach ($paths as $path) {
        if (is_file($path)) {
            @unlink($path);
        }
    }
}

/**
 * 신청 1건의 첨부파일 삭제 (실제 파일 + 폴더 + g4_board_file 행)
 *
 * @param PDO $pdo
 * @param int $wrId
 * @return int 삭제한 파일 수
 */
function rental_delete_attachments($pdo, $wrId)
{
    $wrId = (int) $wrId;

    $stmt = $pdo->prepare(
        'SELECT bf_file FROM g4_board_file WHERE bo_table = ? AND wr_id = ?'
    );
    $stmt->execute([RENTAL_BOARD, $wrId]);

    $names = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $removed = 0;

    // 저장 폴더(평면·신청별)와 예전 경로를 모두 확인해 지웁니다.
    foreach (rental_file_dirs($wrId) as $dir) {
        foreach ($names as $name) {
            // basename 으로 경로 조작을 막습니다.
            $path = $dir . '/' . basename((string) $name);

            if (is_file($path) && @unlink($path)) {
                $removed++;
            }
        }
    }

    // 예전 버전이 만들던 신청별 폴더가 비었으면 정리합니다.
    $root = rental_upload_root();
    $perId = $root === null ? null : $root . '/' . RENTAL_BOARD_DIR . '/' . $wrId;

    if ($perId !== null && is_dir($perId)) {
        rental_remove_dir_if_empty($perId);
    }

    $pdo->prepare('DELETE FROM g4_board_file WHERE bo_table = ? AND wr_id = ?')
        ->execute([RENTAL_BOARD, $wrId]);

    return $removed;
}

/**
 * 신청 1건의 첨부파일 목록
 *
 * @param int $wrId
 * @return array<int, array{no:int, group:string, source:string, file:string, size:int, width:int, height:int, type:int}>
 */
function rental_files_for($wrId)
{
    $stmt = db()->prepare(
        'SELECT bf_no, bf_source, bf_file, bf_filesize, bf_width, bf_height, bf_type'
        . ' FROM g4_board_file WHERE bo_table = ? AND wr_id = ? ORDER BY bf_no ASC'
    );
    $stmt->execute([RENTAL_BOARD, (int) $wrId]);

    $files = [];

    foreach ($stmt->fetchAll() as $row) {
        // bf_file 이 비어 있는 레거시 자리표시 행은 건너뜁니다.
        if (trim((string) $row['bf_file']) === '') {
            continue;
        }

        $files[] = [
            'no' => (int) $row['bf_no'],
            'group' => rental_file_group((string) $row['bf_file']),
            'source' => (string) $row['bf_source'],
            'file' => (string) $row['bf_file'],
            'size' => (int) $row['bf_filesize'],
            'width' => (int) $row['bf_width'],
            'height' => (int) $row['bf_height'],
            'type' => (int) $row['bf_type'],
        ];
    }

    return $files;
}

/**
 * 첨부파일이 있을 수 있는 폴더 목록
 *
 *   1) uploads/order                     — 지금 쓰는 평면 폴더 (레거시 파일 포함)
 *   2) uploads/order/{wr_id}             — 예전 버전이 쓰던 신청별 폴더
 *   3) backend/data/file/order           — 그 이전 평면 폴더
 *
 * @param int  $wrId
 * @param bool $create false 면 1) 을 만들지 않습니다.
 * @return array<int, string> 실제로 존재하는 폴더만
 */
function rental_file_dirs($wrId, $create = false)
{
    $dirs = [];
    $current = rental_upload_dir($create);

    if ($current !== null && is_dir($current)) {
        $dirs[] = $current;
    }

    $root = rental_upload_root();
    $perId = $root === null ? null : $root . '/' . RENTAL_BOARD_DIR . '/' . (int) $wrId;

    if ($perId !== null && is_dir($perId)) {
        $dirs[] = $perId;
    }

    $legacy = dirname(__DIR__) . '/data/file/' . RENTAL_BOARD_DIR;

    if (is_dir($legacy)) {
        $dirs[] = $legacy;
    }

    return $dirs;
}

/**
 * 첨부파일을 웹에서 부를 수 있는 주소
 *
 * @param int    $wrId
 * @param string $filename 저장된 파일명 (bf_file)
 * @return string 없으면 빈 문자열
 */
function rental_file_url($wrId, $filename)
{
    $name = basename((string) $filename);
    $base = rental_upload_url_base();
    $current = rental_upload_dir(false);

    // 1) uploads/order (지금 쓰는 평면 폴더)
    if ($base !== '' && $current !== null && is_file($current . '/' . $name)) {
        return $base . '/' . RENTAL_BOARD_DIR . '/' . rawurlencode($name);
    }

    // 2) uploads/order/{wr_id} (예전 버전이 쓰던 신청별 폴더)
    $root = rental_upload_root();
    $perId = $root === null ? null : $root . '/' . RENTAL_BOARD_DIR . '/' . (int) $wrId;

    if ($base !== '' && $perId !== null && is_file($perId . '/' . $name)) {
        return $base . '/' . RENTAL_BOARD_DIR . '/' . (int) $wrId . '/' . rawurlencode($name);
    }

    // 3) backend/data/file/order
    if (is_file(dirname(__DIR__) . '/data/file/' . RENTAL_BOARD_DIR . '/' . $name)) {
        $origin = rental_request_origin();

        return $origin === ''
            ? ''
            : $origin . '/backend/data/file/' . RENTAL_BOARD_DIR . '/' . rawurlencode($name);
    }

    return '';
}

/**
 * 남길 첨부(bf_no)만 남기고 나머지는 파일과 행 모두 지웁니다.
 *
 * @param PDO        $pdo
 * @param int        $wrId
 * @param array<int> $keepNos 남길 bf_no 목록
 * @return void
 */
function rental_prune_attachments($pdo, $wrId, array $keepNos)
{
    $wrId = (int) $wrId;
    $keep = array_map('intval', $keepNos);
    $dirs = rental_file_dirs($wrId);

    $stmt = $pdo->prepare(
        'SELECT bf_no, bf_file FROM g4_board_file WHERE bo_table = ? AND wr_id = ?'
    );
    $stmt->execute([RENTAL_BOARD, $wrId]);

    $deleteNos = [];

    foreach ($stmt->fetchAll() as $row) {
        $no = (int) $row['bf_no'];

        if (in_array($no, $keep, true)) {
            continue;
        }

        foreach ($dirs as $dir) {
            $path = $dir . '/' . basename((string) $row['bf_file']);

            if (is_file($path)) {
                @unlink($path);
            }
        }

        $deleteNos[] = $no;
    }

    if (!$deleteNos) {
        return;
    }

    $placeholders = implode(', ', array_fill(0, count($deleteNos), '?'));
    $sql = 'DELETE FROM g4_board_file WHERE bo_table = ? AND wr_id = ?'
        . ' AND bf_no IN (' . $placeholders . ')';

    $pdo->prepare($sql)->execute(array_merge([RENTAL_BOARD, $wrId], $deleteNos));
}

/**
 * 신청 1건 수정 (첨부는 별도로 다룹니다)
 *
 * @param PDO   $pdo
 * @param int   $wrId
 * @param array $values 컬럼명 => 값
 * @return void
 */
function rental_update_booking($pdo, $wrId, array $values)
{
    if (!$values) {
        return;
    }

    $sets = [];

    foreach (array_keys($values) as $column) {
        $sets[] = '`' . $column . '` = :' . $column;
    }

    $stmt = $pdo->prepare(
        'UPDATE ' . RENTAL_TABLE . ' SET ' . implode(', ', $sets) . ' WHERE wr_id = :__wr_id'
    );

    foreach ($values as $column => $value) {
        $stmt->bindValue(':' . $column, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }

    $stmt->bindValue(':__wr_id', (int) $wrId, PDO::PARAM_INT);
    $stmt->execute();
}

/**
 * 관리자 확인(읽음) 여부 설정
 *
 * rt_checked / rt_checked_at — sql/rental_checked_column.sql
 *
 * @param array<int> $ids
 * @param bool       $checked
 * @return int 바뀐 건수 (컬럼이 없으면 0)
 */
function rental_set_checked(array $ids, $checked)
{
    if (!rental_has_column('rt_checked')) {
        return 0;
    }

    $ids = array_values(array_filter(array_map('intval', $ids), function ($id) {
        return $id > 0;
    }));

    if (!$ids) {
        return 0;
    }

    $sets = ['rt_checked = ?'];
    $values = [$checked ? 1 : 0];

    if (rental_has_column('rt_checked_at')) {
        $sets[] = 'rt_checked_at = ?';
        // 확인을 풀면 일시도 비웁니다.
        $values[] = $checked ? (new DateTimeImmutable())->format('Y-m-d H:i:s') : null;
    }

    $placeholders = implode(', ', array_fill(0, count($ids), '?'));

    $stmt = db()->prepare(
        'UPDATE ' . RENTAL_TABLE . ' SET ' . implode(', ', $sets)
        . ' WHERE wr_id IN (' . $placeholders . ')'
    );
    $stmt->execute(array_merge($values, $ids));

    return $stmt->rowCount();
}

/**
 * 관리자 확인용 메모 문자열 (신청자 메모 + 요약 + 첨부 수)
 *
 * @param array $input             rental_booking_input() 결과
 * @param int   $attachmentCount   저장된 첨부 수
 * @return string
 */
function rental_memo_text(array $input, $attachmentCount)
{
    $lines = [];

    if ((string) $input['memo'] !== '') {
        $lines[] = (string) $input['memo'];
    }

    $detail = [];

    if ((string) $input['kind_key'] === 'group' && (int) $input['artist_count'] > 0) {
        $detail[] = '참여 작가 수: ' . (int) $input['artist_count'] . '명';
    }

    if ((int) $input['work_count'] > 0) {
        $detail[] = '작품 수: ' . (int) $input['work_count'] . '점';
    }

    if ((string) $input['genre'] !== '') {
        $detail[] = '장르: ' . (string) $input['genre'];
    }

    if ($detail) {
        $lines[] = implode(' / ', $detail);
    }

    if ((int) $attachmentCount > 0) {
        $lines[] = '첨부: ' . (int) $attachmentCount . '건';
    }

    return implode("\n", $lines);
}

/**
 * 수정할 때 바뀌는 컬럼 값
 *
 * @param array $input rental_booking_input() 결과
 * @return array 컬럼명 => 값
 */
function rental_update_values(array $input)
{
    $start = new DateTimeImmutable((string) $input['week_start']);
    $end = $start->modify('+' . (RENTAL_WEEK_DAYS - 1) . ' days');

    $email = (string) $input['email'];
    $atPos = strpos($email, '@');

    $values = [
        'wr_subject' => (string) $input['title'],
        'wr_name' => (string) $input['name'],
        'wr_email' => $email,
        'wr_1' => ($atPos === false ? $email : substr($email, 0, $atPos)) . '|'
            . ($atPos === false ? '' : substr($email, $atPos + 1)) . '|',
        'wr_2' => (string) $input['genre'] . '|',
        'wr_3' => (string) $input['memo'],
        'wr_5' => (string) $input['kind'],
        'wr_8' => (string) $input['hall'],
        'wr_9' => (string) $input['postcode'] . '|' . (string) $input['address1'] . '|' . (string) $input['address2'],
        'wr_10' => rental_phone_pipe((string) $input['phone']),
        'wr_11' => (string) $start->getTimestamp(),
        'wr_12' => (string) $end->getTimestamp(),
        'wr_last' => (new DateTimeImmutable())->format('Y-m-d H:i:s'),
    ];

    $extras = [
        'rt_artist_cnt' => (int) $input['artist_count'],
        'rt_work_cnt' => (int) $input['work_count'],
    ];

    if ((string) $input['terms_version'] !== '') {
        $extras['rt_terms'] = (string) $input['terms_version'];
    }

    foreach ($extras as $column => $value) {
        if (rental_has_column($column)) {
            $values[$column] = $value;
        }
    }

    return $values;
}

/**
 * 폴더가 비었으면 지웁니다.
 *
 * 부모 폴더(uploads/order)는 레거시 파일이 함께 있으므로 건드리지 않습니다.
 *
 * @param string $dir
 * @return void
 */
function rental_remove_dir_if_empty($dir)
{
    $items = @scandir($dir);

    if (!is_array($items) || array_diff($items, ['.', '..'])) {
        return;
    }

    @rmdir($dir);
}

/**
 * 신청 1건 완전 삭제 (첨부 + g4_write_order 행)
 *
 * ⚠ 레거시 대관 기록도 함께 지워집니다.
 *    관리자 확인을 받은 뒤에만 호출하세요.
 *
 * @param int $wrId
 * @return array{files: int, post: bool}
 */
function rental_delete_booking($wrId)
{
    $wrId = (int) $wrId;
    $pdo = db();

    $pdo->beginTransaction();

    try {
        $files = rental_delete_attachments($pdo, $wrId);

        $stmt = $pdo->prepare('DELETE FROM ' . RENTAL_TABLE . ' WHERE wr_id = ?');
        $stmt->execute([$wrId]);
        $post = $stmt->rowCount() > 0;

        $pdo->commit();

        return ['files' => $files, 'post' => $post];
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/**
 * 전화번호 → 그누보드 파이프 형식 (10칸)
 *
 * @param string $phone
 * @return string
 */
function rental_phone_pipe($phone)
{
    $digits = preg_replace('/[^0-9]/', '', $phone);
    $parts = [];

    if (strlen($digits) === 11) {
        $parts = [substr($digits, 0, 3), substr($digits, 3, 4), substr($digits, 7, 4)];
    } elseif (strlen($digits) === 10) {
        $parts = [substr($digits, 0, 3), substr($digits, 3, 3), substr($digits, 6, 4)];
    } else {
        $parts = [$digits, '', ''];
    }

    while (count($parts) < 10) {
        $parts[] = '';
    }

    return implode('|', array_slice($parts, 0, 10));
}

/**
 * 파이프 형식 전화번호 → 읽기 좋은 문자열
 *
 * @param string $value
 * @return string
 */
function rental_phone_from_pipe($value)
{
    $parts = array_filter(explode('|', (string) $value), function ($part) {
        return $part !== '';
    });

    return $parts ? implode('-', $parts) : (string) $value;
}

/**
 * 접속 IP
 *
 * @return string
 */
function rental_client_ip()
{
    return isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
}
