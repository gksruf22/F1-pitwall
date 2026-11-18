# F1 PITWALL – F1 통합 정보 웹사이트

웹프로그래밍 수업 텀프로젝트 (1인 개발, 조한결). Formula 1 정보를 한 곳에서 통합 제공하는 웹 플랫폼.
GitHub: https://github.com/gksruf22/F1-pitwall

> 이 문서(`PLAN.md`)가 프로젝트의 단일 기준 문서다. 기능이 추가·변경·삭제되면 이 문서를 같은 작업 안에서
> 고친다. 디자인(팔레트·타이포·Figma)은 `DESIGN.md`. 이전 버전은 `docs/archive/`에 있다.
> **v3 — 2026-11-15 처음부터 다시 기획** (제출 계획서 PDF + 참고 사이트 기능 확인 기준)

## 1. 목표와 원칙

제출 계획서의 5개 영역(정보·실시간·분석·AI·참여)을 **하나의 정규화 데이터**로 묶는 것이 목표다.

1. **세션(session)이 데이터의 중심 단위다.** 한 그랑프리는 레이스(R)·예선(Q)·스프린트(S)·스프린트 예선(SQ)
   세션으로 나뉘고, 결과·랩·피트·스틴트·이벤트가 모두 `session_id`를 가리킨다. 일관성·헤드투헤드·라이브·
   리플레이·AI가 전부 이 같은 테이블을 읽는다. 기능마다 데이터를 따로 가져오지 않는다.
2. 화면은 외부 F1 API를 **직접 호출하지 않는다.** 항상 자체 Express API만 호출한다.
3. 수업 기본 기술은 HTML/CSS/JS, 활용 기술은 DOM/WebAPI/Cloud/Server/AI다. 이를 직접 구현해 보이는 것이
   목적이므로 **프런트엔드 프레임워크, CSS 프레임워크, 차트 라이브러리를 쓰지 않는다**(차트는 SVG/Canvas).
4. 핵심 기능은 실제 데이터로 구현한다. 라이브는 **과거 레이스 시뮬레이션 모드**이고 화면에 그렇게 표시한다.
5. 백엔드는 **Node.js + Express**, DB는 **Supabase Postgres**(DB 전용), 인증은 **JWT 직접 구현**, 데이터
   수집은 **OpenF1 + Jolpica를 Node 스크립트로** 한다. 언어를 JS 하나로 통일한다.
6. 계획서에 적은 영역 밖의 기능은 추가하지 않는다. 바꿀 필요가 있으면 먼저 알린다.
7. 참고 사이트(app.formula1dashboard.com)는 **기능 아이디어만** 참고한다. 화면·문구·코드는 따르지 않는다.

## 2. 일정 (11.15 기준 — 구현 시작 전)

- 구현 가능 기간: **11.16 ~ 12.14 (4주) + 12.15 제출일**. 주차별 진행보고서(`docs/weekly/`)를 매주 제출.
- 평가: 프로젝트 40%, 출석 10%. (중간평가 50%는 시험이었고 이 프로젝트와 무관 — 확인 완료)
- 제출한 계획서(PDF)는 Spring으로 적었지만, 수업에서 배운 기술이 JavaScript라 **전부 JS로 통일**했다
  (11.15 변경). 완료보고서에는 이 변경과 이유를 명시한다.

## 3. 범위와 우선순위 등급

일정이 밀리면 아래 등급의 **뒤쪽부터** 자른다. 앞 등급이 끝나기 전에 뒤 등급을 시작하지 않는다.

| 등급 | 내용 | 데이터 |
|---|---|---|
| **1 기반 정보** | 헤더 공통(내비·검색·시즌 선택기·테마), 통합 대시보드, 일정(KST), 그랑프리 결과, 드라이버·컨스트럭터 순위(리더 대비 격차·순위 변동), 포인트 추이 차트, 드라이버·팀·서킷 프로필, 시즌 아카이브 | Jolpica |
| **2 시즌 전체 데이터 분석** | Driver Stats, 일관성(순위 분포), 헤드투헤드(예선·레이스 승수 + **팀메이트 예선 Q1/Q2/Q3 격차·팀 폴 격차**), **레이스 페이스(클린랩·107%·갭·포지션 변화)**, 하이라이트 피드, 뉴스, 통합 검색 | Jolpica(결과·예선 시간·**랩별 랩타임/포지션**) + RSS |
| **3 수집 레이스 기반** | 라이브 타이밍(SSE 시뮬레이션), 리플레이(Canvas), 스틴트·전략, 스피드트랩, 피트스톱 **정지 시간** 통계, 스프린트 예선 순위 | OpenF1 (레이스 3건만 사전 수집) + Jolpica 피트레인 시간 |
| **4 AI·참여** | AI 어시스턴트·리포트·하이라이트 문장, 로그인, Fantasy F1, 게시판, 즐겨찾기, 앱 내 알림 | 위 전부 + Gemini API |
| **5 조건부** | Track DNA(특성 점수·코너 비율·턴 수·랩 길이는 두 API 모두 없음 → 직접 정리 필요), 언더컷/오버컷 | 직접 정리한 `data/circuits.json` |
| **공통(마지막)** | 업데이트 내역, 반응형·로딩/오류 점검 | — |

**범위 제외:** 충돌 피해 비용·파워유닛 사용 현황·기술 업데이트(무료 API에 없음), 팀 라디오, 관리자 UI,
Web Push·PWA·이미지 업로드, 다국어(한국어 단일), 공식 포인트 제도(DHL 랭킹) 등.

## 4. 데이터 모델 (Postgres)

```
season(year)
circuit(id, name, country, lat, lon, length_km null, turns null, track_path jsonb null)   -- 길이·턴 수는 Jolpica에 없음(직접 정리), 트랙 경로는 OpenF1 위치로 생성
team(id, name, color)            driver(id, code, name, nationality, birth)
entry(season, driver_id, team_id, number)                                  -- 시즌별 소속
race(id, season, round, name, circuit_id)
session(id, race_id, type[R|Q|S|SQ], start_utc, openf1_key null)           -- 수집 여부 = openf1_key 유무
result(session_id, driver_id, team_id, grid, position, points, status, fastest_lap_ms null, fastest_rank null, q1_ms null, q2_ms null, q3_ms null)  -- Q 세션 행은 q1~q3 사용
lap(session_id, driver_id, lap, time_ms, position, s1 null, s2 null, s3 null, st_speed null, pit_out null)  -- time_ms·position은 Jolpica(시즌 전체), 나머지는 OpenF1(수집 3건)
pit_stop(session_id, driver_id, lap, lane_ms, stop_ms null)                -- lane_ms는 Jolpica(전체, 피트레인 통과 시간), stop_ms는 OpenF1(수집 3건, 정지 시간)
stint(session_id, driver_id, no, lap_from, lap_to, compound)               -- OpenF1, 수집 3건만
replay_event(session_id, seq, ts, lap, type, driver, data jsonb)           -- 공통 이벤트 모델
news(id, source, title, url, published_utc)
app_user(id, email, nickname, pw_hash)    favorite(user_id, kind, ref_id)
fantasy_prediction(user_id, race_id, p1, p2, p3, score null, exact null, updated_utc)  -- unique(user_id, race_id)
post(id, user_id, title, body, created_utc)   comment(id, post_id, user_id, body, created_utc)
notification(id, user_id, kind, ref_key, text, read, created_utc)  -- unique(user_id, kind, ref_key)
ai_usage(key, day, count)    ai_cache(key pk, text, created_utc)   -- 리포트·하이라이트 문장 캐시
```

- **순위(standings)·변동·격차·일관성·Driver Stats·피트 통계·하이라이트는 저장하지 않고 `result`/`lap`/
  `pit_stop`에서 SQL로 계산**하고 메모리 캐시(`Map`+TTL)에 둔다(중복 테이블 금지).
- **위치 샘플(리플레이용 x,y)은 DB가 아니라 `data/replay/{sessionId}.json` 파일**로 두고 정적으로 내려준다
  (크고, 통째로 읽기만 하므로 가장 단순). 대신 이벤트·순위 스냅샷은 DB.
- 시간은 UTC로 저장하고 화면에서 `Intl`로 KST 변환한다.

### 공통 이벤트 모델

```
replay_event: { session_id, seq, ts, lap, type, driver, data }
type: GREEN_FLAG | SAFETY_CAR | RED_FLAG | PIT_IN | PIT_OUT | FASTEST_LAP | POSITION_CHANGE
// SAFETY_CAR의 data.kind = "SC" | "VSC", data.state = "DEPLOYED" | "ENDING"
```

수집 데이터(`lap`·`pit_stop`·레이스 컨트롤)에서 `ingest`가 한 번 생성해 저장하고, 라이브(SSE로 시간순
송출)·리플레이(전체를 한 번에 받아 클라이언트 재생)·AI(근거 데이터)가 같은 이벤트를 쓴다.

## 5. 데이터 소스와 수집

- **Jolpica F1** (확인 결과: `docs/data-gate.md`) — 일정(**세션 시작 시각 포함**)·결과·예선 Q1/Q2/Q3 시간·스프린트 결과·**랩별
  랩타임/포지션**·피트스톱(피트레인 통과 시간)·순위(1950~현재). 한 번에 100행까지라 `ingest`가 페이지를 넘기며 받는다(레이스 1건의
  랩 ≈ 11페이지). 현재 시즌 전체(23라운드, 약 350회 호출)를 **1~2시간에 나눠** 받고, 받은 원본은 `data/raw/`에 캐시해
  **중단 후 이어서 받기**가 되게 한다. 화면은 DB만 본다. 아카이브 시연용으로 이전 시즌은 결과·순위만 소수 적재.
- **OpenF1** — 2026 완료 세션도 무료 조회(실시간은 유료라 쓰지 않음), 초당 3회·분당 30회 제한 → throttle·재시도. **위치 데이터가 있는 2026 레이스 전부**
  수집한다(11.17 확대, 처음에는 실버스톤 11326 · 몬자 11361 · 멕시코시티 11404 3건; 모나코·사키르·제다는 위치가
  없어 제외). 수집 항목: 스틴트·랩(스피드트랩 `st_speed`·섹터)·`pit`(정지 시간 `stop_duration`)·레이스 컨트롤(SC·VSC·플래그)·
  순위 변경·위치(2초 간격으로 축소)·스프린트 예선 `session_result`. 수집하지 않은 레이스는 화면에서 "데이터 없음".
- **뉴스** — 공개 RSS를 서버가 일 1회 가져온다(스크래핑 아님).
- 엔드포인트·필드는 구현 전에 **실제 호출로 확인**한다(추측 금지).
- Render 무료 서버는 유휴 시 꺼진다. 데이터는 Supabase에 있어 유지되고, 발표 전에 미리 접속해 깨운다.

### 확인 게이트 — **완료 (2026-11-15)**, 결과는 `docs/data-gate.md`, 재실행은 `npm run gate`
| 항목 | 결과 |
|---|---|
| 예선 랩(팀메이트 격차·팀 폴 격차) | **가능** — Jolpica 예선 결과에 Q1/Q2/Q3 시간이 있어 시즌 전체 계산(OpenF1 불필요). 스프린트 예선은 Jolpica 미지원 → OpenF1 `session_result` |
| 스피드트랩 | **가능** — OpenF1 `laps.st_speed` (수집 3건) |
| 레이스 페이스·포지션 변화·선두 대비 갭 | **시즌 전체 가능** — Jolpica `laps`(랩별 시간·포지션), 갭은 누적합으로 계산 |
| 피트스톱 | Jolpica = **피트레인 통과 시간**(전체), OpenF1 = **정지 시간**(수집 3건). 화면에 어느 값인지 표기 |
| 코너 속도·턴 수·랩 길이·특성 점수(Track DNA) | **두 API 모두 없음** → 직접 정리(5등급) |
| 루키 판별 | **가능** — Jolpica `/drivers/{id}/seasons`(첫 시즌 == 선택 시즌). 데이터 특이점은 구현 때 재확인 |
| 적기(RED) | 2026 레이스에 **0건** — 이벤트 모델에는 두되 시연 데이터에는 없음 |
| 세이프티카 | OpenF1 `SafetyCar` 카테고리(`SAFETY CAR`·`VSC DEPLOYED`·`VSC ENDING`). 없으면 404 |
| 위치(리플레이) | 세션마다 있을 수도 없을 수도 있음 → 시연 3건을 위치 있는 레이스로 확정 |

## 6. API (모두 JSON, 오류는 `{ error: { code, message } }`)

| 구분 | 엔드포인트 | 용도 |
|---|---|---|
| 정보 | `GET /api/seasons`, `/api/races?season=`, `/api/races/next`, `/api/races/:id/results?session=` | 일정·결과 |
| | `GET /api/standings/drivers\|constructors?season=&round=` | 순위(+격차·변동) |
| | `GET /api/drivers`, `/api/drivers/:id`, `/api/teams/:id`, `/api/circuits/:id` | 프로필 |
| | `GET /api/summary`, `/api/highlights?filter=`, `/api/news`, `/api/search?q=` | 대시보드·검색 |
| 분석 | `GET /api/analysis/consistency?season=&excludeDnf=` | 순위 분포 |
| | `GET /api/analysis/h2h?a=&b=&season=` , `/api/analysis/driver-stats/:id?season=` | 비교·스탯 |
| | `GET /api/races/:id/strategy`, `/pace?clean=&cutoff=`, `GET /api/pitstops?season=` | 수집 레이스 분석 |
| | `GET /api/circuits/dna` | Track DNA (게이트 후) |
| 실시간 | `GET /api/races/:id/stream?speed=` (SSE), `/api/races/:id/events`, `/data/replay/:id.json` | 라이브·리플레이 |
| AI | `POST /api/ai/chat`, `POST /api/ai/report` | 서버에서만 LLM 호출 |
| 참여 | `/api/auth/*`, `/api/fantasy/*`, `/api/posts/*`, `/api/favorites`, `/api/notifications` | JWT 필요 |

## 7. 페이지 (경로는 멀티페이지 HTML, 섹션별 폴더)

| # | 페이지 | 경로 | 등급 | 주요 구성 |
|---|---|---|---|---|
| 1 | 통합 대시보드 | `/` | 1·2 | 히어로(다음 GP 카운트다운·1위 드라이버/팀), 직전 포디움, 요약 카드(시즌 진행률·챔피언십 격차·최단 피트), 순위 Top 5, 하이라이트 피드(전체/팀/드라이버/루키/레이스/트랙), 라이브 상태, 뉴스, 즐겨찾기 요약 |
| 2 | 일정·결과·순위 | `/schedule` | 1 | 캘린더(KST·세션별 시간), 결과표(예선·결선·스프린트, 패스티스트랩), 순위표(격차·변동), 포인트 추이 차트, 시즌 아카이브, Fantasy 예측 진입 |
| 3 | 드라이버·팀·서킷 | `/drivers` `/teams` `/circuits` | 1·2 | 프로필, **Driver Stats 탭**, 서킷 트랙맵(SVG), Track DNA 탭(5등급) |
| 4 | 드라이버 비교 | `/drivers/compare?a=&b=` | 2 | 인기 비교 프리셋, 예선·레이스 H2H 승수, 팀메이트 Q1/Q2/Q3 격차 점 차트·팀 폴 격차(Jolpica 예선 시간, 시즌 전체) |
| 5 | 뉴스·검색 | `/news` `/search` | 2 | 뉴스 목록, 유형별 통합 검색 |
| 6 | 라이브 타이밍 | `/live/:raceId` | 3 | SSE 순위표(간격·랩타임·타이어), 이벤트 피드/토스트, 세션 상태, 드라이버 상세, AI 질문 박스, "Simulated Replay" 표기 |
| 7 | 리플레이 | `/replay/:raceId` | 3 | Canvas 트랙맵, 재생·배속, 랩 슬라이더, 드라이버 추적, 이벤트 타임라인 |
| 8 | 전략·분석 | `/strategy/:raceId` | 2·3 | 탭: 스틴트·전략 / 레이스 페이스(클린랩·107% 토글, 선두 대비 갭, 최속랩 Top 20) / 피트스톱 통계 / **일관성(시즌 단위)** |
| 9 | AI 어시스턴트 | `/ai` | 4 | 채팅, 추천 질문, 근거 데이터 패널, "AI 생성 내용" 표시, 레이스 요약 리포트 |
| 10 | 커뮤니티 | `/community` | 4 | 탭: Fantasy 랭킹/게시판/즐겨찾기/알림 + 로그인 |
| 11 | 업데이트 내역 | `/changelog` | 공통 | 푸터 링크, 정적 목록 |

- **레이스 서브내비:** 결과·라이브·리플레이·전략 페이지는 같은 `raceId`를 쓰므로 공통 컴포넌트(레이스 탭 바)로
  서로 이동한다 — 레이스 한 건을 중심으로 기능이 이어지는 "통합" 경험.
- 3·4번을 합쳐 쓰지 않은 이유: 드라이버 비교는 두 사람을 고르는 별도 화면이라 목록/상세와 구조가 다르다.
- 헤더 공통: 시즌 선택기(`localStorage`), 통합 검색, 테마 토글, 알림 종. 하단: "비공식 팬 프로젝트" 표기.

## 7-1. 분석 화면 구성 (참고 사이트를 브라우저로 직접 보고 정리, 11.15)

화면 배치·문구는 따라 하지 않고 **어떤 차트로 무엇을 보여주는지**만 가져온다. 차트는 전부 SVG/Canvas 직접 구현이므로
아래 차트 종류를 **공통 차트 모듈**(축·스케일·툴팁 공유)로 먼저 만들고 페이지마다 재사용한다.

| 페이지 | 구성 요소 | 필요한 차트 종류 |
|---|---|---|
| 레이스 페이스 | 필터 바(클린랩 토글·이상치 컷오프 슬라이더 107%), 최속 랩 Top 20 표(보라 강조), Race Pace Evolution(랩별 선, 하이라이트 끔/개인 최고/최속), **Race Pace(드라이버별 박스플롯, 중앙값 순 정렬)**, **Lap Times(드라이버별 점 분포 — 스웜)**, Position Evolution(순위 선, 끝에 이름), Gap to Leader(선), 스피드트랩 Top 15(드라이버×순위 히트맵 표) | 선, 박스플롯, 스웜, 히트맵 표 |
| 헤드투헤드 | 팀·드라이버 2명 선택, 인기 비교 카드(프리셋), **Qualifying H2H / Race H2H**(탭: 합산·단일·스프린트, 두 사람 승수를 가로 막대로 비교, 대체 드라이버 별도 줄), **팀메이트 예선 격차**(팀별 한 줄 점 스트립, 0 기준 좌우, Q1/Q2/Q3 점, "최근 예선 강조" 토글), 팀 폴 대비 격차 | 비교 막대, 점 스트립 |
| 일관성 | 시즌 선택 + DNF 제외 토글, **박스플롯 4개**(레이스·스프린트 결승 순위, 예선·스프린트 예선 순위), 포인트권(P10/P8)·Q3/Q2 컷오프 점선 | 박스플롯(공통) |
| 피트스톱 | 카드 6개, 최단 Top 20 표, 팀별 일관성(박스플롯), 그랑프리별 평균(팀 선, 팀 분해 토글), 드라이버별·컨스트럭터별 평균(가로 막대) | 박스플롯, 선, 가로 막대 |
| Driver Stats | 헤더(이름·팀·순위·포인트), 요약 4칸(2위와 격차·팀 비중·팀메이트와 격차·평균 비교), 카드 4개(우승·포디움·포인트·폴 — 각 카드에 **라운드별 미니 막대**, 범례 레이스/스프린트/DNF/예정), 포인트권 피니시 도넛, 결승 순위 분포(가로 막대), 전년 대비 포인트 추이(선 2개), 레이스별 선두 랩(막대) | 미니 막대, 도넛, 가로 막대, 선 |
| Track DNA | **서킷 특성 히트맵(7개 항목 1~5점: Traction·Asphalt Grip·Abrasion·Track Evolution·Tyre Stress·Braking·Lateral Load)**, 유사도 버블맵, 턴 수·레이스 거리·랩 길이 가로 막대 3개 | 히트맵, 버블, 가로 막대 |
| (선택) 그리드→결승 | Driver Stats의 그리드→결승 흐름(Sankey) | **Sankey — 구현 비용 커서 생략 후보** |

**공통 차트 모듈 목록(2주차 초반에 만든다):** 선(다중 시리즈·하이라이트), 가로/세로 막대, 박스플롯, 스웜/점 스트립, 도넛,
히트맵, 버블. 이 7종이 위 화면 대부분을 덮는다. Sankey·방사형 게이지는 만들지 않는다.

**데이터 주의:**
- **Track DNA의 특성 점수(1~5)와 코너 고속/저속 비율은 무료 API에 없다.** 참고 사이트가 직접 정리한 값으로 보이므로
  우리도 수집 레이스 서킷에 한해 `data/circuits.json`을 **직접 정리**하거나, 못 구하면 턴 수·랩 길이·레이스 거리
  막대 3개만 제공한다(확인 게이트 항목 2). 점수를 지어내지 않는다 — 출처를 알 수 없는 수치는 넣지 않는다.
- 스피드트랩 히트맵은 OpenF1 `laps.st_speed`(수집 3건)로 만든다. 레이스 페이스·포지션 변화·선두 대비 갭은 Jolpica `laps`로 **시즌 전체 레이스**에서 가능하다.
- 팀메이트 예선 격차·Q1/Q2/Q3 비교는 Jolpica 예선 결과의 Q1/Q2/Q3 시간으로 시즌 전체 계산한다(스프린트 예선만 OpenF1 `session_result`, 수집 시 한정).
- 피트스톱: Jolpica는 **피트레인 통과 시간**, OpenF1은 **정지 시간**이다. 화면 카드·차트에 어느 값인지 반드시 표기한다.
- 대체 드라이버(시즌 중 교체)는 H2H에서 별도 줄로 다루므로 `entry`에 시즌 중 교체를 기록할 수 있어야 한다.

## 8. AI

- **Gemini API**(11.18 Claude에서 변경)를 서버에서 REST `fetch`로 호출(SDK 없음). **Function Calling**으로 자체 쿼리 함수
  (`get_race_results`, `get_standings`, `get_driver_laps`, `get_pit_stops`)를 호출해 DB 데이터로 답하고,
  답변에 **근거 데이터를 함께 표시**한다. "AI 생성 내용" 문구, 호출 횟수·입력 길이 제한(`ai_usage`).
- **벡터 RAG(임베딩 검색)는 쓰지 않는다.** 데이터가 결과·랩타임·피트스톱 같은 숫자 표라 유사도 검색으로는
  정확한 값을 보장할 수 없고, SQL 조회가 정확하다. 함수 호출로 DB를 조회해 답을 보강하는 방식이 이 프로젝트의
  검색 증강이다(완료보고서에 이유 명시). 모델 이름·요청/응답 형식·무료 한도는 구현 전에 실제 호출로 확인한다.
- **실제 호출 확인(11.18):** `POST /v1beta/models/{model}:generateContent`, 헤더 `x-goog-api-key`,
  `tools[].functionDeclarations`. 응답 `parts`에 `functionCall{name,args,id}`와 `thoughtSignature`가 오며, 다음 요청에
  이 part를 **그대로** 되돌려 보내고 `functionResponse`를 붙여야 한다. 무료 키로 `gemini-flash-lite-latest`는 정상(약 4.6초),
  `gemini-flash-latest`·`gemini-3.8-flash`는 그 시각 503(수요 과다), `gemini-2.5-flash`는 신규 사용자 404 →
  기본 `AI_MODEL=gemini-flash-lite-latest`, 503이면 1회 재시도 후 "잠시 후 다시" 오류로 응답.
- 무료 등급은 입력이 서비스 개선에 쓰일 수 있으므로 **사용자 게시글·댓글은 AI에 보내지 않는다.**
- **하이라이트:** 서버가 규칙으로 사실(폴투윈, 연속 포디움, 그리드 대비 최다 상승, 팀 1-2 등)을 먼저 만들고
  AI는 문장만 다듬는다. **숫자는 AI가 만들지 않는다.**
- 레이스 요약 리포트는 `result`+`replay_event`를 근거로 생성한다.

## 8-1. 세부 규칙 (Fantasy · 알림 · 하이라이트 · AI 한도)

아래는 **제안값**이다. 구현 전에 바꾸고 싶으면 이 표만 고치면 된다. 숫자는 전부 환경 설정(`server/config.js`) 한 곳에 둔다.

### Fantasy F1 (포디움 예측)
- **예측:** 레이스당 1인 1건, 1~3위 드라이버 3명을 선택(중복 불가). 마감 전에는 **덮어쓰기 가능**(`unique(user_id, race_id)` upsert).
- **마감:** 그 그랑프리의 **예선(Q) 세션 시작 시각**(`session.start_utc`). 마감 후에는 서버가 거절한다(클라이언트 시간 신뢰 안 함).
- **채점 (최대 12점):** 자리까지 맞힌 드라이버 +3점(최대 9), 포디움에는 들었지만 자리가 틀리면 +1점, 3명 모두 자리까지
  맞히면 보너스 +3. 예) 1·2·3위 중 2명 정확 + 1명 포디움 다른 자리 = 3+3+1 = 7점.
- **채점 시점:** 그 레이스의 결선(R) `result`가 DB에 들어오면 `fantasyScoringJob`이 아직 `score`가 비어 있는 예측만 채점한다
  (이미 채점된 건 건드리지 않아 여러 번 실행해도 안전). 취소·몰수 등으로 결과가 바뀌면 다시 계산하지 않는다(범위 밖).
- **랭킹:** 시즌 점수 합계 내림차순, 동점이면 `exact`(자리까지 맞힌 개수 합) 많은 사람, 그래도 같으면 같은 순위.
  **예측 정확도** = 자리까지 맞힌 개수 합 ÷ (제출 수 × 3).
- **시연 한계:** 진짜 "다음 레이스" 결과는 발표 시점에 나오지 않을 수 있으므로, 시연용 **시드 스크립트**가 과거 레이스에 대한
  샘플 사용자·예측을 넣어 채점·랭킹 화면을 보여 준다(시드 데이터임을 화면에 표시하지 않아도 되지만 보고서에는 명시).

### 이벤트 알림 (앱 내, 폴링 — 클라이언트가 30초마다 `GET /api/notifications` 조회)
알림은 **새 결과가 DB에 들어온 뒤** 서버 작업이 만든다. 같은 사건에 중복 알림이 생기지 않도록 `unique(user_id, kind, ref_key)`를 쓴다.

| kind | 조건 (대상) | ref_key | 문구 예 |
|---|---|---|---|
| `FAV_RESULT` | 즐겨찾기 드라이버/팀이 결선에서 완주·득점·포디움·우승 | `race:{id}:driver:{id}` | "○○ 드라이버가 ○○ GP에서 3위로 포디움" |
| `FAV_POLE` | 즐겨찾기 드라이버가 예선 1위 | `race:{id}:pole` | "○○ 폴 포지션 획득" |
| `RACE_SOON` | 다음 GP 시작 24시간 전(로그인 사용자 전체) | `race:{id}:d1` | "내일 ○○ GP가 시작합니다" |
| `FANTASY_SCORED` | 내 예측이 채점됨 | `race:{id}:fantasy` | "예측 점수 7점 (자리 2개 적중)" |
| `POST_COMMENT` | 내 게시글에 다른 사람이 댓글 | `comment:{id}` | "내 글에 새 댓글이 달렸어요" |

- **실행 방식:** 서버가 켜져 있을 때 10분 간격 + **시작 시 1회** + 결과 수집(`ingest`) 직후에 실행한다. Render 무료 서버는 유휴 시 꺼질 수
  있어 작업이 놓칠 수 있으므로, 작업은 항상 "아직 안 만든 알림만" 만드는 방식(멱등)으로 짠다.
- 읽음 처리는 `POST /api/notifications/:id/read`, 헤더 종에 안 읽은 개수 배지.

### 하이라이트 규칙 (`HighlightService`, `result`에서 계산)
항목 = `{ id, tags[], race_id, priority, facts{수치}, text }`. `text`는 **서버 템플릿 문장**이고 AI는 선택적으로 다듬는다(수치는 `facts`에서만).
정렬은 최신 라운드 우선, 같은 라운드면 `priority`. 피드는 최신 10건 + 필터 칩(태그).

| id | 규칙 | 태그 | 비고 |
|---|---|---|---|
| `WIN_N` | 드라이버의 시즌 N번째 우승 | 드라이버 | |
| `PODIUM_STREAK` | 연속 포디움 3회 이상 | 드라이버 | 현재 연속 횟수 |
| `POLE_TO_WIN` | 폴 포지션에서 출발해 우승 | 드라이버, 레이스 | 예선·결선 결과 |
| `BIGGEST_GAIN` | 그리드 대비 순위 상승이 그 레이스 최대(5계단 이상) | 드라이버, 레이스 | |
| `TEAM_ONE_TWO` | 한 팀이 1·2위 | 팀, 레이스 | |
| `TEAM_DOUBLE_POINTS_STREAK` | 한 팀 두 드라이버 모두 득점 연속 3레이스 이상 | 팀 | |
| `DNF_HEAVY` | 리타이어 5대 이상 | 레이스 | `status`가 완주가 아닌 수 |
| `SAME_WINNER_AT_TRACK` | 같은 서킷 2년 연속 같은 우승자 | 트랙, 드라이버 | 이전 시즌이 DB에 있을 때만 |
| `ROOKIE_BEST` | 루키의 개인 최고 성적 갱신 | 루키, 드라이버 | **루키 판별은 확인 게이트에서 가능 여부 확인 — 안 되면 "루키" 필터와 이 규칙을 뺀다** |

- 각 규칙은 **수집·적재된 시즌 범위 안에서만** 계산하고, 화면에 "수집 범위 기준"을 작게 표기한다.
- AI 다듬기는 항목당 1회, 결과를 `ai_cache`에 저장해 재호출하지 않는다. AI가 실패하거나 한도를 넘으면 템플릿 문장을 그대로 쓴다.

### AI 호출 한도·안전장치
| 항목 | 값 |
|---|---|
| 챗 한도 | 로그인 30회/일, 비로그인 IP당 5회/일 (`ai_usage`) |
| 리포트 한도 | 레이스당 **1회만 생성 후 `ai_cache` 재사용**, 새로 생성은 로그인 사용자 5회/일 |
| 전체 안전 상한 | 서버 전체 하루 200회 초과 시 "오늘 한도 초과" 응답(비용 보호) |
| 입력 길이 | 질문 500자, 대화 이력은 최근 6턴만 전송 |
| 출력·루프 | 출력 토큰 800, 함수 호출 반복 최대 4회, 도구 1회당 반환 행 최대 50 |
| 모델 | `.env`의 `AI_MODEL`로 지정(기본은 가벼운 모델, 리포트만 더 큰 모델로 바꿀 수 있게) |
| 도구 | **읽기 전용 조회 함수만**(쓰기 도구 없음). 도구에서 데이터가 없으면 답변은 "데이터 없음"으로 응답하게 시스템 프롬프트에 명시 |
| 근거 표시 | 응답과 함께 호출된 도구 이름·인자·반환 요약을 내려주어 화면의 "근거 데이터" 패널에 표시 |
| 입력 취급 | 사용자 질문과 DB 값은 신뢰하지 않는 데이터로 취급(시스템 프롬프트와 분리), 키·내부 정보는 응답에 포함하지 않음 |

## 9. 개발 단계 (11.16 ~ 12.14)

원칙: 항상 **데이터 → API → 화면** 순서, 한 번에 한 기능, 끝나면 실행해 확인. 주 끝에 `docs/weekly/` 기록.

### 1주차 (11.16~11.22) — 기반 + 1등급
- [x] `.gitignore`, `package.json`(ES 모듈) (11.15)
- [x] 의존성 설치(`express` 5, `pg`, `dotenv` — 승인 완료), Express 뼈대(`server/index.js`, `/api/health`, 정적 `client/`, 오류 형식), `.env.example` (11.15). 실행: `npm run dev`
- [x] **확인 게이트**(§5) → 문서 갱신 (11.15 완료)
- [x] Supabase 생성·연결(11.16), `db/schema.sql`(season~result) 적용 — `npm run db:schema`. 접속은 Transaction pooler(6543): 개발 네트워크에서 5432가 막혀 있음(일반 SQL만 쓰므로 문제 없음)
- [x] `ingest`(Jolpica 일정·세션 시각·결과·예선 기록, throttle·재시도·`data/raw` 원본 캐시·이어받기) — `npm run collect -- --year 2026 [--round N] [--refresh]`. 2026은 20라운드 결과 수집(21~23은 미개최). 순위는 저장 안 함(result에서 계산). DB가 시드니 리전(왕복 ~200ms)이라 행 단위 INSERT 대신 `unnest` 일괄 삽입(13분→74초)
- [x] 순위·격차·변동 계산 + 캐시, 정보 계열 API(`/api/seasons`·`races`·`races/next`·`races/:id/results`·`standings/*`·`summary`) — 순위는 `result`(R+S 포인트)를 합산해 계산(동률: 포인트→우승→이름), 직전 라운드 대비 변동·리더 격차·라운드별 누적 `history`(차트용) 포함. 메모리 `Map`+TTL(60초) 캐시. 프로필·`highlights`·`news`·`search`는 2주차 (11.16)
- [x] 공통 모듈(`client/js/`: `api`·`dom`·`ui`·`layout`·`format`·`teams`, `client/css/`: 토큰·기본 스타일) — API 클라이언트, 헤더·시즌 선택기·라이트/다크 테마, 카드·표·탭·스켈레톤·오류·빈 상태. 팀 컬러는 `team.color`가 채워지기 전까지 `teams.js`의 임시 색 (11.16)
- [x] 대시보드(히어로 캐러셀·직전 포디움·요약 카드 3개·순위 Top 5) + 일정·결과·순위 페이지 + 누적 포인트 선 차트(SVG, `chart-line.js`). 사진 자리는 그라디언트 플레이스홀더, 시안 미확인 부분은 `DESIGN.md` 기본값으로 구현 → 피드백 반영 대기 (11.16)
- [x] GitHub 초기 커밋·push, Render 배포(https://f1-pitwall-3tdu.onrender.com — 모든 API·화면 200, 응답 0.5~1.2초 확인 11.16). **콜드 스타트(15분 유휴 후) 시간은 시연 전 재측정** — `render.yaml`(Blueprint, Singapore 리전, `DATABASE_URL`은 대시보드에서 직접 입력·6543 주소) 작성 완료. Vercel은 SSE·주기 job·메모리 캐시가 서버리스와 맞지 않아 Render 유지로 결정 (11.16)

### 2주차 (11.23~11.29) — 2등급 + 수집 파이프라인
- [x] 팀 컬러 — `npm run collect:colors`(OpenF1 `team_colour` → `team.color`, 11팀). 화면은 DB 값 우선, 없으면 `teams.js` 예비 색 (11.16)
- [x] **공통 차트 모듈**(선·막대·박스플롯·점 스트립·도넛·히트맵·버블, §7-1) — `client/js/charts/`(`core.js` 눈금·스케일·툴팁 공유 + 6종)와 선 차트(`chart-line.js`). 샘플 데이터 미리보기: `/dev/charts.html` (11.16)
- [x] 드라이버·팀·서킷 프로필 — API(`/api/drivers`·`teams`·`circuits` 목록·상세)와 화면 6개(`drivers`·`driver`·`teams`·`team`·`circuits`·`circuit`). 드라이버 상세=시즌 결과표(예선·그리드·결승·스프린트·패스티스트랩), 팀 상세=라운드별 팀 포인트 막대+결과표, 서킷 상세=개최 레이스·우승자. 시즌 중 이적 드라이버는 최근 소속 팀 1건만 표시. 트랙 맵 SVG·커리어 하이라이트·즐겨찾기 토글은 해당 데이터·기능(3·4등급) 이후 (11.16)
- [x] Driver Stats(드라이버 상세 탭: 요약 4칸·카드 4개+미니 막대·포인트권 도넛·순위 분포·누적 포인트 추이·선두 랩), 일관성(`/consistency.html`, 박스플롯+컷오프, DNF 제외 토글; 스프린트 예선은 OpenF1 수집 후), 드라이버 비교(`/h2h.html`, 팀메이트 프리셋·예선/결승/스프린트 승수), 하이라이트 규칙(폴투윈·연승·연속 포디움·팀 1-2·최다 상승·선두 교체)+대시보드 피드. 필터 칩은 전체/레이스/드라이버/팀 — 루키·트랙 칩은 데이터가 부족해 제외. API `/api/analysis/*`, `/api/highlights` (11.16)
- [x] 뉴스(RSS 3곳: Motorsport.com·Autosport·BBC Sport — 제목·링크·날짜만 저장, 서버 시작 시+하루 1회 갱신, `npm run collect:news`)·통합 검색(`/api/search`, 헤더 검색창 → `/search.html`; 게시글은 게시판 구현 때 추가) (11.16)
- [x] 2025 시즌 결과 수집(`npm run collect -- --year 2025`, 24라운드·순위 검증: Norris 423/Verstappen 421/Piastri 410) → 시즌 선택기·전년 대비 추이 (11.16)
- [x] `ingest` 확장: 예선 시간·스프린트는 1주차 `ingest`에 포함, **랩·피트스톱**은 `npm run collect:laps -- --year 2026` (페이지 순회·캐시·이어받기, 429는 재시도). 랩 레코드 ≈ 레이스당 1000~1400행 (11.16)
- [x] `collect.js`(OpenF1) → 실버스톤·몬자·멕시코시티 3건: 스틴트·스피드트랩·정지 시간·레이스 컨트롤·위치 → `replay_event` 생성, 위치 파일
- [x] 대시보드 최단 피트스톱 카드 — 시즌 전체 **피트레인 통과 시간** 기준으로 표기(정지 시간은 수집 3건뿐이라 3주차 피트스톱 탭에서) (11.16)

### 3주차 (11.30~12.6) — 3등급
- [x] 레이스 페이스 탭 — `GET /api/races/:id/pace?clean=&cutoff=`(클린랩=1랩·인랩·아웃랩 제외+최속 랩 대비 cutoff% 초과 제외, 기본 107%), 화면 `/strategy.html?race=`(최속 랩 Top 20·Race Pace 박스플롯·Lap Times 스웜·Race Pace Evolution·Position Evolution·Gap to Leader). 패스티스트랩이 결과표와 일치함을 확인. 스피드트랩 히트맵은 수집 3건 탭에서. 선 차트(`chart-line.js`)는 format·auto·invert·결측 끊김 옵션으로 일반화 (11.17)
- [x] 피트스톱 통계 탭 — `GET /api/pitstops?season=`(시즌 단위; 통과 시간 `lane_ms`, 90초 초과·레이스 중앙값 1.5배 초과 제외, 팀·드라이버 비교는 서킷 영향을 줄이려 **레이스 중앙값 대비**), 화면 `/strategy.html?tab=pit`(카드 6·최단 Top 20·팀 박스플롯·그랑프리별 평균(범례로 팀 분해)·컨스트럭터/드라이버 평균 막대·정지 시간 표(수집 3건, OpenF1)). 경로는 계획의 `/races/:id/pitstops` 대신 시즌 단위 `/api/pitstops` (11.17)
- [x] 헤드투헤드 예선 격차 — `GET /api/analysis/qualifying-gap?season=`, 드라이버 비교 페이지(`/h2h.html`)에 **팀메이트 예선 격차**(팀별 점 스트립·0 기준선·Q1/Q2/Q3 색, 기준 드라이버=팀 최다 출전자, 둘 다 기록이 있는 마지막 단계 비교)와 **팀 폴 대비 격차**(Q3 진출 라운드 평균 막대) 추가. "최근 예선 강조" 토글은 아직 없음. 점 스트립은 점별 색·메모·`zero`, 막대·스트립은 `left` 옵션 추가 (11.17)
- [x] 라이브(SSE 시뮬레이션) — `GET /api/races/:id/stream?speed=1|10|30|60|120&start=`(1초마다 `tick`=순위표·세션 상태, `race-event`, `end`), 화면 `/live.html?race=`(순위표: 선두/앞 차 간격·직전/최고 랩(보라=전체 최고, 초록=개인 최고)·타이어·피트·그리드 대비 변동, 이벤트 피드, "시뮬레이션" 표기, 배속 선택). 시계 = FASTEST_LAP 이벤트 시각 − 누적 랩타임(드라이버 간 오차 없이 수렴), 순위 = 완료 랩 수·라인 통과 순서라 공식 결과와 레이스 후 페널티만큼 다름. 수집된 3개 레이스만(`/api/races`에 `collected` 필드). 드라이버 상세·AI 질문 박스는 4주차 (11.17)
- [x] 리플레이(Canvas) — `GET /api/races/:id/replay`(레이스 시작 오프셋·드라이버별 랩 통과 시각·이벤트; 라이브와 같은 타임라인 서비스), 위치 파일은 `/data/replay/:sessionId.json` 정적 서빙, 화면 `/replay.html?race=`(전 드라이버 궤적을 곡선으로 겹쳐 서킷 윤곽 생성, 2초 샘플 보간 재생, 1~60배속, 랩 슬라이더, 드라이버 추적(선택·순위 패널 클릭), 이벤트 타임라인(SC·레드·패스티스트 랩, 클릭 이동), 순위 패널). 윤곽은 라인 차이로 띠 두께가 일정하지 않음 (11.17)
- [x] 라이브 화면에 트랙맵 추가 — 트랙맵을 공용 모듈 `client/js/trackmap.js`로 분리해 리플레이·라이브가 공유. 라이브는 SSE `tick`의 시각 t에 맞춰 같은 위치 파일로 점을 그리고, 틱 사이는 배속만큼 보간 (11.17). 배속 변경은 새로고침 없이 현재 시각(`start`)부터 스트림만 재연결(URL은 `replaceState`), 끝난 뒤 바꾸면 처음부터 (11.17)
- [x] 스틴트·스피드트랩 탭(수집 3건) — `GET /api/races/:id/strategy`(스틴트·피트 정지 시간·스피드트랩 Top 15·랩별 순위 분포), 화면 `/strategy.html?tab=stint`(드라이버별 타이어 전략 막대(`charts/gantt.js`, 마우스 올리면 구간·피트 정지 시간)·컴파운드 요약·스피드트랩 Top 15·순위 분포 히트맵). 스피드트랩은 계획의 "페이스 탭" 대신 이 탭에 둠(수집 3건 한정이라). 타이어 색은 `client/js/tyre.js`로 라이브와 공유 (11.17)
- [~] **데이터 확대(11.17, 요청)** — 결과·예선·스프린트를 2026→2014 시즌까지 적재(2024 순위는 공식 기록과 일치 확인), 과거 팀 예비 색 추가. 남은 것: 2013~2010 결과, 2025~2010 랩·피트스톱은 Jolpica 시간당 한도(500회 안팎) 때문에 하루에 나눠 받는다 → `npm run collect:all`(끝난 일은 `data/collect-state.json`에 기록, 한도 429에 걸리면 멈추고 다음 실행에서 이어받음, `-- --status`로 확인). 2026 랩은 일괄 수집 대상 아님(`ingest-laps`가 `lap`·`pit_stop`을 지워 OpenF1 값이 사라짐). OpenF1은 위치 데이터가 있는 2026 레이스 전부(모나코 제외 19개)로 확대: `npm run collect:openf1`이 DB·OpenF1에서 레이스를 찾아 아직 안 받은 것만 순서대로 받고, **끝까지 받은 레이스만** `openf1_key`를 기록(화면의 라이브·리플레이·스틴트 탭은 이 값을 본다)
- [x] 레이스 서브내비 공통 컴포넌트 — `layout.js`의 `raceTabs(active, race)`: 결과·레이스 페이스·스틴트·스피드트랩·피트스톱·라이브·리플레이가 같은 `race`(와 `season`)를 유지한 채 이동. 스틴트·라이브·리플레이는 OpenF1 수집 레이스(`race.collected`)에만 표시. 결과 페이지의 임시 버튼과 전략 페이지의 자체 탭은 제거 (11.17)
- [x] 5등급 중 언더컷/오버컷(11.17) — `GET /api/undercut?season=`, `/undercut.html`(분석 탭). 랩 위치·누적시간·피트스톱으로 계산: 직전 랩 3초 이내 앞·뒤 차가 5랩 안에 이어 정지한 쌍을 정지 후 순서로 판정(언더컷/오버컷/방어). SC·적기 구간은 가려내지 않음(화면에 한계 표기). 랩·피트 데이터가 있는 시즌만 표시
- [ ] 5등급 중 Track DNA(직접 정리 데이터) — 일정이 남을 때만

### 4주차 (12.7~12.13) — 4등급
- [ ] 세부 규칙(§8-1) 구현: 채점·알림 job·하이라이트·AI 한도
- [x] **AI 어시스턴트(11.18)** — `server/services/gemini.js`(REST `fetch`, 함수 호출 최대 4회 반복 후 `mode: NONE`으로 답 강제, `thoughtSignature` 포함 응답을 그대로 되돌려 보냄, 5xx·연결 실패 1회 재시도, 출력 800토큰), `server/services/ai-tools.js`(읽기 전용 5개: 계획의 4개 + 레이스 이름→라운드를 찾는 `get_races`, 결과 최대 50행, 드라이버는 이름 일부·코드·id로 찾음), `POST /api/ai/chat`(질문 500자, 이력 최근 6턴, 로그인 30회·비로그인 IP 5회·전체 200회/일 — `ai_usage`, Render 프록시 때문에 `trust proxy 1`). 응답 `{ answer, evidence:[{name,args,result}], remaining }`. 화면 `/ai.html`(상단 내비 "AI", 예시 질문, "AI 생성 내용" 표시, 근거 데이터 펼치기(도구·인자·결과 표), Enter 전송). 확인: 2025 챔피언 점수 차·2026 영국 GP 해밀턴 피트 정지 시간이 DB 값과 일치, 수집 안 된 2025 피트스톱은 "데이터 없음", 프롬프트 탈취·관계없는 질문은 거절, 이력으로 이어 묻기 동작
- [x] **AI 레이스 요약 리포트(11.19)** — `server/services/ai-report.js`: 서버가 SQL로 근거(facts: Top 10·그리드·피트 횟수·폴·패스티스트 랩·리타이어·최다 상승·랩별 선두 교체·선두 랩 수·세이프티카)를 만들고 AI는 3문단 문장만 쓴다. 시간은 미리 문자열(1:23.504)로 넘긴다. **숫자 검증**(`unsupportedNumbers`): 답에 근거에 없는 숫자가 있으면 1회 다시 쓰게 하고 그래도 있으면 저장하지 않음. `GET /api/ai/report/:raceId`(근거+저장된 리포트, 누구나), `POST`(JWT, 레이스당 1번 생성 후 `ai_cache` 재사용, 새 생성은 사용자 5회/일+전체 한도). 계획의 `result`+`replay_event` 외에 `lap`(선두)·`pit_stop`도 근거로 씀. 화면: 결과 페이지 결승 탭 아래 카드("AI 생성 내용", 근거 데이터 펼치기, 비로그인은 로그인 링크). 사용량 공용 모듈 `ai-usage.js`. 확인: 2026 이탈리아 GP 생성(약 18초, 검증 통과), 랩 데이터 없는 2014 레이스도 근거 생성
- [ ] 하이라이트 문장 다듬기 + 라이브 AI 질문 박스
- [x] **로그인(11.17)** — 의존성 없이 Node 내장 `crypto`로 구현(비밀번호 scrypt 해시, JWT HS256 7일, 서명·만료 검사). `app_user` 테이블, `POST /api/auth/register|login`, `GET /api/auth/me`, `requireAuth` 미들웨어(`req.userId`), 로그인 실패 10회/15분 제한(메모리). 화면 `/login.html`(로그인·가입 탭, `?next=` 복귀), 헤더에 닉네임·로그아웃, 토큰은 `localStorage`. `.env`에 `JWT_SECRET` 필요(`.env.example`에 키만 추가). 그래서 `bcrypt`·`jsonwebtoken` 승인은 필요 없어짐
- [x] **즐겨찾기(11.18)** — `favorite(user_id, kind driver|team, ref_id)`(사용자 삭제 시 함께 삭제), `GET /api/favorites`·`PUT|DELETE /api/favorites/:kind/:id`(JWT, 본인 것만, 없는 대상 404). 화면: 드라이버·팀 상세의 ★ 토글(`favorite.js`, 비로그인이면 로그인으로 이동 후 복귀), `/favorites.html` 목록, 헤더에 링크. 대시보드 요약·`FAV_*` 알림은 알림 기능 때 연결
- [x] **Fantasy 예측·자동 채점(11.18)** — 8-1 규칙 그대로: 1~3위 예측(서로 다른 3명, 그 시즌 엔트리만), 마감=예선 시작(없으면 결승 시작)을 **서버 시각**으로 검사, 마감 전 덮어쓰기, 채점 최대 12점. `fantasy_prediction` 테이블, `GET /api/fantasy/races`·`/races/:id/drivers`·`/me`·`/ranking`, `PUT /api/fantasy/predictions/:raceId`. 채점은 `scorePending()`이 결과가 들어온 레이스의 **미채점 예측만** 계산(여러 번 실행해도 안전)하며 별도 스케줄러 없이 `/me`·`/ranking` 호출 시 실행. 규칙 테스트 `npm test`(`server/services/fantasy.test.js`). 화면 `/fantasy.html`(예측 폼·내 예측·시즌 랭킹), 상단 내비에 Fantasy 추가. 값은 `server/config.js` 대신 서비스 파일 상수/SQL에 둠. R21(라스베이거스)은 실제 마감 전이라 실제 예측을 받을 수 있음
- [x] **알림(11.18, 폴링)** — `notification` 테이블(`unique(user_id, kind, ref_key)`), 생성 작업 `createNotifications()`(멱등 SQL, 서버 시작 시 + 10분 간격): `FAV_RESULT`(즐겨찾기 드라이버 우승·포디움·득점·완주·리타이어 / 즐겨찾기 팀 포인트), `FAV_POLE`, `RACE_SOON`(결승 24시간 이내, 전체 사용자), `FANTASY_SCORED`. 새 즐겨찾기가 옛 알림을 쏟아내지 않도록 **최근 14일 결과만** 대상. `GET /api/notifications`(안 읽은 개수 포함)·`POST /:id/read`·`POST /read-all`(본인 것만). 헤더에 알림 링크+안 읽은 배지(30초 폴링), `/notifications.html`(클릭 읽음·모두 읽음). `RACE_SOON`은 실제 조건(24시간)을 지금 데이터로 재현할 수 없어 넓힌 간격으로 쿼리만 검증. 결과 수집(`ingest`) 직후 실행은 미구현. `POST_COMMENT`는 게시판에서 댓글 작성 시 생성
- [x] **게시판(11.18)** — `post`·`comment` 테이블(사용자·글 삭제 시 함께 삭제, 텍스트만), `GET /api/posts?page=`(20개씩, 댓글 수)·`GET /:id`(본문+댓글)·`POST`·`PUT|DELETE /:id`·`POST /:id/comments`·`DELETE /:id/comments/:cid`. 쓰기는 JWT, 수정·삭제는 **작성자 본인만**(남의 것 403, 없으면 404), 제목 100자·본문 5000자·댓글 1000자. 댓글이 달리면 글쓴이에게 `POST_COMMENT` 알림(자기 댓글 제외, 작업 대신 댓글 작성 시 바로 생성). 통합 검색에 게시글(제목·본문) 추가. 화면 `/board.html`(목록·페이지)·`/post.html?id=`(본문·댓글·본인 수정/삭제)·`/write.html[?id=]`(쓰기·수정), 상단 내비에 게시판. 댓글 수정은 없음(삭제 후 다시 작성). 헤더 내비가 로그인 시 잘려 1600px 이하에서 내비를 한 줄 아래로 내림, `[hidden]`이 `display`에 덮이던 알림 배지(0) 수정
- [ ] 커뮤니티 페이지

### 12.14~12.15 — 공통·제출
- [ ] 업데이트 내역, 반응형·로딩/오류·엣지 케이스 점검, 완료보고서, 서버 사전 기동·시연 리허설

**자르는 순서(밀릴 때):** 5등급 → 게시판 → 라이브 AI 질문 박스 → 뉴스. 1~3등급과 AI 어시스턴트는 지킨다.

## 10. 기술 스택과 규칙

- **프런트:** HTML5 시맨틱, CSS(변수·Grid/Flexbox·반응형, 다크/라이트), JS ES 모듈, **멀티페이지**(SPA 라우팅
  안 씀). 차트는 SVG/Canvas 직접 구현, 리플레이는 Canvas + `requestAnimationFrame`.
- **WebAPI:** Fetch, EventSource(SSE), Canvas, `localStorage`, `Intl`(KST).
- **서버:** Node.js + Express(ES 모듈), `pg`로 SQL 직접 작성(ORM 없음, 항상 `$1` 바인딩), 오류 처리 미들웨어 한 곳.
- **클라우드:** Supabase(Postgres), Render(GitHub 연동 자동 배포). 정적 파일도 같은 Express가 서빙(SSE 때문에
  서버리스 부적합).
- **코딩 규칙:** 의존성 추가는 먼저 이유를 설명하고 승인받는다. 식별자는 영어, 주석·UI 문구는 한국어. 파일 하나는
  하나의 책임, 공통 모듈을 먼저 만들고 재사용. 외부 데이터·사용자 입력은 `textContent`/이스케이프로만 DOM에 넣는다.
  비동기 요청에는 로딩·오류 상태를 항상 둔다.
- **보안:** 비밀 값(DB, Gemini 키, JWT 비밀)은 `.env`에만 두고 `.env.example`만 커밋. 게시글·댓글 수정/삭제는
  작성자 본인만(JWT 미들웨어). 이미지 업로드는 만들지 않는다.
- **저작권:** F1 공식 로고·사진·폰트 사용 금지, 직접 만든 디자인, 화면 하단에 **비공식 팬 프로젝트** 명시.

## 11. 디렉터리

```
server/  routes/ services/(ingest, assistant, highlight, jobs) db/(pool, queries, schema.sql) middleware/
client/  dashboard/ schedule/ drivers/ news/ live/ replay/ strategy/ ai/ community/ changelog/  css/ js/(공통)
scripts/ collect.js, import.js        # 사전 수집
data/    replay/{sessionId}.json, raw/(커밋 금지), circuits.json(필요 시)
docs/    weekly/, archive/, mockups/
```

## 12. 작업 방식 (Claude에게)

- 기능이 바뀌면 이 문서를 즉시 같이 고친다. 디자인이 바뀌면 `DESIGN.md`.
- 한 번에 한 기능. 작업 전 계획 3~5줄 → 구현 → **실행해서 확인** → 결과 요약.
- 불확실한 API 응답·필드는 실제 호출로 확인한다. 지어내지 않는다.
- 커밋은 기능 단위로 작게, `feat:`/`fix:`/`docs:` 형식.
- 범위가 커 보이면 줄이기 전에 먼저 공통 구조로 재사용할 방법을 찾는다.

```bash
# 설치: npm install   서버: npm run dev   테스트: npm test
# 수집: npm run collect -- --year <YYYY> --round <N>
```

## 부록 A. 참고 사이트(app.formula1dashboard.com) 기능 확인 결과

11.15 브라우저로 화면까지 확인(홈·Live Timing 제외 — Live Timing은 데이터 연결 전이라 비어 있었음). 화면별 차트 구성은 §7-1. 우리 계획에서의 위치:

| 참고 사이트 | 우리 쪽 |
|---|---|
| Home 카드·순위(변동 열)·Stats&Records 피드(전체/팀/드라이버/루키/레이스/트랙) | 대시보드(#1) |
| Schedule / Results / Standings | #2 |
| Drivers / Teams / Driver Stats | #3 (Driver Stats 탭) |
| Head To Head(프리셋·예선/레이스 H2H·팀메이트 Q 격차·팀 폴 격차) | #4 |
| Consistency(순위 분포 4종, DNF 제외) | #8 일관성 탭 |
| Race Pace(클린랩·107%·갭·Position Evolution·Top 20·스피드트랩) | #8 페이스 탭 |
| Pit Stops(카드·Top 20·팀/드라이버 평균·일관성) | #8 피트 탭 |
| Track DNA(버블맵·턴 수/거리/랩 길이 목록) | #3 Track DNA 탭(5등급) |
| Live Timing | #6 |
| Changelog / 테마 토글 | #11 / 헤더 |
| Tech Updates·PU Elements·Destructors·Special Liveries·Feedback·소셜 | 제외 |

우리만의 영역: 리플레이, AI, Fantasy, 알림, 게시판, 즐겨찾기, 통합 검색, 뉴스.
