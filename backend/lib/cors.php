<?php
/**
 * CORS 처리
 *
 * 로컬 개발은 로컬 dev 서버(http://localhost:1212)에서 "배포된 서버 API" 를
 * 직접 호출하므로 CORS 허용이 필요합니다.
 * 운영 빌드는 같은 도메인의 /backend 를 호출하므로 CORS 가 필요 없습니다.
 *
 * 허용 대상
 *   - http(s)://localhost, http(s)://127.0.0.1  (포트 무관) → 로컬 개발
 *   - config.php 의 allowed_origins 에 등록한 도메인
 */
declare(strict_types=1);

/**
 * config.php 의 allowed_origins 목록
 *
 * @return array
 */
function cors_allowed_origins()
{
    static $origins = null;

    if ($origins !== null) {
        return $origins;
    }

    $origins = [];
    $path = __DIR__ . '/../config.php';

    if (is_file($path)) {
        $config = require $path;
        if (isset($config['allowed_origins']) && is_array($config['allowed_origins'])) {
            $origins = $config['allowed_origins'];
        }
    }

    return $origins;
}

/**
 * CORS 헤더를 보냅니다. OPTIONS(프리플라이트) 요청이면 여기서 종료합니다.
 *
 * 오류 응답에도 헤더가 필요하므로 모든 엔드포인트의 "가장 앞"에서 호출하세요.
 *
 * @return void
 */
function send_cors_headers()
{
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

    if ($origin !== '') {
        $isLocalhost = (bool) preg_match(
            '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#',
            $origin
        );

        if ($isLocalhost || in_array($origin, cors_allowed_origins(), true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }

    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400');

    $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
