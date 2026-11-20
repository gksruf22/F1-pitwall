// 완료보고서용 "AI에게 입력한 내용" 정리: Claude Code 세션 기록(~/.claude/projects/<이 폴더>/*.jsonl)에서
// 사용자가 입력한 문장만 뽑아 날짜순으로 docs/ai-prompts.md에 쓰고, 각 입력 뒤에 이어진 커밋을 붙인다.
// 실행: npm run export:prompts  (다시 실행하면 파일 전체를 새로 만든다)
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
// 기록 폴더 이름 = 프로젝트 경로의 영숫자 외 문자를 '-'로. macOS 경로의 한글은 분해형(NFD)이라 NFC로 맞춘다
const logDir = path.join(os.homedir(), '.claude/projects', root.normalize('NFC').replace(/[^A-Za-z0-9]/g, '-'));
const out = path.join(root, 'docs/ai-prompts.md');

// 이 프로젝트와 관계없는 입력(다른 프로젝트 명령을 잘못 붙여넣은 것 등)은 제외한다
const EXCLUDE = [/sleep_logs/];
// 시스템이 넣은 메시지(작업 알림·중단 표시·대화 요약 등)는 사용자 입력이 아니다
const SYSTEM_PREFIX = ['<task-notification', '[Request interrupted', '<local-command-caveat>', 'This session is being continued'];

const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString(); // YYYY-MM-DDTHH:MM (KST)

function clean(text) {
  const cmd = /<command-name>([^<]+)<\/command-name>/.exec(text);
  if (cmd) return `(명령) \`${cmd[1].trim()}\``;
  const bash = /<bash-input>([\s\S]*?)<\/bash-input>/.exec(text);
  if (bash) return `(터미널 명령) \`${bash[1].trim()}\``;
  if (text.includes('<bash-stdout>')) return null; // 위 명령의 출력
  return text.replace(/<\/?pasted_content[^>]*>/g, '').trim();
}

async function prompts() {
  const files = (await readdir(logDir)).filter((f) => f.endsWith('.jsonl'));
  const list = [];
  for (const f of files) {
    for (const line of (await readFile(path.join(logDir, f), 'utf8')).split('\n')) {
      let d;
      try { d = JSON.parse(line); } catch { continue; }
      if (d.type !== 'user' || d.isMeta || d.toolUseResult || d.isSidechain || d.isCompactSummary) continue;
      const c = d.message?.content;
      const raw = (typeof c === 'string' ? c : (c ?? []).filter((x) => x?.type === 'text').map((x) => x.text).join('\n')).trim();
      if (!raw || SYSTEM_PREFIX.some((p) => raw.startsWith(p)) || raw.includes('<local-command-stdout>')) continue;
      if (EXCLUDE.some((re) => re.test(raw))) continue;
      const text = clean(raw);
      if (text) list.push({ at: kst(d.timestamp), session: f.slice(0, 8), text });
    }
  }
  return list.sort((a, b) => a.at.localeCompare(b.at));
}

function commits() {
  const log = execFileSync('git', ['log', '--reverse', '--date=iso-strict', '--pretty=%ad%x09%h%x09%s'], { cwd: root, encoding: 'utf8' });
  return log.trim().split('\n').map((l) => {
    const [date, hash, subject] = l.split('\t');
    return { at: kst(date), hash, subject };
  });
}

const quote = (text) => text.split('\n').map((l) => `> ${l}`).join('\n');

const list = await prompts();
const cs = commits();
const byDay = new Map();
list.forEach((p, i) => {
  const next = list[i + 1]?.at ?? '9999';
  p.commits = cs.filter((c) => c.at >= p.at && c.at < next);
  const day = p.at.slice(0, 10);
  byDay.set(day, [...(byDay.get(day) ?? []), p]);
});

const lines = [
  '# AI에게 입력한 내용 (Claude Code)',
  '',
  '개발 도구로 쓴 AI(Claude Code)에 입력한 내용을 시간순(KST)으로 정리했다. 세션 기록에서 자동 추출',
  '(`npm run export:prompts`)하며, 시스템 알림·대화 요약·다른 프로젝트 입력은 제외했다. 각 입력 아래의 "→"는',
  '그 입력 이후 다음 입력 전까지 만들어진 커밋이다. "계속", "해줘"처럼 짧은 입력은 `PLAN.md`의 다음 작업을',
  '진행하라는 뜻이다(작업 순서와 범위는 PLAN.md에 미리 정해 두었다).',
  '',
  `- 생성: ${kst(new Date().toISOString()).slice(0, 16).replace('T', ' ')} · 입력 ${list.length}건 · 세션 ${new Set(list.map((p) => p.session)).size}개`,
  '- AI가 한 일과 본인이 한 일의 구분은 `docs/ai-usage.md`',
  '',
];
for (const [day, items] of byDay) {
  lines.push(`## ${day}`, '');
  for (const p of items) {
    lines.push(`**${p.at.slice(11, 16)}**`, '', quote(p.text), '');
    for (const c of p.commits) lines.push(`- → \`${c.hash}\` ${c.subject}`);
    if (p.commits.length) lines.push('');
  }
}
await writeFile(out, lines.join('\n'));
console.log(`${path.relative(root, out)}: 입력 ${list.length}건, 연결된 커밋 ${list.reduce((n, p) => n + p.commits.length, 0)}/${cs.length}개`);
