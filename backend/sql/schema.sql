-- ===========================================================================
-- 갤러리 이즈 — 관리자 테이블
--
-- 실행 방법 (phpMyAdmin)
--   1) 좌측에서 사용할 데이터베이스를 선택합니다.
--   2) [SQL] 탭을 열고 이 내용을 붙여넣은 뒤 실행합니다.
--
-- 브라우저에서 backend/setup.php 를 한 번 실행해도 같은 결과가 됩니다.
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 관리자 계정
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin` (
  `id`            VARCHAR(50)  NOT NULL                  COMMENT '관리자 아이디',
  `password`      VARCHAR(255) NOT NULL                  COMMENT 'password_hash() 결과',
  `name`          VARCHAR(100) NOT NULL                  COMMENT '이름',
  `email`         VARCHAR(200)         DEFAULT NULL      COMMENT '이메일',
  `role`          VARCHAR(20)  NOT NULL DEFAULT 'ADMIN'  COMMENT '권한',
  `use_yn`        CHAR(1)      NOT NULL DEFAULT 'Y'      COMMENT '사용 여부',
  `last_login_at` DATETIME             DEFAULT NULL      COMMENT '최근 로그인 일시',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='관리자';

-- ---------------------------------------------------------------------------
-- 로그인 토큰
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_token` (
  `token`      CHAR(64)    NOT NULL               COMMENT 'bin2hex(random_bytes(32))',
  `admin_id`   VARCHAR(50) NOT NULL               COMMENT 'admin.id',
  `expires_at` DATETIME    NOT NULL               COMMENT '만료 일시',
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token`),
  KEY `idx_admin_token_admin` (`admin_id`),
  KEY `idx_admin_token_expires` (`expires_at`),
  CONSTRAINT `fk_admin_token_admin`
    FOREIGN KEY (`admin_id`) REFERENCES `admin` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='관리자 로그인 토큰';

-- ---------------------------------------------------------------------------
-- 초기 관리자: admin / is0521
--
-- password 값은 PHP password_hash('is0521', PASSWORD_DEFAULT) 결과입니다.
--   $2y$10$8m5SIjoEvk7ruLVotXxJW.WS1945jaJp8DuKvDcrs.ZsfD3hXifHi
--
-- ⚠ 운영 환경에서는 로그인 후 반드시 비밀번호를 변경하세요.
-- ⚠ 같은 아이디가 이미 있으면 아무 것도 바꾸지 않습니다. (INSERT IGNORE)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `admin` (`id`, `password`, `name`, `role`)
VALUES (
  'admin',
  '$2y$10$8m5SIjoEvk7ruLVotXxJW.WS1945jaJp8DuKvDcrs.ZsfD3hXifHi',
  '관리자',
  'ADMIN'
);
