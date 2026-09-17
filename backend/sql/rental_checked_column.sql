-- ---------------------------------------------------------------------------
-- 대관 신청 — 관리자 확인(읽음) 여부
--
-- 관리자 목록(/admin/rentals)의 '확인' 토글이 이 컬럼을 씁니다.
-- phpMyAdmin 또는 콘솔에서 1회 실행하세요. (이미 있으면 오류가 나도 무시)
-- ---------------------------------------------------------------------------

ALTER TABLE `g4_write_order`
  ADD COLUMN `rt_checked`    tinyint(1) NOT NULL DEFAULT 0 COMMENT '관리자 확인 여부' AFTER `rt_terms_at`,
  ADD COLUMN `rt_checked_at` datetime   NULL                COMMENT '관리자 확인 일시' AFTER `rt_checked`;

-- 확인
SHOW COLUMNS FROM `g4_write_order` LIKE 'rt_checked%';
