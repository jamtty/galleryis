<?php
/**
 * GET /backend/api/rentals/availability.php
 *
 * 전시장별 주간 대관 가능 여부를 돌려줍니다.
 *
 *   page=0            페이지 단위 (12주씩)
 *   unit=1m|6m|1y|2y  기간 검색 단위 (이번 주부터 최대 2년)
 *
 * 응답 data
 *   {
 *     unit: "6m",
 *     weeksPerPage: 27,
 *     last: false,
 *     edge: "2027-12-31",
 *     weeks: [
 *       { start: "2026-09-16", end: "2026-09-22",
 *         halls: { hall1: "available", hall2: "approved", ... } },
 *       ...
 *     ]
 *   }
 */
declare(strict_types=1);

require_once __DIR__ . '/../../lib/cors.php';
send_cors_headers();

require_once __DIR__ . '/../../lib/rental.php';
require_once __DIR__ . '/../../lib/response.php';

$page = isset($_GET['page']) ? max(0, (int) $_GET['page']) : 0;
$unit = isset($_GET['unit']) ? trim((string) $_GET['unit']) : '';

try {
    // 기간 검색 (1개월 / 6개월 / 1년 / 2년)
    if ($unit !== '' && rental_unit_exists($unit)) {
        $weeks = rental_weeks_for_unit($unit);
        $info = rental_range_info($weeks);

        json_ok([
            'unit' => $unit,
            'weeksPerPage' => count($weeks),
            'last' => $info['last'],
            'edge' => $info['edge'],
            'weeks' => rental_availability($weeks),
        ]);
    }

    $weeks = rental_weeks_for_page($page);
    $info = rental_range_info($weeks);

    json_ok([
        'page' => $page,
        'weeksPerPage' => RENTAL_WEEKS_PER_PAGE,
        'last' => $info['last'],
        'edge' => $info['edge'],
        'weeks' => rental_availability($weeks),
    ]);
} catch (Throwable $e) {
    json_error('대관 일정을 불러오지 못했습니다.', 500);
}
