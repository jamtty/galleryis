-- 사이트 환경설정 테이블 (키 = 값)
--
-- 관리자 [환경설정] 메뉴에서 고치는 값들을 한 줄씩 담습니다.
-- 어떤 키가 있는지(이름·제목·입력 종류)는 코드가 기준입니다.
--   → backend/lib/setting.php 의 setting_definitions()
-- 즉, 새 설정을 추가할 때는 table 은 그대로 두고 코드에 한 줄만 추가하면 됩니다.
-- (개인정보처리방침처럼 긴 글은 'html' 종류로 넣고 에디터로 씁니다)
--
-- phpMyAdmin 에서 이 파일을 실행해 주세요. (이미 있으면 아무 일도 일어나지 않습니다)

CREATE TABLE IF NOT EXISTS site_setting (
  st_key     VARCHAR(60)  NOT NULL COMMENT '설정 키 (예: page_notices_lede)',
  st_value   TEXT         NULL COMMENT '설정 값',
  updated_by VARCHAR(100) NOT NULL DEFAULT '' COMMENT '마지막 수정 관리자',
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각',
  PRIMARY KEY (st_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사이트 환경설정 (키 = 값)';


-- ---------------------------------------------------------------------------
-- 초기값 (페이지 제목 아래 문구)
--
-- 순서는 사이트 상단 메뉴와 같습니다. (전시 · 갤러리 이즈 · 전시장 · 대관 · 소식)
-- 그리고 개인정보처리방침 본문(page_privacy_html) 한 줄이 더 있습니다.
-- INSERT IGNORE 라서 이미 값이 있으면 덮어쓰지 않습니다.
-- 값을 비워 두면 공개 화면에서 그 문구는 표시되지 않습니다.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO site_setting (st_key, st_value, updated_by) VALUES
  ('page_exhibitions_lede', ''                                          , ''),
  ('page_about_lede',       ''                                          , ''),
  ('page_halls_lede',       '하나의 건축물 안에 네 개의 독립적인 전시실', ''),
  ('page_rental_lede',      ''                                          , ''),
  ('page_notices_lede',     ''                                          , ''),
  ('page_privacy_html',     ''                                          , '');

-- 예전에 쓰던 키가 남아 있으면 지워도 됩니다. (없으면 아무 일도 일어나지 않습니다)
-- DELETE FROM site_setting WHERE st_key = 'page_visit_lede';


-- ---------------------------------------------------------------------------
-- 개인정보처리방침(st_value) 을 길게 쓸 때 — 한 번만 실행하면 됩니다
--
-- 처음 만든 st_value 는 TEXT 라서 65,535바이트까지만 담깁니다.
-- 처리방침을 저장할 때 "너무 깁니다" 안내가 나오면 아래 주석을 풀고 실행하세요.
-- MEDIUMTEXT(16MB) 로 넓어지고, 기존에 저장된 값은 그대로 남습니다.
-- ---------------------------------------------------------------------------
-- ALTER TABLE site_setting MODIFY st_value MEDIUMTEXT NULL COMMENT '설정 값';
