# 갤러리 이즈 — 백엔드 (PHP + MySQL)

관리자 로그인 / 관리 API 를 제공하는 PHP 백엔드입니다.
Cafe24 의 `galleryiscom` 계정에 SFTP 로 올라갑니다.

```
로컬                          운영 (galleryiscom.mycafe24.com)
backend/          ──SFTP──▶   /www/backend/
apps/dist/        ──SFTP──▶   /www/           ← React 빌드 결과
```

## 구조

```
backend/
├─ config.php           실제 DB 접속 정보  ⚠ 커밋 금지
├─ config.sample.php    설정 템플릿
├─ setup.php            최초 1회 설치 스크립트 (설치 후 삭제)
├─ .htaccess            Authorization 헤더 전달 / 설정 파일 접근 차단
├─ lib/
│  ├─ db.php            PDO 연결
│  ├─ response.php      JSON 응답 헬퍼
│  ├─ auth.php          토큰 발급 / 검증
│  ├─ upload.php        업로드 공통 헬퍼 (파일 저장 · URL)
│  ├─ html.php           본문(HTML) 정화 · 글자 수
│  ├─ exhibition.php    전시 도메인 (검증 · 저장 · 목록)
│  └─ notice.php        공지 도메인 (그누보드4 g4_write_notice)
├─ api/
│  ├─ auth/
│  │  ├─ login.php      POST  로그인
│  │  ├─ logout.php     POST  로그아웃
│  │  ├─ me.php         GET   내 정보
│  │  └─ password.php   POST  비밀번호 변경
│  └─ exhibitions/
│     ├─ create.php       POST  전시 등록 (multipart)
│     ├─ list.php         GET   전시 목록
│     ├─ detail.php       GET   전시 1건 (수정 화면)
│     ├─ update.php       POST  전시 수정 (multipart)
│     ├─ delete.php       POST  전시 삭제 (작품 이미지도 함께)
│     └─ editor_image.php POST  에디터 이미지 업로드
│  └─ notices/
│     ├─ list.php       GET   공지 목록
│     ├─ detail.php     GET   공지 1건
│     ├─ create.php     POST  공지 등록 (multipart)
│     ├─ update.php     POST  공지 수정 (multipart)
│     └─ delete.php     POST  공지 삭제 (첨부도 함께)
│  └─ settings/
│     ├─ public.php     GET   공개 설정값 — 인증 없음 (테이블 없으면 기본값)
│     ├─ detail.php     GET   설정 정의 + 값 (관리자)
│     └─ update.php     POST  설정 저장 (관리자, JSON)
└─ sql/
   ├─ schema.sql        관리자 테이블 생성 + 초기 계정
   ├─ exhibition.sql    전시 테이블 (exhibition · exhibition_file)
   ├─ exhibition_status_column.sql  분류(ex_status) 컴럼 추가 (기존 설치용)
   ├─ site_setting.sql  사이트 환경설정 테이블 (site_setting · 키 = 값)
   └─ notice_check.sql  공지 레거시 테이블 구조 확인 (읽기 전용)
```

## 환경설정 (site_setting)

관리자 [환경설정] 메뉴에서 페이지 제목 아래 문구 같은 값을 고칩니다.

- 저장소: `site_setting` 테이블 — `st_key`(기본키) · `st_value`
- 정의(키 · 제목 · 입력 종류): `lib/setting.php` 의 `setting_definitions()` **가 단일 기준**
- 새 설정 추가: `setting_definitions()` 에 한 줄 + (필요하면) `sql/site_setting.sql` 에 초기값 한 줄
  → 관리자 화면은 서버가 내려 주는 정의를 그대로 그리므로 프론트 수정이 필요 없습니다.
  → 공개 화면에서 쓸 값이면 `'public' => true` 로 적고 `apps/src/api/settings.ts` 의 `SETTING_KEYS` 에 키를 추가합니다.

## 배포 순서

1. **DB 접속 정보 채우기**
   `backend/config.php` 의 `name` / `user` / `password` 를 Cafe24 MySQL 정보로 채웁니다.
   (Cafe24: `host` 는 보통 `localhost`)

2. **업로드**
   VS Code SFTP 확장으로 `backend/` 폴더를 저장하면 `/www/backend/` 로 올라갑니다.

3. **설치 실행**
   브라우저에서 `https://<도메인>/backend/setup.php` 를 엽니다.
   - `admin` / `admin_token` 테이블 생성
   - 초기 계정 `admin` / `is0521` 생성

   > phpMyAdmin 에서 `sql/schema.sql` 을 직접 실행해도 됩니다.

4. **setup.php 삭제**
   설치가 끝나면 서버에서 `setup.php` 를 지웁니다.

5. **로그인 확인**
   `https://<도메인>/admin/login` → `admin` / `is0521`

6. **비밀번호 변경**
   헤더의 사용자 메뉴에서 변경하거나, `password.php` API 를 사용합니다.

## API 규격

모든 응답은 아래 형식을 따릅니다. (프론트 `src/api/client.ts` 와 동일)

```json
{ "success": true,  "data": { ... } }
{ "success": false, "message": "오류 메시지" }
```

인증이 필요한 요청은 헤더에 토큰을 넣습니다.

```
Authorization: Bearer <token>
```

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/backend/api/auth/login.php` | ✕ | `{ id, password }` → `{ token, expiresAt, user }` |
| POST | `/backend/api/auth/logout.php` | ○ | 현재 토큰 폐기 |
| GET | `/backend/api/auth/me.php` | ○ | 로그인한 관리자 정보 |
| POST | `/backend/api/auth/password.php` | ○ | `{ currentPassword, newPassword }` |
| POST | `/backend/api/exhibitions/create.php` | ○ | 전시 등록 — `payload`(JSON) + `files[]` |
| GET | `/backend/api/exhibitions/list.php` | ○ | 전시 목록 — `page` · `size` · `keyword` · `use_yn` · `status` · `from` · `to` (전시기간 겹침) |
| GET | `/backend/api/exhibitions/detail.php` | ○ | 전시 1건 — `id` (작품 이미지 목록 포함) |
| POST | `/backend/api/exhibitions/update.php` | ○ | 전시 수정 — `id` + `payload` + `keep[]` + `files[]` |
| POST | `/backend/api/exhibitions/delete.php` | ○ | 전시 삭제 — `{ ids: [...] }` (작품 이미지 파일도 함께 삭제) |
| POST | `/backend/api/exhibitions/editor_image.php` | ○ | 에디터 이미지 1장 — `image` → `{ url }` |
| GET | `/backend/api/notices/list.php` | ○ | 공지 목록 — `page` · `size` · `keyword` · `from` · `to` (작성일) |
| GET | `/backend/api/notices/detail.php` | ○ | 공지 1건 — `id` (첨부 목록 포함) |
| POST | `/backend/api/notices/create.php` | ○ | 공지 등록 — `payload`(JSON) + `files[]` |
| POST | `/backend/api/notices/update.php` | ○ | 공지 수정 — `id` + `payload` + `keep[]` + `files[]` |
| POST | `/backend/api/notices/delete.php` | ○ | 공지 삭제 — `{ ids: [...] }` (첨부 파일도 함께 삭제) |

- 토큰은 `bin2hex(random_bytes(32))` (64자) 이며 `admin_token` 테이블에 저장됩니다.
- 유효 시간은 `config.php` 의 `admin_token_ttl` (기본 480분 = 8시간) 입니다.
- 비밀번호는 `password_hash()` / `password_verify()` (bcrypt) 를 사용합니다.
- 비밀번호 변경 시 해당 관리자의 토큰이 모두 폐기되어 재로그인이 필요합니다.

### 전시 등록 (`create.php`)

`payload` 는 아래 구조의 JSON 문자열입니다.

```json
{
  "title": "전시회명",
  "status": "current",
  "place": "제1전시장 (1F)",
  "artist": "작가명",
  "start_date": "2026-09-16",
  "end_date": "2026-09-21",
  "overview": "<p>전시개요</p>",
  "bio": "<p>약력</p>",
  "use_yn": "Y"
}
```

- `status` — `current`(현재전시) · `upcoming`(예정전시), 기본 `current`
  - 등록할 때는 현재전시 / 예정전시만 고릅니다. 지난전시는 자동입니다.
  - 목록·등록 요청 때마다 서버가 날짜 기준으로 분류를 다시 잡습니다.
    오늘 > 종료일 → `past`(지난전시) / 오늘 < 시작일 → `upcoming`(예정전시) / 그 외 → `current`(현재전시)
    (별도 크론 없이 동작 — 공개 조회 API 를 만들 때도 `exhibition_sync_statuses()` 를 먼저 호출하세요)
- `files[]` — 작품 이미지 (선택, 최대 8개 · 개당 10MB · 전체 80MB / jpg · png · gif · webp)
- 필수 항목: `title` · `place` · `artist` · `start_date` · `end_date`
- 본문(HTML) 에서 `script` · `on*` · `javascript:` 는 서버가 지웁니다.
- 첨부는 `uploads/exhibition/`, 에디터 이미지는 `uploads/exhibition/editor/` 에 저장됩니다.
- ⚠ 에디터에 올린 이미지는 등록을 취소해도 서버에 남습니다.

### 전시 수정 (`update.php`)

- `id` — 수정할 `ex_id`
- `payload` — `create.php` 와 같은 JSON
- `keep[]` — 남길 작품 이미지의 `ef_id`. **보내지 않으면 작품 이미지가 모두 삭제됩니다.**
- `files[]` — 새로 올린 작품 이미지 (남긴 이미지와 합쳐 8개 · 전체 80MB 까지)

### 공지 (`create.php` · `update.php`)

그누보드4 레거시 테이블에 그대로 저장합니다.

| 화면 | 컬럼 |
|---|---|
| 제목 | `wr_subject` |
| 내용 | `wr_content` (HTML, `wr_option='html1'`) |
| 링크 #1 · #2 | `wr_link1` · `wr_link2` |
| 작성자 | `wr_name` · `mb_id` (로그인한 관리자) |
| 작성일 | `wr_datetime` · `wr_last` |
| 첨부 | `g4_board_file` (`bo_table='notice'`) |
| 실제 파일 | `/uploads/notice/` |

- `payload` 는 `{ title, content, link1, link2 }` JSON 이고 `files[]` 는 선택입니다.
- 구조가 궁금하면 `sql/notice_check.sql` (읽기 전용) 을 실행하세요.

## 요구 사항

- PHP 7.4 이상 (8.x 권장), `pdo_mysql` 확장
- MySQL 5.7 이상 / MariaDB 10.2 이상

## 로컬 개발 참고

로컬에는 PHP / MySQL 이 없습니다. 대신 **이미 배포된 서버 API 를 직접 호출**해서 관리자 화면을 확인합니다.

```
apps/.env                     VITE_API_BASE=/backend
                              → 운영 빌드용. 같은 도메인 상대 경로 (CORS 불필요)

apps/.env.development.local   VITE_API_BASE=https://galleryiscom.mycafe24.com/backend
                              → vite dev 에서만 로드. .gitignore 의 *.local 로 커밋 제외
```

- `.env.development.local` 은 `npm run dev` 에서만 적용되므로 `npm run build` 결과물에는 `/backend` 가 들어갑니다.
- 브라우저가 원격 API 를 직접 호출하므로 **서버가 CORS 를 허용**해야 합니다.
  `lib/cors.php` 가 `localhost` / `127.0.0.1` 을 포트와 무관하게 허용합니다.
  다른 도메인을 추가하려면 `config.php` 의 `allowed_origins` 에 넣으세요.
- **환경변수를 바꾼 뒤에는 dev 서버를 재시작**해야 반영됩니다.

## 최초 배포 순서 (중요)

1. 서버의 `backend/config.php` 에 DB 접속 정보 입력
   → 로컬 `config.php` 를 채우고 저장하면 자동 업로드됩니다.
   (SFTP `ignore` 에 넣으면 **수동 `SFTP: Upload` 까지 차단**되므로 넣지 않았습니다.)
   ⚠ 로컬 `config.php` 가 곧 서버 값입니다. 값을 지우거나 placeholder 로 되돌리면
     서버 접속 정보가 덮어써져 사이트가 중단됩니다.
2. `https://<도메인>/backend/setup.php` 실행 → 테이블 + `admin` / `is0521` 생성
3. 서버에서 `setup.php` 삭제
4. 로컬 `npm run dev` → `http://localhost:1212/admin/login` 에서 로그인 확인
