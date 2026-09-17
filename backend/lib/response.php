<?php
/**
 * JSON 응답 헬퍼
 *
 * 프론트(src/api/client.ts)는 아래 공통 형식을 기대합니다.
 *   성공: { "success": true,  "data": ... }
 *   실패: { "success": false, "message": "..." }
 */
declare(strict_types=1);

/**
 * JSON 을 출력하고 종료합니다.
 *
 * @param int   $status  HTTP 상태 코드
 * @param array $payload 응답 본문
 * @return void
 */
function json_response($status, array $payload)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * 성공 응답
 *
 * @param mixed $data
 * @return void
 */
function json_ok($data = null)
{
    json_response(200, ['success' => true, 'data' => $data]);
}

/**
 * 실패 응답
 *
 * @param string $message
 * @param int    $status
 * @return void
 */
function json_error($message, $status = 400)
{
    json_response($status, ['success' => false, 'message' => $message]);
}

/**
 * 요청 본문(JSON)을 배열로 돌려줍니다.
 *
 * @return array
 */
function read_json_body()
{
    $raw = file_get_contents('php://input');

    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);

    return is_array($decoded) ? $decoded : [];
}

/**
 * POST 요청인지 확인하고, 아니면 405 로 종료합니다.
 *
 * @return void
 */
function require_post()
{
    $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

    if ($method !== 'POST') {
        json_error('POST 요청만 허용됩니다.', 405);
    }
}
