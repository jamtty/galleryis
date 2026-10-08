<?php
/**
 * 기계 번역 (한국어 → 영어)
 *
 * 관리자가 한국어로 쓴 글(전시·공지·전시장·팝업·개인정보처리방침)을 영문 화면에서도
 * 보여 주기 위해 씁니다. 원본 사이트도 같은 방식(Cloud Translation)으로 영문을
 * 만들어 두고 "영문은 기계 번역이며 한국어가 원문"이라고 적어 둡니다.
 *
 * 설정 (backend/config.php)
 *
 *   'translate' => [
 *       'provider' => 'google',   // google | papago | deepl | none
 *       'key'      => '...',      // google: API 키 · papago: Client ID · deepl: Auth Key
 *       'secret'   => '...',      // papago: Client Secret (google·deepl 은 비움)
 *   ],
 *
 * 키가 없으면 아무것도 번역하지 않고 조용히 한국어로 돌려줍니다.
 * (저장이 실패하거나 화면이 비는 일이 없어야 하므로, 실패는 예외가 아니라 null 입니다)
 *
 * 긴 글은 나눠서 보냅니다. 이때 **태그 경계(`>`)나 줄바꿈 뒤에서만 자르므로**
 * HTML 이 중간에 끊겨도 태그가 깨지지 않습니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

/** 제공자별 한 번에 보낼 수 있는 안전한 바이트 수 (한글 1자 = 3바이트) */
const TRANSLATE_CHUNK_BYTES = [
    'google' => 20000,
    'papago' => 4000,
    'deepl' => 60000,
];

/** curl 타임아웃 (초) */
const TRANSLATE_TIMEOUT = 30;

/**
 * 번역 설정 (config.php 의 translate 절)
 *
 * @return array{provider: string, key: string, secret: string}
 */
function translate_settings()
{
    static $settings = null;

    if ($settings !== null) {
        return $settings;
    }

    $provider = 'none';
    $key = '';
    $secret = '';

    try {
        $config = db_config();
        $raw = isset($config['translate']) && is_array($config['translate'])
            ? $config['translate']
            : [];

        $candidate = strtolower(trim((string) ($raw['provider'] ?? 'none')));

        if (in_array($candidate, ['google', 'papago', 'deepl'], true)) {
            $provider = $candidate;
        }

        $key = trim((string) ($raw['key'] ?? ''));
        $secret = trim((string) ($raw['secret'] ?? ''));
    } catch (Throwable $e) {
        // config.php 가 없거나 깨져도 공개 화면은 한국어로 정상 동작해야 합니다.
        error_log('[translate config] ' . $e->getMessage());
    }

    if ($key === '') {
        $provider = 'none';
    }

    $settings = [
        'provider' => $provider,
        'key' => $key,
        'secret' => $secret,
    ];

    return $settings;
}

/** 번역을 쓸 수 있는 상태인지 (제공자 + 키) */
function translate_enabled()
{
    return translate_settings()['provider'] !== 'none';
}

/** 관리자 화면에 보여 줄 제공자 이름 */
function translate_provider_label()
{
    $provider = translate_settings()['provider'];

    $labels = [
        'google' => 'Google Cloud Translation',
        'papago' => 'Papago (네이버)',
        'deepl' => 'DeepL',
    ];

    return isset($labels[$provider]) ? $labels[$provider] : '';
}

/**
 * 한국어 글을 영어로 번역합니다.
 *
 * @param string $text 번역할 글
 * @param bool   $html HTML(에디터 본문) 이면 true — 태그를 살려서 번역합니다
 * @return string|null 실패(키 없음·통신 오류·빈 글)면 null
 */
function translate_to_en($text, $html = false)
{
    $text = (string) $text;

    if (!translate_enabled() || trim($text) === '') {
        return null;
    }

    $settings = translate_settings();
    $limit = TRANSLATE_CHUNK_BYTES[$settings['provider']];
    $segments = translate_segments($text, $limit);

    if ($segments === []) {
        return null;
    }

    $translated = translate_segments_call($settings, $segments, (bool) $html);

    if ($translated === null) {
        return null;
    }

    $joined = implode('', $translated);

    return trim($joined) === '' ? null : $joined;
}

/**
 * 긴 글을 안전한 크기로 나눕니다. (자르는 자리는 언제나 태그/줄바꿈 경계)
 *
 * @param string $text
 * @param int    $limit 바이트
 * @return array<int, string>
 */
function translate_segments($text, $limit)
{
    $segments = [];
    $rest = (string) $text;

    while (strlen($rest) > $limit) {
        $cut = translate_cut_point(substr($rest, 0, $limit), $limit);

        $segments[] = substr($rest, 0, $cut);
        $rest = substr($rest, $cut);
    }

    if ($rest !== '') {
        $segments[] = $rest;
    }

    return $segments;
}

/**
 * 어디서 자를지 — 태그가 깨지지 않는 마지막 자리를 고릅니다.
 *
 * @param string $head 앞부분(최대 $limit 바이트)
 * @param int    $limit
 * @return int 잘라 낼 바이트 위치
 */
function translate_cut_point($head, $limit)
{
    foreach (["\n", '>', '. ', ' '] as $needle) {
        $at = strrpos($head, $needle);

        if ($at !== false && $at > 0) {
            return $at + strlen($needle);
        }
    }

    // 경계가 없으면 글자 중간을 자르지 않습니다. (잘린 UTF-8 은 요청이 거부됩니다)
    $safe = mb_strcut($head, 0, $limit, 'UTF-8');
    $cut = strlen($safe);

    return $cut > 0 ? $cut : $limit;
}

/**
 * 제공자별 호출. 실패하면 null.
 *
 * 긴 글은 요청 하나에 몰아 넣지 않습니다 — Google 은 요청당 30,000자(128조각),
 * DeepL 은 요청당 128KB 까지만 받습니다. `limit` 바이트씩 묶어 여러 번 부릅니다.
 *
 * @param array{provider: string, key: string, secret: string} $settings
 * @param array<int, string>                                  $segments
 * @param bool                                                $html
 * @return array<int, string>|null $segments 와 같은 순서
 */
function translate_segments_call(array $settings, array $segments, $html)
{
    $budget = TRANSLATE_CHUNK_BYTES[$settings['provider']];
    $out = [];

    try {
        foreach (translate_batches($segments, $budget) as $batch) {
            $part = translate_batch_call($settings, $batch, $html);

            if ($part === null) {
                return null;
            }

            foreach ($part as $text) {
                $out[] = $text;
            }
        }
    } catch (Throwable $e) {
        error_log('[translate] ' . $e->getMessage());

        return null;
    }

    return count($out) === count($segments) ? $out : null;
}

/**
 * 조각들을 요청 하나의 크기 한도로 묶습니다.
 *
 * @param array<int, string> $segments
 * @param int                $budget 바이트
 * @return array<int, array<int, string>>
 */
function translate_batches(array $segments, $budget)
{
    $batches = [];
    $current = [];
    $size = 0;

    foreach ($segments as $segment) {
        $length = strlen($segment);

        if ($current !== [] && $size + $length > $budget) {
            $batches[] = $current;
            $current = [];
            $size = 0;
        }

        $current[] = $segment;
        $size += $length;
    }

    if ($current !== []) {
        $batches[] = $current;
    }

    return $batches;
}

/**
 * 한 번의 요청에 들어갈 조각 묶음을 보냅니다.
 *
 * @param array{provider: string, key: string, secret: string} $settings
 * @param array<int, string>                                  $segments
 * @param bool                                                $html
 * @return array<int, string>|null
 */
function translate_batch_call(array $settings, array $segments, $html)
{
    switch ($settings['provider']) {
        case 'google':
            return translate_call_google($settings['key'], $segments, $html);
        case 'papago':
            return translate_call_papago($settings['key'], $settings['secret'], $segments);
        case 'deepl':
            return translate_call_deepl($settings['key'], $segments, $html);
    }

    return null;
}

/**
 * Google Cloud Translation v2 (API 키)
 *
 * @param string             $key
 * @param array<int, string> $segments
 * @param bool               $html
 * @return array<int, string>
 */
function translate_call_google($key, array $segments, $html)
{
    $body = [
        'q' => array_values($segments),
        'source' => 'ko',
        'target' => 'en',
        'format' => $html ? 'html' : 'text',
    ];

    $response = translate_http(
        'https://translation.googleapis.com/language/translate/v2?key=' . rawurlencode($key),
        [
            'Content-Type: application/json',
        ],
        json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );

    $data = json_decode($response, true);
    $items = isset($data['data']['translations']) && is_array($data['data']['translations'])
        ? $data['data']['translations']
        : null;

    if ($items === null || count($items) !== count($segments)) {
        throw new RuntimeException('google: unexpected response');
    }

    $out = [];

    foreach ($items as $item) {
        $out[] = (string) ($item['translatedText'] ?? '');
    }

    return $out;
}

/**
 * Papago (네이버) — 한 번에 한 문단만 번역합니다.
 *
 * HTML 은 태그를 살리는 옵션이 없어 그대로 보냅니다. 태그는 보통 그대로 남지만
 * 보장되지는 않으므로, HTML 본문은 Google·DeepL 쪽이 더 안전합니다.
 *
 * @param string             $clientId
 * @param string             $clientSecret
 * @param array<int, string> $segments
 * @return array<int, string>
 */
function translate_call_papago($clientId, $clientSecret, array $segments)
{
    $out = [];

    foreach ($segments as $segment) {
        $response = translate_http(
            'https://openapi.naver.com/v1/papago/n2mt',
            [
                'Content-Type: application/x-www-form-urlencoded; charset=UTF-8',
                'X-Naver-Client-Id: ' . $clientId,
                'X-Naver-Client-Secret: ' . $clientSecret,
            ],
            http_build_query([
                'source' => 'ko',
                'target' => 'en',
                'text' => $segment,
            ])
        );

        $data = json_decode($response, true);
        $text = isset($data['message']['result']['translatedText'])
            ? (string) $data['message']['result']['translatedText']
            : null;

        if ($text === null) {
            throw new RuntimeException('papago: unexpected response');
        }

        $out[] = $text;
    }

    return $out;
}

/**
 * DeepL (Auth Key) — tag_handling=html 로 태그를 지킵니다.
 *
 * @param string             $key
 * @param array<int, string> $segments
 * @param bool               $html
 * @return array<int, string>
 */
function translate_call_deepl($key, array $segments, $html)
{
    // 무료 키는 api-free, 유료 키는 api — 키 끝이 ':fx' 면 무료입니다.
    $host = substr($key, -3) === ':fx' ? 'api-free.deepl.com' : 'api.deepl.com';

    $fields = [
        'source_lang' => 'KO',
        'target_lang' => 'EN-US',
    ];

    if ($html) {
        $fields['tag_handling'] = 'html';
    }

    $pairs = [];

    foreach ($fields as $name => $value) {
        $pairs[] = rawurlencode($name) . '=' . rawurlencode($value);
    }

    foreach ($segments as $segment) {
        $pairs[] = 'text=' . rawurlencode($segment);
    }

    $response = translate_http(
        'https://' . $host . '/v2/translate',
        [
            'Content-Type: application/x-www-form-urlencoded',
            'Authorization: DeepL-Auth-Key ' . $key,
        ],
        implode('&', $pairs)
    );

    $data = json_decode($response, true);
    $items = isset($data['translations']) && is_array($data['translations'])
        ? $data['translations']
        : null;

    if ($items === null || count($items) !== count($segments)) {
        throw new RuntimeException('deepl: unexpected response');
    }

    $out = [];

    foreach ($items as $item) {
        $out[] = (string) ($item['text'] ?? '');
    }

    return $out;
}

/**
 * POST 한 번. 실패(통신 오류·4xx·5xx)는 예외로 올립니다.
 *
 * @param string             $url
 * @param array<int, string> $headers
 * @param string             $body
 * @return string 응답 본문
 */
function translate_http($url, array $headers, $body)
{
    $curl = curl_init($url);

    if ($curl === false) {
        throw new RuntimeException('curl 을 시작할 수 없습니다.');
    }

    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => TRANSLATE_TIMEOUT,
    ]);

    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);

    curl_close($curl);

    if ($response === false) {
        throw new RuntimeException('통신 실패: ' . $error);
    }

    if ($status < 200 || $status >= 300) {
        // 응답 본문에는 요청 내용이 섞여 있을 수 있어 앞부분만 남깁니다.
        throw new RuntimeException('HTTP ' . $status . ': ' . substr((string) $response, 0, 300));
    }

    return (string) $response;
}
