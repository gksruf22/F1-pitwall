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

-- 2주차: 랩·피트스톱·스틴트·이벤트·뉴스 (PLAN.md §4)
CREATE TABLE IF NOT EXISTS lap (
  session_id integer NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  driver_id  text    NOT NULL REFERENCES driver(id),
  lap        integer NOT NULL,
  time_ms    integer,                   -- Jolpica(시즌 전체)
  position   integer,                   -- Jolpica(해당 랩 종료 시 순위)
  s1         integer,                   -- 아래 4개는 OpenF1(수집 3건만)
  s2         integer,
  s3         integer,
  st_speed   integer,
  pit_out    boolean,
  PRIMARY KEY (session_id, driver_id, lap)
);

CREATE TABLE IF NOT EXISTS pit_stop (
  session_id integer NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  driver_id  text    NOT NULL REFERENCES driver(id),
  lap        integer NOT NULL,
  lane_ms    integer,                   -- Jolpica: 피트레인 통과 시간(전체)
  stop_ms    integer,                   -- OpenF1: 정지 시간(수집 3건만)
  PRIMARY KEY (session_id, driver_id, lap)
);

CREATE TABLE IF NOT EXISTS stint (
  session_id integer NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  driver_id  text    NOT NULL REFERENCES driver(id),
  no         integer NOT NULL,
  lap_from   integer,
  lap_to     integer,
  compound   text,
  PRIMARY KEY (session_id, driver_id, no)
);

CREATE TABLE IF NOT EXISTS replay_event (
  session_id integer NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  seq        integer NOT NULL,
  ts         timestamptz,
  lap        integer,
  type       text NOT NULL,             -- GREEN_FLAG | SAFETY_CAR | RED_FLAG | PIT_IN | PIT_OUT | FASTEST_LAP | POSITION_CHANGE
  driver     text,
  data       jsonb,
  PRIMARY KEY (session_id, seq)
);

CREATE TABLE IF NOT EXISTS news (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source        text NOT NULL,
  title         text NOT NULL,
  url           text NOT NULL UNIQUE,
  published_utc timestamptz
);
CREATE INDEX IF NOT EXISTS news_published_idx ON news (published_utc DESC);

-- 참여 기능: 사용자(이메일은 소문자로 저장해 대소문자 중복을 막는다)
CREATE TABLE IF NOT EXISTS app_user (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL UNIQUE,
  nickname    text NOT NULL,
  pw_hash     text NOT NULL,
  created_utc timestamptz NOT NULL DEFAULT now()
);

-- 즐겨찾기: 드라이버·팀. 사용자가 지워지면 함께 지운다.
CREATE TABLE IF NOT EXISTS favorite (
  user_id integer NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind    text NOT NULL CHECK (kind IN ('driver', 'team')),
  ref_id  text NOT NULL,
  PRIMARY KEY (user_id, kind, ref_id)
);
