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

    /**
     * 영문 번역 (한국어 → 영어)
     *
     * 관리자가 쓴 글(전시·공지·전시장·팝업·개인정보처리방침)을 영문 화면에서도
     * 보여 주려면 번역 서비스 키가 필요합니다. 비워 두면 영문은 나오지 않고
     * 화면은 지금처럼 한국어로 동작합니다.
     *
     *   google — Google Cloud Translation API 키   (원본 사이트가 쓴 방식)
     *            https://console.cloud.google.com/apis/library/translate.googleapis.com
     *   papago — 네이버 Papago: Client ID + Client Secret
     *            https://developers.naver.com/apps/#/register (Papago 번역)
     *   deepl  — DeepL Auth Key (무료 키는 끝이 ':fx')
     *            https://www.deepl.com/pro-api
     *
     * HTML 본문(전시개요·약력·공지·방침)은 태그를 살려서 번역해야 하므로
     * google · deepl 을 권합니다. (papago 는 태그 보존을 보장하지 않습니다)
     */
    'translate' => [
        'provider' => 'none',   // google | papago | deepl | none
        'key' => '',
        'secret' => '',         // papago 만 사용
    ],

    // CORS 추가 허용 도메인.
    // localhost / 127.0.0.1 은 포트와 무관하게 항상 허용되므로
    // 로컬 개발만 한다면 비워 두어도 됩니다. (운영 빌드는 같은 출처라 불필요)
    'allowed_origins' => [
        // 'https://www.galleryis.com',
    ],
];
