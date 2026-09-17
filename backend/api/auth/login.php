<?php
/**
 * POST /backend/api/auth/login.php
 * body: { "id": "...", "password": "..." }
 *
 * 응답 data: { token, expiresAt, user: { id, name, email, role } }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';

// CORS 헤더를 먼저 보내고, 프리플라이트(OPTIONS)는 여기서 종료됩니다.
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';

require_post();

$body = read_json_body();
$id = isset($body['id']) ? trim((string) $body['id']) : '';
$password = isset($body['password']) ? (string) $body['password'] : '';

if ($id === '' || $password === '') {
    json_error('아이디와 비밀번호를 모두 입력해 주세요.', 422);
}

try {
    $pdo = db();
} catch (Throwable $e) {
    json_error('데이터베이스에 연결할 수 없습니다. backend/config.php 를 확인해 주세요.', 500);
}
$stmt = $pdo->prepare(
    'SELECT id, password, name, email, role, use_yn FROM admin WHERE id = ? LIMIT 1'
);
$stmt->execute([$id]);
$admin = $stmt->fetch();

// 계정 존재 여부가 드러나지 않도록 동일한 메시지를 사용합니다.
$invalidMessage = '아이디 또는 비밀번호가 올바르지 않습니다.';

if (!$admin || $admin['use_yn'] !== 'Y') {
    json_error($invalidMessage, 401);
}

if (!password_verify($password, $admin['password'])) {
    json_error($invalidMessage, 401);
}

// 해시 알고리즘이 바뀌었으면 로그인 시점에 재해시합니다.
if (password_needs_rehash($admin['password'], PASSWORD_DEFAULT)) {
    $rehash = $pdo->prepare('UPDATE admin SET password = ? WHERE id = ?');
    $rehash->execute([password_hash($password, PASSWORD_DEFAULT), $admin['id']]);
}

$pdo->prepare('UPDATE admin SET last_login_at = NOW() WHERE id = ?')->execute([$admin['id']]);

$issued = issue_admin_token($admin['id']);

json_ok([
    'token' => $issued['token'],
    'expiresAt' => $issued['expiresAt'],
    'user' => [
        'id' => $admin['id'],
        'name' => $admin['name'],
        'email' => $admin['email'],
        'role' => $admin['role'],
    ],
]);
