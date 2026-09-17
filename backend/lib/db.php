<?php
/**
 * DB 연결 (PDO / MySQL)
 *
 * PHP 7.4+ 기준으로 작성했습니다.
 */
declare(strict_types=1);

require_once __DIR__ . '/response.php';

/**
 * config.php 를 읽어 설정 배열을 돌려줍니다. (한 번만 읽습니다)
 *
 * @return array
 */
function db_config()
{
    static $config = null;

    if ($config === null) {
        $path = __DIR__ . '/../config.php';

        if (!is_file($path)) {
            throw new RuntimeException(
                'config.php 가 없습니다. config.sample.php 를 복사해 값을 채워 주세요.'
            );
        }

        $config = require $path;
    }

    return $config;
}

/**
 * PDO 인스턴스 (지연 연결 + 재사용)
 *
 * @return PDO
 */
function db()
{
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    try {
        $cfg = db_config();
        $db = $cfg['db'];

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $db['host'],
            isset($db['port']) ? (int) $db['port'] : 3306,
            $db['name'],
            isset($db['charset']) ? $db['charset'] : 'utf8mb4'
        );

        $pdo = new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        // 서버/테이블 문자셋과 무관하게 항상 UTF-8 로 주고받습니다.
        // 그누보드4 레거시 테이블(g4_*)은 euc-kr 이라 이 설정이 없으면 한글이 깨지고,
        // 반대로 저장할 때도 euc-kr 로 변환되지 않습니다.
        $pdo->exec('SET NAMES utf8mb4');
    } catch (Throwable $e) {
        // 설정 누락 / 접속 정보 오류 / DB 장애를 모두 JSON 으로 돌려줍니다.
        json_error('데이터베이스에 연결할 수 없습니다. backend/config.php 를 확인해 주세요.', 500);
    }

    return $pdo;
}
