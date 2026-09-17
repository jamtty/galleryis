-- ===========================================================================
--  대관 신청서 입력 항목 중 저장할 컬럼이 없던 것들을 추가합니다.
--
--  대상 테이블 : g4_write_order  (그누보드4 대관신청 게시판, euc-kr)
--
--  배경
--    기존 테이블은 그누보드4 여유 필드(wr_1 ~ wr_13)에 값을 밀어 넣는 구조라
--    아래 항목은 전용 컬럼이 없어 wr_3(자유 메모) 문자열에 섞여 들어갔습니다.
--
--      참여 작가 수  →  현재 wr_3 메모에 "참여 작가 수: 3명" 처럼 텍스트로만 남습니다
--      작품 수      →  현재 wr_3 메모에 "작품 수: 12점" 처럼 텍스트로만 남습니다
--      동의 여부    →  저장되지 않고 검증에만 사용됩니다
--
--  설계
--    wr_1 ~ wr_13 은 레거시 데이터와 의미가 섞여 있어(wr_6=연도, wr_7='in' 등)
--    손대지 않고 rt_(rental) 접두사로 새 컬럼만 추가합니다.
--    기존 그누보드 프로그램은 자기 컬럼만 INSERT 하므로 영향이 없고,
--    추가 컬럼은 DEFAULT 값으로 채워집니다.
--
--  ⚠ 실행 전 DB 백업을 권장합니다.
--  ⚠ phpMyAdmin 에서 galleryiscom DB 를 선택한 뒤 이 SQL 을 실행하세요.
--  ⚠ 두 번 실행하면 "Duplicate column name" 오류가 납니다. 정상이며,
--     이미 만들어진 컬럼은 그대로 두면 됩니다.
--  ⚠ 테이블 문자셋이 euc-kr 이라 새 컬럼도 euc-kr 을 따릅니다.
--     한글은 문제없고 이모지 등은 저장되지 않습니다(기존 컬럼과 동일).
-- ===========================================================================

ALTER TABLE `g4_write_order`
  ADD COLUMN `rt_artist_cnt` smallint(6)  NOT NULL DEFAULT 0  COMMENT '참여 작가 수 (그룹전)'        AFTER `wr_13`,
  ADD COLUMN `rt_work_cnt`   smallint(6)  NOT NULL DEFAULT 0  COMMENT '작품 수'                      AFTER `rt_artist_cnt`,
  ADD COLUMN `rt_terms`      varchar(20)  NOT NULL DEFAULT '' COMMENT '동의한 대관 유의사항 버전'     AFTER `rt_work_cnt`,
  ADD COLUMN `rt_terms_at`   datetime     NULL                COMMENT '대관 유의사항 동의 일시'       AFTER `rt_terms`;


-- ---------------------------------------------------------------------------
--  실행 결과 확인
-- ---------------------------------------------------------------------------
SELECT `COLUMN_NAME`    AS `컬럼`,
       `COLUMN_TYPE`    AS `타입`,
       `IS_NULLABLE`    AS `NULL허용`,
       `COLUMN_DEFAULT` AS `기본값`,
       `COLUMN_COMMENT` AS `설명`
  FROM `INFORMATION_SCHEMA`.`COLUMNS`
 WHERE `TABLE_SCHEMA` = DATABASE()
   AND `TABLE_NAME`   = 'g4_write_order'
   AND `COLUMN_NAME` LIKE 'rt\_%'
 ORDER BY `ORDINAL_POSITION`;


-- ===========================================================================
--  (참고) 신청서 항목별 저장 위치
--
--    이름             → wr_name
--    이메일           → wr_email, wr_1("아이디|도메인|")
--    연락처           → wr_10("010|1234|5678|||||||")
--    주소             → wr_9("우편번호|주소1|주소2")
--    희망 전시일      → wr_11(시작 unix ts), wr_12(종료 unix ts)
--    희망 전시장      → wr_8 ("제1전시장(1F)" 등)
--    전시구분         → wr_5 ("개인전" / "그룹전" / "석·박사 청구전")
--    전시장르         → wr_2 ("서양화|")
--    메모             → wr_content, wr_3
--    상태             → wr_13 ('1'=심사중, '2'=대관완료)
--
--    참여 작가 수     → rt_artist_cnt    ← 이 파일에서 추가
--    작품 수          → rt_work_cnt      ← 이 파일에서 추가
--    동의한 약관 버전 → rt_terms         ← 이 파일에서 추가
--    동의 일시        → rt_terms_at      ← 이 파일에서 추가
--
--  ⚠ 전시명·작가명은 현재 신청서에 입력란이 없어
--     wr_subject 를 "개인전 · 제2전시장(2F)" 형태로 조합해 저장합니다.
-- ===========================================================================
