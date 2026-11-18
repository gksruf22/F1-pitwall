// Gemini REST 호출(SDK 없음)과 함수 호출 반복. 서버에서만 쓴다(키는 .env).
import { HttpError } from '../http.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function generate(body) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.AI_MODEL || 'gemini-flash-lite-latest';
  if (!key) throw new HttpError(503, 'AI_DISABLED', 'AI 기능이 설정되지 않았습니다.');
  // 503(수요 과다)은 일시적이라 1회만 다시 시도한다
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40_000),
    }).catch(() => null);
    if (res?.ok) return res.json();
    if (attempt === 0 && (!res || res.status === 503 || res.status >= 500)) continue;
    // 상세 오류는 로그에만(키는 헤더라 로그에 남지 않음)
    console.error('Gemini 오류', res?.status, res && (await res.text()).slice(0, 300));
    if (res?.status === 429) throw new HttpError(429, 'AI_LIMIT', 'AI 사용량이 많습니다. 잠시 후 다시 시도해 주세요.');
    throw new HttpError(502, 'AI_UNAVAILABLE', 'AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

// contents로 대화를 이어 가며, 모델이 함수 호출을 요청하면 runTool로 실행해 결과를 돌려준다.
// 반환: { text, calls: [{ name, args, result }] }
export async function chatWithTools({ system, contents, declarations, runTool, maxLoops = 4, maxTokens = 800 }) {
  const calls = [];
  const convo = [...contents];
  for (let loop = 0; ; loop++) {
    const last = loop >= maxLoops; // 반복 한도에 닿으면 더 이상 함수를 못 부르게 하고 답을 받는다
    const data = await generate({
      systemInstruction: { parts: [{ text: system }] },
      contents: convo,
      tools: [{ functionDeclarations: declarations }],
      toolConfig: { functionCallingConfig: { mode: last ? 'NONE' : 'AUTO' } },
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
    });
    const content = data.candidates?.[0]?.content;
    const parts = content?.parts ?? [];
    const fnCalls = parts.filter((p) => p.functionCall);
    if (!fnCalls.length || last) {
      const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
      return { text: text || '답변을 만들지 못했습니다. 질문을 바꿔 다시 시도해 주세요.', calls };
    }
    // 모델 응답(thoughtSignature 포함)은 그대로 되돌려 보내야 한다
    convo.push(content);
    const responses = [];
    for (const { functionCall: fc } of fnCalls) {
      const result = await runTool(fc.name, { ...fc.args });
      calls.push({ name: fc.name, args: fc.args ?? {}, result });
      responses.push({ functionResponse: { name: fc.name, ...(fc.id && { id: fc.id }), response: { result } } });
    }
    convo.push({ role: 'user', parts: responses });
  }
}
