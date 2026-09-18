-- ===========================================================================
-- 갤러리 이즈 — 전시장(hall) 테이블
--
-- 실행 방법 (phpMyAdmin)
--   1) 좌측에서 사용할 데이터베이스를 선택합니다.
--   2) [SQL] 탭을 열고 이 내용을 붙여넣은 뒤 실행합니다.
--
-- ⚠ 여러 번 실행해도 안전합니다. (CREATE TABLE IF NOT EXISTS · INSERT IGNORE)
--    사진 INSERT 는 "그 전시장에 사진이 하나도 없을 때"만 들어갑니다.
--
-- 구성
--   hall       전시장 4개 (h_key = hall1~hall4 — 대관 신청·일정 표와 같은 키)
--   hall_photo 전시장 사진 (공개 페이지의 가로 스크롤 갤러리)
--
-- 실제 사진 파일은 웹루트 `uploads/hall/` 에 두고, 이 표가 파일명을 기억합니다.
--   도면·조감도   hall1-sheet.jpg ~ hall4-sheet.jpg
--   도면 파일     hall1-plan.jpg  ~ hall4-plan.jpg
--   전시장 사진   hall1-photo-01.jpg ~ 08.jpg (4개 전시장 × 8장)
--   → apps/scripts/hall-assets-import.mjs 로 원본에서 내려받은 뒤 uploads 프로필로 업로드
--
-- ⚠ 이미 hall 테이블을 만들어 둔 서버는 이 파일 대신
--    backend/sql/hall_plan_name_column.sql 을 실행하세요. (도면 칸 이름 변경)
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 전시장
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `hall` (
  `h_id`         INT UNSIGNED NOT NULL AUTO_INCREMENT             COMMENT '전시장 번호',
  `h_key`        VARCHAR(20)  NOT NULL                            COMMENT '대관 연동 키 (hall1~hall4)',
  `h_name`       VARCHAR(100) NOT NULL DEFAULT ''                 COMMENT '전시장명 (제1전시장)',
  `h_floor`      VARCHAR(20)  NOT NULL DEFAULT ''                 COMMENT '층 (1F)',
  `h_spec`       VARCHAR(200) NOT NULL DEFAULT ''                 COMMENT '규모 (181m² · 55평 (공유면적 포함) · 층고 280cm)',
  `h_price_peak` INT UNSIGNED NOT NULL DEFAULT 0                  COMMENT '평수기 요금 (원) — 0 이면 표시 안 함',
  `h_month_peak` VARCHAR(50)  NOT NULL DEFAULT ''                 COMMENT '평수기 해당 월 (3~6·9·12월)',
  `h_price_off`  INT UNSIGNED NOT NULL DEFAULT 0                  COMMENT '비수기 요금 (원)',
  `h_month_off`  VARCHAR(50)  NOT NULL DEFAULT ''                 COMMENT '비수기 해당 월 (1·2·7·8월)',
  `h_price_high` INT UNSIGNED NOT NULL DEFAULT 0                  COMMENT '성수기 요금 (원)',
  `h_month_high` VARCHAR(50)  NOT NULL DEFAULT ''                 COMMENT '성수기 해당 월 (10·11월)',
  `h_price_note` VARCHAR(100) NOT NULL DEFAULT ''                 COMMENT '요금 안내 (주 단위 · VAT 포함)',
  `h_sheet_name` VARCHAR(255) NOT NULL DEFAULT ''                 COMMENT '도면·조감도 이미지 파일명 (uploads/hall/)',
  `h_plan_name`  VARCHAR(255) NOT NULL DEFAULT ''                 COMMENT '도면 파일명 (uploads/hall/) — [도면 내려받기] · 비면 버튼 숨김',
  `h_studio_url` VARCHAR(255) NOT NULL DEFAULT ''                 COMMENT '예전 외부 3D 주소 — 더 쓰지 않음 (3D 둘러보기는 /halls/:key/studio)',
  `h_use_yn`     CHAR(1)      NOT NULL DEFAULT 'Y'                COMMENT '노출 여부 (Y/N)',
  `h_admin_id`   VARCHAR(50)  NOT NULL DEFAULT ''                 COMMENT '마지막으로 수정한 관리자',
  `h_created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '등록일',
  `h_updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`h_id`),
  UNIQUE KEY `uniq_hall_key` (`h_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='전시장';

-- ---------------------------------------------------------------------------
-- 전시장 사진
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `hall_photo` (
  `hp_id`         INT UNSIGNED NOT NULL AUTO_INCREMENT            COMMENT '사진 번호',
  `h_id`          INT UNSIGNED NOT NULL                           COMMENT 'hall.h_id',
  `hp_no`         INT UNSIGNED NOT NULL DEFAULT 0                 COMMENT '순서 (0부터)',
  `hp_save_name`  VARCHAR(255) NOT NULL DEFAULT ''                COMMENT '저장 파일명',
  `hp_ori_name`   VARCHAR(255) NOT NULL DEFAULT ''                COMMENT '원본 파일명',
  `hp_ext`        VARCHAR(20)  NOT NULL DEFAULT ''                COMMENT '확장자 (소문자)',
  `hp_size`       INT UNSIGNED NOT NULL DEFAULT 0                 COMMENT '파일 크기 (byte)',
  `hp_width`      INT UNSIGNED NOT NULL DEFAULT 0                 COMMENT '가로 (모르면 0)',
  `hp_height`     INT UNSIGNED NOT NULL DEFAULT 0                 COMMENT '세로 (모르면 0)',
  `hp_created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록일',
  PRIMARY KEY (`hp_id`),
  KEY `idx_hall_photo` (`h_id`, `hp_no`),
  CONSTRAINT `fk_hall_photo_hall`
    FOREIGN KEY (`h_id`) REFERENCES `hall` (`h_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='전시장 사진';

-- ---------------------------------------------------------------------------
-- 초기 데이터 — 원본 사이트(galleryis.web.app/halls) 값 그대로
--   요금 단위: 원 · 0 이면 그 줄은 표시하지 않습니다.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `hall`
  (`h_key`, `h_name`, `h_floor`, `h_spec`,
   `h_price_peak`, `h_month_peak`, `h_price_off`, `h_month_off`, `h_price_high`, `h_month_high`,
   `h_price_note`, `h_sheet_name`, `h_plan_name`, `h_studio_url`, `h_use_yn`, `h_admin_id`)
VALUES
  ('hall1', '제1전시장', '1F', '181m² · 55평 (공유면적 포함) · 층고 280cm',
   5500000, '3~6·9·12월', 4950000, '1·2·7·8월', 5940000, '10·11월',
   '주 단위 · VAT 포함', 'hall1-sheet.jpg', 'hall1-plan.jpg',
   '', 'Y', 'system'),

  ('hall2', '제2전시장', '2F', '181m² · 55평 (공유면적 포함) · 층고 300cm',
   3300000, '3~6·9·12월', 2970000, '1·2·7·8월', 3460000, '10·11월',
   '주 단위 · VAT 포함', 'hall2-sheet.jpg', 'hall2-plan.jpg',
   '', 'Y', 'system'),

  ('hall3', '제3전시장', '3F', '181m² · 55평 (공유면적 포함) · 층고 300cm',
   2200000, '3~6·9·12월', 1980000, '1·2·7·8월', 2420000, '10·11월',
   '주 단위 · VAT 포함', 'hall3-sheet.jpg', 'hall3-plan.jpg',
   '', 'Y', 'system'),

  ('hall4', '제4전시장', 'B1', '172m² · 52평 (공유면적 포함) · 층고 280cm',
   2200000, '3~6·9·12월', 1980000, '1·2·7·8월', 2420000, '10·11월',
   '주 단위 · VAT 포함', 'hall4-sheet.jpg', 'hall4-plan.jpg',
   '', 'Y', 'system');

-- ---------------------------------------------------------------------------
-- 초기 사진 — hall1-photo-01.jpg ~ 08.jpg (전시장마다 8장)
--   그 전시장에 사진이 하나도 없을 때만 들어갑니다. (다시 실행해도 중복 없음)
-- ---------------------------------------------------------------------------
INSERT INTO `hall_photo` (`h_id`, `hp_no`, `hp_save_name`, `hp_ori_name`, `hp_ext`)
SELECT h.`h_id`,
       n.`no`,
       CONCAT(h.`h_key`, '-photo-', LPAD(n.`no` + 1, 2, '0'), '.jpg'),
       CONCAT(h.`h_key`, '-photo-', LPAD(n.`no` + 1, 2, '0'), '.jpg'),
       'jpg'
  FROM `hall` h
  JOIN (
        SELECT 0 AS `no` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
        UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
       ) n
 WHERE h.`h_key` IN ('hall1', 'hall2', 'hall3', 'hall4')
   AND NOT EXISTS (SELECT 1 FROM `hall_photo` p WHERE p.`h_id` = h.`h_id`);

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT h.`h_key`  AS `키`,
       h.`h_name` AS `전시장`,
       h.`h_floor` AS `층`,
       h.`h_use_yn` AS `노출`,
       (SELECT COUNT(*) FROM `hall_photo` p WHERE p.`h_id` = h.`h_id`) AS `사진`
  FROM `hall` h
 ORDER BY h.`h_id`;
