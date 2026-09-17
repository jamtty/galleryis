<?php
/**
 * POST /backend/api/auth/password.php
 * body: { "currentPassword": "...", "newPassword": "..." }
 *
 * 비밀번호를 변경하고 기존 토큰을 모두 폐기합니다. (재로그인 필요)
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';

send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';

require_post();

$admin = current_admin();

$body = read_json_body();
$currentPassword = isset($body['currentPassword']) ? (string) $body['currentPassword'] : '';
$newPassword = isset($body['newPassword']) ? (string) $body['newPassword'] : '';
$newPasswordConfirm = isset($body['newPasswordConfirm']) ? (string) $body['newPasswordConfirm'] : '';

if ($currentPassword === '' || $newPassword === '') {
    json_error('현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.', 422);
}

if ($newPassword !== $newPasswordConfirm) {
    json_error('새 비밀번호가 서로 일치하지 않습니다.', 422);
}

// 최소 길이: 4자리 (프론트 apps/src/api/auth.ts 의 PASSWORD_MIN_LENGTH 와 동일)
if (strlen($newPassword) < 4) {
    json_error('새 비밀번호는 4자리 이상이어야 합니다.', 422);
}

if ($newPassword === $currentPassword) {
    json_error('새 비밀번호가 현재 비밀번호와 같습니다.', 422);
}

$pdo = db();

$stmt = $pdo->prepare('SELECT password FROM admin WHERE id = ? LIMIT 1');
$stmt->execute([$admin['id']]);
$row = $stmt->fetch();

if (!$row || !password_verify($currentPassword, $row['password'])) {
    json_error('현재 비밀번호가 올바르지 않습니다.', 401);
}

$pdo->prepare('UPDATE admin SET password = ? WHERE id = ?')->execute([
    password_hash($newPassword, PASSWORD_DEFAULT),
    $admin['id'],
]);

// 비밀번호가 바뀌었으니 발급된 토큰을 모두 무효화합니다.
$pdo->prepare('DELETE FROM admin_token WHERE admin_id = ?')->execute([$admin['id']]);

json_ok(null);
