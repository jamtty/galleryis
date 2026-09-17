<?php
/**
 * 대관 신청 입력값 정리 · 검증
 *
 * bookings.php(신규 접수) 와 update.php(관리자 수정) 가 함께 씁니다.
 * 검증에 실패하면 json_error() 로 응답하고 종료합니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';

/**
 * $_FILES 의 배열 구조를 평탄화합니다.
 *
 * @param string $key
 * @return array
 */
function rental_normalize_files($key)
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
 * payload(JSON) 를 검증하고 저장에 쓸 값으로 정리합니다.
 *
 * @param array $payload
 * @param bool  $requireCounts 작품 수·참여작가수를 필수로 볼지
 *                            (관리자 수정은 레거시 행을 고려해 false)
 * @return array
 */
function rental_booking_input(array $payload, $requireCounts = true)
{
    $applicant = (isset($payload['applicant']) && is_array($payload['applicant'])) ? $payload['applicant'] : [];
    $exhibition = (isset($payload['exhibition']) && is_array($payload['exhibition'])) ? $payload['exhibition'] : [];

    $hallId = isset($payload['hall_id']) ? (string) $payload['hall_id'] : '';
    $hallLabel = rental_hall_label($hallId);

    if ($hallLabel === null) {
        json_error('희망 전시장을 선택해 주세요.', 422);
    }

    $weekStart = isset($payload['week_start']) ? (string) $payload['week_start'] : '';

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $weekStart)) {
        json_error('희망 전시일을 선택해 주세요.', 422);
    }

    $name = isset($applicant['name']) ? trim((string) $applicant['name']) : '';
    $email = isset($applicant['email']) ? trim((string) $applicant['email']) : '';
    $phone = isset($applicant['phone']) ? trim((string) $applicant['phone']) : '';
    $postcode = isset($applicant['postcode']) ? trim((string) $applicant['postcode']) : '';
    $address1 = isset($applicant['address1']) ? trim((string) $applicant['address1']) : '';
    $address2 = isset($applicant['address2']) ? trim((string) $applicant['address2']) : '';

    $kindKey = isset($exhibition['kind']) ? (string) $exhibition['kind'] : 'solo';
    $genre = isset($exhibition['genre']) ? trim((string) $exhibition['genre']) : '';
    $genreOther = isset($exhibition['genre_other']) ? trim((string) $exhibition['genre_other']) : '';
    $memo = isset($exhibition['memo']) ? trim((string) $exhibition['memo']) : '';

    $artistCount = isset($exhibition['artist_count']) ? (int) $exhibition['artist_count'] : 0;
    $workCount = isset($exhibition['work_count']) ? (int) $exhibition['work_count'] : 0;
    $termsVersion = isset($payload['terms_version']) ? trim((string) $payload['terms_version']) : '';

    if ($name === '' || $email === '' || $phone === '') {
        json_error('신청자 정보(이름 · 이메일 · 연락처)를 입력해 주세요.', 422);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('이메일 형식이 올바르지 않습니다.', 422);
    }

    if (!isset(RENTAL_KINDS[$kindKey])) {
        json_error('전시구분을 선택해 주세요.', 422);
    }

    if ($requireCounts && $kindKey === 'group' && $artistCount <= 0) {
        json_error('참여 작가 수를 입력해 주세요.', 422);
    }

    if ($requireCounts && $workCount <= 0) {
        json_error('작품 수를 입력해 주세요.', 422);
    }

    if ($postcode === '' || $address1 === '') {
        json_error('주소를 입력해 주세요.', 422);
    }

    if ($address2 === '') {
        json_error('상세 주소를 입력해 주세요.', 422);
    }

    if ($genre === '') {
        json_error('전시장르를 선택해 주세요.', 422);
    }

    if ($genre === 'other' && $genreOther === '') {
        json_error('장르를 직접 입력해 주세요.', 422);
    }

    if ($termsVersion === '') {
        json_error('대관 유의사항에 동의해 주세요.', 422);
    }

    $genreText = $genre === 'other' ? $genreOther : $genre;

    return [
        'hall' => $hallLabel,
        'hall_id' => $hallId,
        'week_start' => $weekStart,
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'postcode' => $postcode,
        'address1' => $address1,
        'address2' => $address2,
        // 레거시 데이터와 컬럼 의미를 맞춥니다. 관리자 목록의 '신청자' 열이 wr_subject 입니다.
        // 전시구분·전시장은 wr_5 / wr_8 에 따로 저장됩니다.
        'title' => $name,
        'kind' => RENTAL_KINDS[$kindKey],
        'kind_key' => $kindKey,
        'genre' => $genreText,
        'genre_key' => $genre,
        'genre_other' => $genreOther,
        'memo' => $memo,
        'artist_count' => $artistCount,
        'work_count' => $workCount,
        'terms_version' => $termsVersion,
    ];
}

/**
 * 업로드된 첨부를 검증해 평탄화된 목록으로 돌려줍니다.
 *
 * @return array<int, array>
 */
function rental_booking_uploads()
{
    $attachments = [];

    foreach (RENTAL_FILE_LIMITS as $key => $limit) {
        $accepted = 0;

        foreach (rental_normalize_files($key) as $file) {
            $error = (int) $file['error'];

            if ($error === UPLOAD_ERR_NO_FILE) {
                continue;
            }

            if ($error !== UPLOAD_ERR_OK) {
                json_error($limit['label'] . ': 파일을 올리지 못했습니다. 다시 시도해 주세요.', 422);
            }

            $original = (string) $file['name'];
            $extension = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));

            if (!in_array($extension, $limit['ext'], true)) {
                json_error($original . ': 첨부할 수 없는 형식입니다.', 422);
            }

            if ((int) $file['size'] > $limit['size']) {
                json_error($original . ': ' . round($limit['size'] / 1048576) . 'MB 이하만 첨부할 수 있습니다.', 422);
            }

            $accepted++;

            if ($accepted > $limit['max']) {
                json_error($limit['label'] . ': ' . $limit['max'] . '개까지만 첨부할 수 있습니다.', 422);
            }

            $attachments[] = $file;
        }
    }

    return $attachments;
}
