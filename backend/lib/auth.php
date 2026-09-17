<?php
/**
 * 관리자 인증 (토큰 발급 / 검증)
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';

/**
 * Authorization: Bearer <token> 헤더에서 토큰을 꺼냅니다.
 *
 * @return string 토큰 (없으면 빈 문자열)
 */
function bearer_token()
{
    $header = '';

    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (is_array($headers)) {
            foreach ($headers as $key => $value) {
                if (strcasecmp($key, 'Authorization') === 0) {
                    $header = $value;
                    break;
                }
            }
        }
    }

    if (stripos($header, 'bearer ') === 0) {
        return trim(substr($header, 7));
    }

    return '';
}

/**
 * 토큰 유효 시간(분)
 *
 * @return int
 */
function admin_token_ttl()
{
    $config = db_config();
    $ttl = isset($config['admin_token_ttl']) ? (int) $config['admin_token_ttl'] : 480;

    return $ttl > 0 ? $ttl : 480;
}

/**
 * 새 토큰을 발급해 DB 에 저장합니다.
 *
 * @param string $adminId
 * @return array{token: string, expiresAt: string}
 */
function issue_admin_token($adminId)
{
    $pdo = db();

    // 만료된 토큰은 이때 정리합니다.
    $pdo->exec('DELETE FROM admin_token WHERE expires_at <= NOW()');

    $token = bin2hex(random_bytes(32));
    $expiresAt = new DateTimeImmutable('+' . admin_token_ttl() . ' minutes');

    $stmt = $pdo->prepare(
        'INSERT INTO admin_token (token, admin_id, expires_at) VALUES (?, ?, ?)'
    );
    $stmt->execute([$token, $adminId, $expiresAt->format('Y-m-d H:i:s')]);

    return [
        'token' => $token,
        'expiresAt' => $expiresAt->format('c'),
    ];
}

/**
 * 현재 요청의 관리자 정보를 돌려줍니다. 유효하지 않으면 401 로 종료합니다.
 *
 * @return array
 */
function current_admin()
{
    $token = bearer_token();

    if ($token === '') {
        json_error('인증 토큰이 없습니다. 다시 로그인해 주세요.', 401);
    }

    $sql = "SELECT a.id, a.name, a.email, a.role
              FROM admin_token t
              JOIN admin a ON a.id = t.admin_id
             WHERE t.token = :token
               AND t.expires_at > NOW()
               AND a.use_yn = 'Y'
             LIMIT 1";

    $stmt = db()->prepare($sql);
    $stmt->execute([':token' => $token]);
    $admin = $stmt->fetch();

    if (!$admin) {
        json_error('로그인이 만료되었습니다. 다시 로그인해 주세요.', 401);
    }

    return $admin;
}

/**
 * 현재 요청에 쓰인 토큰을 폐기합니다.
 *
 * @return void
 */
function revoke_current_token()
{
    $token = bearer_token();

    if ($token === '') {
        return;
    }

    $stmt = db()->prepare('DELETE FROM admin_token WHERE token = ?');
    $stmt->execute([$token]);
}
