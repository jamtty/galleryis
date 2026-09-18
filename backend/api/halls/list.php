<?php
/**
 * GET /backend/api/halls/list.php   (관리자 전용)
 *
 * 전시장 4개를 순서대로 돌려줍니다. (전시장은 고정 — 등록·삭제 없음)
 *
 * 응답 data: {
 *   items: [ {
 *     id, key, name, floor, spec,
 *     pricePeak, monthPeak, priceOff, monthOff, priceHigh, monthHigh, priceNote,
 *     sheetUrl, planName, planExt, planUrl, useYn, updatedAt,
 *     photos: [ { id, url, name, width, height } ]
 *   } ]
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/hall.php';
require_once __DIR__ . '/../../lib/response.php';

// 관리자만 조회 가능
current_admin();

try {
    json_ok(['items' => hall_list()]);
} catch (Throwable $e) {
    error_log('[hall list] ' . $e->getMessage());

    json_error('전시장 목록을 불러오지 못했습니다.', 500);
}
