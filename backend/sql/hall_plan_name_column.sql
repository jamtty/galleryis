-- ---------------------------------------------------------------------------
-- 전시장 — [도면 내려받기] 를 주소 입력에서 파일 첨부로 바꿉니다.
--
-- 이미 hall 테이블을 만들어 둔 서버에서 1회 실행하세요.
-- (backend/sql/hall.sql 을 아직 실행하지 않았다면 이 파일은 필요 없습니다.
--  hall.sql 에 이미 h_plan_name 이 들어 있습니다.)
--
-- 바뀌는 것
--   h_plan_url  '/uploads/hall/hall1-plan.jpg'  ← 사람이 직접 적던 주소
--   h_plan_name 'hall1-plan.jpg'                ← 관리자 화면에서 올린 파일명
--
-- 주소를 앱이 만들면(upload_file_url) 개발 PC(localhost)에서도 열립니다.
-- 기존 값은 파일명만 남기고 그대로 옮겨 오므로 이미 올려 둔 도면이 계속 동작합니다.
--
-- phpMyAdmin 또는 콘솔에서 실행합니다.
-- ⚠ **여러 번 실행해도 안전합니다.** 이미 바뀐 서버에서는 "이미 실행되었습니다" 만 나옵니다.
-- ⚠ 실행 전 DB 백업을 권장합니다.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

-- h_plan_url 이 남아 있을 때만 이름을 바꿉니다. (이미 바뀌었으면 안내만 출력)
SET @has_plan_url := (
  SELECT COUNT(*) FROM `INFORMATION_SCHEMA`.`COLUMNS`
   WHERE `TABLE_SCHEMA` = DATABASE()
     AND `TABLE_NAME`   = 'hall'
     AND `COLUMN_NAME`  = 'h_plan_url'
);

SET @sql := IF(
  @has_plan_url > 0,
  'ALTER TABLE `hall` CHANGE COLUMN `h_plan_url` `h_plan_name` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''도면 파일명 (uploads/hall/) — [도면 내려받기] · 비면 버튼 숨김''',
  'SELECT ''이미 실행되었습니다 (h_plan_name 사용 중)'' AS `안내`'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 주소로 들어 있던 값은 파일명만 남깁니다. ('/uploads/hall/hall1-plan.jpg' → 'hall1-plan.jpg')
UPDATE `hall`
   SET `h_plan_name` = SUBSTRING_INDEX(`h_plan_name`, '/', -1)
 WHERE `h_plan_name` LIKE '%/%';

-- ---------------------------------------------------------------------------
-- 확인 — 아래 두 결과가 나오면 정상입니다.
--   · h_plan_name 컬럼이 VARCHAR(255)
--   · 도면 파일이 hall1-plan.jpg ~ hall4-plan.jpg (앞의 /uploads/hall/ 이 없어야 정상)
-- ---------------------------------------------------------------------------
SELECT `COLUMN_NAME`    AS `컬럼`,
       `COLUMN_TYPE`    AS `타입`,
       `IS_NULLABLE`    AS `NULL허용`,
       `COLUMN_DEFAULT` AS `기본값`,
       `COLUMN_COMMENT` AS `설명`
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
 WHERE `TABLE_SCHEMA` = DATABASE()
   AND `TABLE_NAME`   = 'hall'
   AND `COLUMN_NAME`  = 'h_plan_name';

SELECT `h_key`       AS `키`,
       `h_name`      AS `전시장`,
       `h_plan_name` AS `도면 파일`
  FROM `hall`
 ORDER BY `h_id`;
