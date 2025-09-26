// api/ai-index.js
export default async function handler(req, res) {
  // ── CORS: 브라우저 차단 방지 (모든 응답에 헤더 부착)
  const ORIGIN = req.headers.origin || 'null'; // file:// 은 'null'
  const ALLOW  = process.env.ALLOWED_ORIGINS || '*'; // 예: "*", "https://yourtool.vercel.app,null"
  const allowAll = ALLOW.split(',').map(s=>s.trim()).includes('*');
  const allowedList = ALLOW.split(',').map(s=>s.trim());
  const allowOrigin = allowAll ? '*' : (allowedList.includes(ORIGIN) ? ORIGIN : '');
  res.setHeader('Vary', 'Origin');
  if (allowOrigin) res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-team-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // 프리플라이트(브라우저 사전 확인)
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 헬스체크(주소창으로 바로 확인용)
  if (req.method === 'GET') return res.status(200).json({ ok: true, route: '/api/ai-index' });

  // POST만 허용
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 팀 토큰 확인
  const clientToken = req.headers['x-team-token'];
  if (!clientToken || clientToken !== process.env.TEAM_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: invalid team token' });
  }

  // JSON 바디 파싱
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Bad Request: invalid JSON' }); }

  // 기본값들
  const model = body?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const system = body?.prompt?.system || '';
  const user   = body?.prompt?.user || '';
  const maxTokens = Number(body?.maxTokens || 50);
  const temperature = body?.temperature ?? 0.3;

  // 서버 환경변수에 키가 없으면 오류
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY missing' });
  }

  try {
    // OpenAI 호출
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user }
        ],
        max_tokens: maxTokens,
        temperature
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.error?.message || 'OpenAI error' });
    }
    // 그대로 전달
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
