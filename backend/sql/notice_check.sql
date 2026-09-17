-- ---------------------------------------------------------------------------
-- 공지 (그누보드4 레거시 테이블) 구조 확인
--
-- 관리자 공지 화면은 아래 테이블을 그대로 씁니다.
--   g4_write_notice — 공지 글
--   g4_board_file   — 첨부파일 (bo_table = 'notice')
--   실제 파일       — 웹루트 /uploads/notice/
--
-- ⚠ 컬럼을 새로 만들 필요는 없습니다. 확인용으로만 실행하세요.
-- ---------------------------------------------------------------------------

-- 1) 공지 테이블 컬럼
SELECT `COLUMN_NAME`    AS `컬럼`,
       `COLUMN_TYPE`    AS `타입`,
       `IS_NULLABLE`    AS `NULL허용`,
       `COLUMN_DEFAULT` AS `기본값`,
       `COLUMN_COMMENT` AS `설명`
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
 WHERE `TABLE_SCHEMA` = DATABASE()
   AND `TABLE_NAME`   = 'g4_write_notice'
 ORDER BY `ORDINAL_POSITION`;

-- 2) 첨부 테이블 컬럼 (그누보드4 기본 구조)
SELECT `COLUMN_NAME`    AS `컬럼`,
       `COLUMN_TYPE`    AS `타입`,
       `IS_NULLABLE`    AS `NULL허용`,
       `COLUMN_DEFAULT` AS `기본값`
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
 WHERE `TABLE_SCHEMA` = DATABASE()
   AND `TABLE_NAME`   = 'g4_board_file'
 ORDER BY `ORDINAL_POSITION`;

-- 3) 건수 확인
SELECT COUNT(*) AS `공지_건수`
  FROM `g4_write_notice`
 WHERE `wr_is_comment` = 0;

SELECT COUNT(*) AS `공지_첨부_건수`
  FROM `g4_board_file`
 WHERE `bo_table` = 'notice';

-- 4) 상단 고정 공지 저장 위치 (g4_board.bo_notice)
--    공지 체크는 이 값으로 관리됩니다. (콤마로 구분된 wr_id 목록)
SELECT `bo_table`, `bo_subject`, `bo_notice`
  FROM `g4_board`
 WHERE `bo_table` = 'notice';

-- 4-1) bo_notice 에 적힌 wr_id 가 실제로 존재하는지 확인
--      (삭제된 공지의 wr_id 가 남아 있으면 DB 는 3개인데 목록에는 1개만 나옵니다)
SELECT `wr_id`, `wr_subject`, `wr_is_comment`, `wr_datetime`
  FROM `g4_write_notice`
 WHERE FIND_IN_SET(
         `wr_id`,
         (SELECT `bo_notice` FROM `g4_board` WHERE `bo_table` = 'notice')
       )
 ORDER BY `wr_id` DESC;

-- 4-2) (필요할 때만 직접 실행) 고정 목록 비우기
--      관리자 화면에서 공지 체크로 다시 지정하면 됩니다.
-- UPDATE `g4_board` SET `bo_notice` = '' WHERE `bo_table` = 'notice';

-- 5) 최근 공지 5건 (한글 깨짐 여부 확인)
SELECT `wr_id`, `wr_subject`, `wr_name`, `wr_datetime`, `wr_hit`
  FROM `g4_write_notice`
 WHERE `wr_is_comment` = 0
 ORDER BY `wr_id` DESC
 LIMIT 5;
