<?php
/**
 * GET /backend/api/halls/public_list.php   (공개 — 인증 없음)
 *
 * 노출(Y) 중인 전시장을 순서대로 돌려줍니다. (/halls 페이지)
 * 테이블이 아직 없어도 빈 목록을 돌려주어 공개 화면이 깨지지 않습니다.
 *
 * 응답 data: {
 *   items: [ {
 *     id, key, name, floor, spec,
 *     pricePeak, monthPeak, priceOff, monthOff, priceHigh, monthHigh, priceNote,
 *     sheetUrl, planName, planExt, planUrl,
 *     photos: [ { id, url, name, width, height } ]
 *   } ]
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/hall.php';
require_once __DIR__ . '/../../lib/response.php';

try {
    json_ok(['items' => hall_public_list()]);
} catch (Throwable $e) {
    error_log('[hall public] ' . $e->getMessage());

    json_ok(['items' => []]);
}
