-- ---------------------------------------------------------------------------
-- 전시 — 분류(현재전시 / 예정전시 / 지난전시) 컬럼
--
-- 이미 exhibition 테이블을 만들어 둔 서버에서 1회 실행하세요.
-- (backend/sql/exhibition.sql 을 아직 실행하지 않았다면 이 파일은 필요 없습니다.
--  exhibition.sql 에 이미 ex_status 가 들어 있습니다.)
--
-- phpMyAdmin 또는 콘솔에서 실행합니다.
-- ⚠ 두 번 실행하면 "Duplicate column name" 오류가 납니다. 정상이며 무시하면 됩니다.
--
-- 참고
--   지난전시로의 자동 변경은 스키마 변경 없이 동작합니다.
--   앱이 목록·등록 요청 때마다 아래 규칙으로 ex_status 를 갱신합니다.
--     오늘 > 종료일  →  past     (지난전시)
--     오늘 < 시작일  →  upcoming (예정전시)
--     그 외        →  current  (현재전시)
-- ---------------------------------------------------------------------------

ALTER TABLE `exhibition`
  ADD COLUMN `ex_status` varchar(20) NOT NULL DEFAULT 'current'
    COMMENT '분류 (current 현재전시 / upcoming 예정전시 / past 지난전시)' AFTER `ex_title`,
  ADD KEY `idx_exhibition_status` (`ex_status`, `ex_start_date`);

-- 확인
SELECT `COLUMN_NAME`    AS `컬럼`,
       `COLUMN_TYPE`    AS `타입`,
       `COLUMN_DEFAULT` AS `기본값`,
       `COLUMN_COMMENT` AS `설명`
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
 WHERE `TABLE_SCHEMA` = DATABASE()
   AND `TABLE_NAME`   = 'exhibition'
   AND `COLUMN_NAME`  = 'ex_status';

-- 분류별 건수
SELECT `ex_status` AS `분류`, COUNT(*) AS `건수`
  FROM `exhibition`
 GROUP BY `ex_status`;
