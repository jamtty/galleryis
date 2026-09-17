-- ===========================================================================
-- 갤러리 이즈 — 전시 테이블
--
-- 실행 방법 (phpMyAdmin)
--   1) 좌측에서 사용할 데이터베이스를 선택합니다.
--   2) [SQL] 탭을 열고 이 내용을 붙여넣은 뒤 실행합니다.
--
-- ⚠ 이 파일은 여러 번 실행해도 안전합니다. (CREATE TABLE IF NOT EXISTS)
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 전시
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exhibition` (
  `ex_id`         INT UNSIGNED NOT NULL AUTO_INCREMENT             COMMENT '전시 번호',
  `ex_title`      VARCHAR(200) NOT NULL                            COMMENT '전시회명',
  `ex_status`     VARCHAR(20)  NOT NULL DEFAULT 'current'          COMMENT '분류 (current 현재전시 / upcoming 예정전시 / past 지난전시)',
  `ex_place`      VARCHAR(200) NOT NULL DEFAULT ''                 COMMENT '전시장소',
  `ex_artist`     VARCHAR(200) NOT NULL DEFAULT ''                 COMMENT '작가명',
  `ex_start_date` DATE                 DEFAULT NULL                COMMENT '전시 시작일',
  `ex_end_date`   DATE                 DEFAULT NULL                COMMENT '전시 종료일',
  `ex_overview`   MEDIUMTEXT                                       COMMENT '전시개요 (HTML)',
  `ex_bio`        MEDIUMTEXT                                       COMMENT '작가 약력 (HTML)',
  `ex_hit`        INT UNSIGNED NOT NULL DEFAULT 0                  COMMENT '조회수',
  `ex_use_yn`     CHAR(1)      NOT NULL DEFAULT 'Y'                COMMENT '노출 여부 (Y/N)',
  `ex_admin_id`   VARCHAR(50)  NOT NULL DEFAULT ''                 COMMENT '등록한 관리자 아이디',
  `ex_created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '등록일',
  `ex_updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`ex_id`),
  KEY `idx_exhibition_status` (`ex_status`, `ex_start_date`),
  KEY `idx_exhibition_period` (`ex_start_date`, `ex_end_date`),
  KEY `idx_exhibition_use` (`ex_use_yn`, `ex_start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='전시';

-- ---------------------------------------------------------------------------
-- 전시 작품 이미지 (작품등록)
--
--   실제 파일은 웹루트 uploads/exhibition/ 에 평면으로 저장되고,
--   이 표가 전시 번호와 저장 파일명을 기억합니다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exhibition_file` (
  `ef_id`         INT UNSIGNED NOT NULL AUTO_INCREMENT             COMMENT '첨부 번호',
  `ex_id`         INT UNSIGNED NOT NULL                            COMMENT 'exhibition.ex_id',
  `ef_no`         INT UNSIGNED NOT NULL DEFAULT 0                  COMMENT '첨부 순번 (0부터)',
  `ef_ori_name`   VARCHAR(255) NOT NULL DEFAULT ''                 COMMENT '원본 파일명',
  `ef_save_name`  VARCHAR(255) NOT NULL DEFAULT ''                 COMMENT '저장 파일명',
  `ef_ext`        VARCHAR(20)  NOT NULL DEFAULT ''                 COMMENT '확장자 (소문자)',
  `ef_size`       INT UNSIGNED NOT NULL DEFAULT 0                  COMMENT '파일 크기 (byte)',
  `ef_width`      INT UNSIGNED NOT NULL DEFAULT 0                  COMMENT '이미지 가로 (아니면 0)',
  `ef_height`     INT UNSIGNED NOT NULL DEFAULT 0                  COMMENT '이미지 세로 (아니면 0)',
  `ef_is_image`   TINYINT(1)   NOT NULL DEFAULT 0                  COMMENT '이미지 여부',
  `ef_created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '등록일',
  PRIMARY KEY (`ef_id`),
  KEY `idx_exhibition_file` (`ex_id`, `ef_no`),
  CONSTRAINT `fk_exhibition_file_exhibition`
    FOREIGN KEY (`ex_id`) REFERENCES `exhibition` (`ex_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='전시 작품 이미지';
