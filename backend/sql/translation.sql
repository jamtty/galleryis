-- ===========================================================================
-- 갤러리 이즈 — 영문 번역 표 (기계 번역 캐시)
--
--   관리자가 한국어로 쓴 글의 **영문**을 담아 둡니다. 영문 화면(EN)에서
--   전시·공지·전시장·팝업·개인정보처리방침이 영어로 보이게 하는 표입니다.
--   원문은 각자의 표(exhibition · g4_write_notice · hall · popup_banner ·
--   site_setting)에 그대로 있고, 이 표에는 파생된 영문만 있습니다.
--
--   tr_source_hash 는 번역했던 한국어의 지문(sha1)입니다. 관리자가 한국어를
--   고치면 지문이 달라져, 그 항목만 다시 번역됩니다.
--
-- 실행 방법 (phpMyAdmin)
--   1) 좌측에서 사용할 데이터베이스를 선택합니다.
--   2) [SQL] 탭을 열고 이 내용을 붙여넣은 뒤 실행합니다.
--
-- ⚠ 이 파일은 여러 번 실행해도 안전합니다. (CREATE TABLE IF NOT EXISTS)
-- ⚠ 이 표가 없어도 사이트는 한국어로 정상 동작합니다. (영문만 안 나옵니다)
-- ===========================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `translation` (
  `tr_id`          INT UNSIGNED NOT NULL AUTO_INCREMENT              COMMENT '번역 번호',
  `tr_entity`      VARCHAR(20)  NOT NULL                             COMMENT '대상 (exhibition · notice · hall · popup · setting)',
  `tr_ref`         VARCHAR(40)  NOT NULL                             COMMENT '대상 안에서의 번호 (ex_id · wr_id · h_key · popup id · st_key)',
  `tr_field`       VARCHAR(40)  NOT NULL                             COMMENT '항목 (title · artist · overview · bio · body · name · html)',
  `tr_source_hash` CHAR(40)     NOT NULL DEFAULT ''                  COMMENT '번역한 한국어 원문의 sha1 (원문이 바뀌면 다시 번역)',
  `tr_text`        MEDIUMTEXT                                        COMMENT '영문',
  `tr_provider`    VARCHAR(20)  NOT NULL DEFAULT ''                  COMMENT '번역 제공자 (google · papago · deepl)',
  `tr_updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP            COMMENT '번역 시각',
  PRIMARY KEY (`tr_id`),
  UNIQUE KEY `uniq_translation` (`tr_entity`, `tr_ref`, `tr_field`),
  KEY `idx_translation_entity` (`tr_entity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='영문 번역 (기계 번역)';
