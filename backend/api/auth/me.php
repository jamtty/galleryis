<?php
/**
 * GET /backend/api/auth/me.php
 * Authorization: Bearer <token>
 *
 * 응답 data: { id, name, email, role }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';

send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';

$admin = current_admin();

json_ok([
    'id' => $admin['id'],
    'name' => $admin['name'],
    'email' => $admin['email'],
    'role' => $admin['role'],
]);
