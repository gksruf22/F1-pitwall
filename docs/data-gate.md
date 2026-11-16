# 데이터 확인 게이트 결과 (2026-11-15)

Jolpica·OpenF1을 **실제로 호출해서** 확인한 결과다(추측 아님). 2026 시즌은 23라운드, 마지막 완료 레이스는 상파울루(11.08),
라스베이거스(11.22)·루사일·야스 마리나가 남아 있다. 호출 방법은 `scripts/gate.js`(재실행 가능).

## Jolpica (`https://api.jolpi.ca/ergast/f1`) — 한 번에 최대 100행
| 엔드포인트 | 확인된 내용 |
|---|---|
| `/{y}/races.json` | 라운드별 레이스·**세션 시작 시각(UTC)**: `FirstPractice`·`Qualifying`·`Sprint`·`SprintQualifying`의 date/time, 레이스 `date`/`time`. 서킷은 `circuitId`·이름·위경도·지역만(**턴 수·랩 길이 없음**) |
| `/{y}/{r}/results.json` | 포지션·포인트·그리드·랩 수·status·레이스 시간(`millis`)·**패스티스트랩(rank·lap·time)**. 드라이버는 `code`·`dateOfBirth`·`nationality`·`permanentNumber` |
| `/{y}/{r}/qualifying.json` | **Q1·Q2·Q3 랩타임 문자열**(`1:19.507`) → 팀메이트 예선 격차·팀 폴 격차를 Jolpica만으로 계산 가능 |
| `/{y}/{r}/sprint.json` | 스프린트 결과 있음 |
| `/{y}/{r}/sprintqualifying.json` | **지원 안 함(400)** → 스프린트 예선은 OpenF1 `session_result` 사용 |
| `/{y}/{r}/laps.json` | **랩별 모든 드라이버의 랩타임·포지션**(`Timings[].time/position`). 한 레이스 ≈ 1000행 = 약 11페이지. 2025 시즌도 있음 → **시즌 전체 레이스에서 페이스·포지션 변화·선두 대비 갭(누적합) 계산 가능** |
| `/{y}/{r}/pitstops.json` | `lap`·`stop`·`duration`. **duration은 피트레인 통과 시간(예: 27.7초)이지 정지 시간(2초대)이 아니다** |
| `/{y}/driverstandings.json` | 최신 라운드 기준 순위(`round` 필드 포함). 라운드별은 `/{y}/{r}/driverstandings.json` |
| `/drivers/{id}/seasons.json` | 드라이버의 출전 시즌 목록 → **루키 판별 가능**(첫 시즌 == 선택 시즌). 단 안토넬리가 2024부터 나오는 등 데이터 특이점이 있어 판별 규칙은 구현 때 재확인 |

## OpenF1 (`https://api.openf1.org/v1`) — 2026 완료 세션도 무료 조회 가능
| 엔드포인트 | 확인된 내용 |
|---|---|
| `sessions?year=2026&session_name=Race` | 25개(미래 포함), `session_key`·`date_start/end`·`location` |
| `laps?session_key=&driver_number=` | `lap_duration`, 섹터 3개, `i1_speed`·`i2_speed`·**`st_speed`(스피드트랩)**, `is_pit_out_lap` → **스피드트랩 Top 15 가능** |
| `stints?session_key=` | `stint_number`·`lap_start/end`·`compound`·`tyre_age_at_start` → 스틴트 차트 |
| `pit?session_key=` | `lane_duration`(피트레인)과 **`stop_duration`(정지 시간)** 둘 다 → "최단 피트스톱 1.99초" 같은 값은 이쪽 |
| `race_control?session_key=` | 메시지 212건(상파울루). `category`: `Flag`(GREEN·YELLOW·DOUBLE YELLOW·CLEAR·CHEQUERED·BLUE·BLACK AND WHITE), `SafetyCar`(`SAFETY CAR`·`VSC DEPLOYED`·`VSC ENDING`), `Other`, `SessionStatus`. 해당 카테고리가 없으면 **404 `No results found`**(빈 배열 아님). **2026년 완료 레이스에 적기(RED)는 0건** |
| `position?session_key=&driver_number=` | 순위가 바뀔 때만 기록(안토넬리 14행) |
| `location?session_key=&driver_number=&date>&date<` | x·y·z. **초당 약 3.9샘플**(2분에 463행·60KB). 한 레이스 22명 원본 ≈ 60MB 이상 → 2초 간격으로 줄이면 레이스당 1~2MB 예상 |
| `session_result?session_key=` | 최종 순위·`duration`·`gap_to_leader`·dnf/dns/dsq. **예선·스프린트 예선은 `duration`이 [Q1,Q2,Q3] 배열** |
| `drivers?session_key=` | `driver_number`·`name_acronym`(=Jolpica `code`로 매핑)·`team_colour`(hex)·`headshot_url`(F1 공식 이미지 — **저작권상 쓰지 않음**) |

## 위치(`location`) 데이터는 세션마다 있을 수도 없을 수도 있다
22개 완료 레이스 중 **사키르·제다·모나코(11299)는 위치 데이터가 0행**이고 나머지는 초당 약 3.7샘플이다.
리플레이는 위치가 필수이므로 시연 레이스는 반드시 위치가 있는 레이스에서 고른다.

## 시연용 OpenF1 수집 레이스 (확정)
| 레이스 | session_key | 특징 |
|---|---|---|
| 실버스톤 (7.05) | 11326 | 고속 서킷, SC+VSC(8건) |
| 몬자 (9.06) | 11361 | 저항력 낮은 서킷, SC+VSC(3건) |
| 멕시코시티 (11.01) | 11404 | 저속·고지대, SC+VSC(5건) |

예비: 스파 11334(SC+VSC), 마이애미 11280(SC). 상파울루 11412는 SC가 없다. **적기 있는 레이스는 없음.**
