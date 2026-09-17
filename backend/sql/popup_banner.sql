-- 팝업 배너 관리 테이블
--
-- 참고: 위드원상담코칭연구소_리뉴얼 의 popup_banner 와 같은 구조를 씁니다.
--       이미지는 웹루트 uploads/popup/ 에 평면으로 저장하고, img_save_name 만 남깁니다.
--
-- phpMyAdmin 에서 이 파일을 실행해 주세요. (이미 있으면 아무 일도 일어나지 않습니다)

CREATE TABLE IF NOT EXISTS popup_banner (
  id            INT           NOT NULL AUTO_INCREMENT,
  admin_title   VARCHAR(200)  NOT NULL DEFAULT '' COMMENT '관리용 제목',
  url           VARCHAR(500)  NOT NULL DEFAULT '' COMMENT '클릭 시 이동 주소 (빈 값이면 링크 없음)',
  link_target   VARCHAR(10)   NOT NULL DEFAULT '_self' COMMENT '_self 현재 창 | _blank 새 창',
  period_start  DATE          NULL COMMENT '노출 시작일 (NULL = 상한 없음)',
  period_end    DATE          NULL COMMENT '노출 종료일 (NULL = 상한 없음)',
  author        VARCHAR(100)  NOT NULL DEFAULT '',
  use_yn        CHAR(1)       NOT NULL DEFAULT 'Y' COMMENT 'Y 사용 | N 미사용',
  img_pos_left  INT           NOT NULL DEFAULT 0 COMMENT '가로 위치 px (0 = 가운데)',
  img_pos_top   INT           NOT NULL DEFAULT 0 COMMENT '세로 위치 px (0 = 가운데)',
  sort_order    INT           NOT NULL DEFAULT 1 COMMENT '작을수록 먼저 노출',
  img_ori_name  VARCHAR(255)  NOT NULL DEFAULT '',
  img_save_name VARCHAR(255)  NOT NULL DEFAULT '',
  img_url       VARCHAR(500)  NOT NULL DEFAULT '',
  img_width     INT           NOT NULL DEFAULT 0,
  img_height    INT           NOT NULL DEFAULT 0,
  created_by    VARCHAR(100)  NOT NULL DEFAULT '',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by    VARCHAR(100)  NOT NULL DEFAULT '',
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_popup_use_sort (use_yn, sort_order),
  KEY idx_popup_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='팝업 배너';
