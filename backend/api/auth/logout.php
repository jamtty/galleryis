<?php
/**
 * POST /backend/api/auth/logout.php
 * Authorization: Bearer <token>
 *
 * 현재 토큰을 폐기합니다. 이미 만료된 토큰이어도 성공으로 응답합니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';

send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';

require_post();

try {
    revoke_current_token();
} catch (Throwable $e) {
    // 토큰 정리에 실패해도 클라이언트는 세션을 비우므로 성공으로 처리합니다.
    json_ok(null);
}

json_ok(null);
