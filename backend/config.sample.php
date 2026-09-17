<?php
/**
 * 백엔드 설정 템플릿.
 *
 * 사용 방법
 *   1) 이 파일을 같은 폴더의 config.php 로 복사합니다.
 *   2) 아래 값을 Cafe24 MySQL 정보로 채웁니다.
 *
 * config.php 는 접속 정보를 담고 있으므로 저장소에 커밋하지 마세요.
 */

return [
    'db' => [
        // Cafe24 는 보통 'localhost' 입니다.
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'galleryiscom',
        'user' => 'galleryiscom',
        'password' => '',
        'charset' => 'utf8mb4',
    ],

    // 관리자 로그인 토큰 유효 시간(분). 기본 8시간.
    'admin_token_ttl' => 480,

    // CORS 추가 허용 도메인.
    // localhost / 127.0.0.1 은 포트와 무관하게 항상 허용되므로
    // 로컬 개발만 한다면 비워 두어도 됩니다. (운영 빌드는 같은 출처라 불필요)
    'allowed_origins' => [
        // 'https://www.galleryis.com',
    ],
];
