-- 1주차 범위: season ~ result (PLAN.md §4). 여러 번 실행해도 안전하다(IF NOT EXISTS).
-- 시간은 UTC(timestamptz)로 저장하고 화면에서 KST로 변환한다.

CREATE TABLE IF NOT EXISTS season (
  year integer PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS circuit (
  id         text PRIMARY KEY,          -- Jolpica circuitId
  name       text NOT NULL,
  country    text,
  lat        double precision,
  lon        double precision,
  length_km  numeric,                   -- Jolpica에 없음(직접 정리, 5등급)
  turns      integer,                   -- 위와 같음
  track_path jsonb                      -- OpenF1 위치로 생성(3등급)
);

CREATE TABLE IF NOT EXISTS team (
  id    text PRIMARY KEY,               -- Jolpica constructorId
  name  text NOT NULL,
  color text                            -- 팀 컬러(#RRGGBB), OpenF1 team_colour로 채움
);

CREATE TABLE IF NOT EXISTS driver (
  id          text PRIMARY KEY,         -- Jolpica driverId
  code        text,                     -- 3글자 약어(OpenF1 name_acronym과 동일)
  name        text NOT NULL,
  nationality text,
  birth       date
);

CREATE TABLE IF NOT EXISTS entry (       -- 시즌별 소속
  season    integer NOT NULL REFERENCES season(year),
  driver_id text    NOT NULL REFERENCES driver(id),
  team_id   text    NOT NULL REFERENCES team(id),
  number    integer,
  PRIMARY KEY (season, driver_id, team_id)
);

CREATE TABLE IF NOT EXISTS race (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season     integer NOT NULL REFERENCES season(year),
  round      integer NOT NULL,
  name       text NOT NULL,
  circuit_id text REFERENCES circuit(id),
  UNIQUE (season, round)
);

CREATE TABLE IF NOT EXISTS session (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  race_id     integer NOT NULL REFERENCES race(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('R', 'Q', 'S', 'SQ')),
  start_utc   timestamptz,
  openf1_key  integer,                  -- 수집 여부 = openf1_key 유무
  UNIQUE (race_id, type)
);

CREATE TABLE IF NOT EXISTS result (
  session_id      integer NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  driver_id       text    NOT NULL REFERENCES driver(id),
  team_id         text    REFERENCES team(id),
  grid            integer,
  position        integer,              -- 완주 못 해도 최종 순위가 있다(status로 구분)
  points          numeric NOT NULL DEFAULT 0,
  status          text,
  fastest_lap_ms  integer,              -- R/S 세션
  fastest_rank    smallint,             -- 패스티스트랩 순위(1이면 최속)
  q1_ms           integer,              -- Q/SQ 세션 행에서 사용
  q2_ms           integer,
  q3_ms           integer,
  PRIMARY KEY (session_id, driver_id)
);

CREATE INDEX IF NOT EXISTS result_driver_idx ON result (driver_id);
CREATE INDEX IF NOT EXISTS race_season_idx   ON race (season);
