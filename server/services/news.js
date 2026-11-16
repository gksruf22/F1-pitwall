// 뉴스: 공개 RSS에서 제목·링크·날짜만 저장한다(본문 복사·스크래핑 없음). 클릭하면 원문 사이트로 이동.
import { pool, query } from '../db.js';

const FEEDS = [
  { source: 'Motorsport.com', url: 'https://www.motorsport.com/rss/f1/news/' },
  { source: 'Autosport', url: 'https://www.autosport.com/rss/f1/news/' },
  { source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml' },
];
const KEEP = 300; // 오래된 기사는 지워 테이블이 커지지 않게 한다

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
  .trim();
const tag = (xml, name) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return m ? decode(m[1]) : null;
};

// RSS <item> 목록 → [{ title, url, published }]. http(s) 링크만 받는다.
export function parseRss(xml) {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => {
    const date = new Date(tag(m[0], 'pubDate') ?? '');
    return { title: tag(m[0], 'title'), url: tag(m[0], 'link'), published: Number.isNaN(+date) ? null : date.toISOString() };
  }).filter((x) => x.title && /^https?:\/\//.test(x.url ?? ''));
}

export async function refreshNews() {
  let added = 0;
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; f1-pitwall-student-project)' }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseRss(await res.text());
      const { rowCount } = await query(
        `INSERT INTO news (source, title, url, published_utc)
         SELECT $1, * FROM unnest($2::text[], $3::text[], $4::timestamptz[]) ON CONFLICT (url) DO NOTHING`,
        [feed.source, items.map((i) => i.title), items.map((i) => i.url), items.map((i) => i.published)],
      );
      added += rowCount;
    } catch (e) {
      console.warn(`뉴스 수집 실패(${feed.source}): ${e.message}`); // 한 곳이 실패해도 나머지는 계속
    }
  }
  await query('DELETE FROM news WHERE id NOT IN (SELECT id FROM news ORDER BY published_utc DESC NULLS LAST LIMIT $1)', [KEEP]);
  return added;
}

// 서버가 켜질 때 한 번, 이후 하루 한 번 갱신한다. 최근 12시간 안에 받은 기사가 있으면 시작 시 건너뛴다.
export function scheduleNews() {
  query("SELECT count(*)::int AS n FROM news WHERE published_utc > now() - interval '12 hours'")
    .then(({ rows }) => (rows[0].n ? 0 : refreshNews()))
    .catch((e) => console.warn('뉴스 초기 갱신 실패:', e.message));
  setInterval(() => refreshNews().catch((e) => console.warn(e.message)), 24 * 60 * 60 * 1000).unref();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`새 기사 ${await refreshNews()}건`);
  await pool.end();
}
