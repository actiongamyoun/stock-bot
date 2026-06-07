import Parser from 'rss-parser';

const { TELEGRAM_TOKEN, CHAT_ID, ANTHROPIC_API_KEY } = process.env;

// 가져올 뉴스 개수
const NEWS_COUNT = 2;

// Google 뉴스 RSS 검색 URL (한국어, 인공지능/AI, 최근 2일)
const RSS_URL =
  'https://news.google.com/rss/search?' +
  new URLSearchParams({
    q: '인공지능 AI 기술 when:2d',
    hl: 'ko',
    gl: 'KR',
    ceid: 'KR:ko',
  });

async function main() {
  // 1) RSS에서 최신 뉴스 가져오기
  const parser = new Parser();
  const feed = await parser.parseURL(RSS_URL);
  const items = (feed.items || []).slice(0, NEWS_COUNT);

  if (items.length === 0) {
    await sendTelegram('📰 오늘은 새로운 AI 뉴스를 찾지 못했어요. 🙏');
    return;
  }

  // 2) Claude(Haiku)에게 상세 설명 요청
  const newsBlock = items
    .map(
      (it, i) =>
        `[뉴스 ${i + 1}]\n제목: ${it.title}\n요지: ${it.contentSnippet || '(없음)'}\n링크: ${it.link}`
    )
    .join('\n\n');

  const prompt = `아래는 오늘 아침의 AI 기술 관련 최신 뉴스 ${items.length}개입니다.
각 뉴스에 대해 한국어로 "짧은 요약"이 아니라 자세한 설명을 작성해 주세요.

[작성 규칙]
- 뉴스마다: 무슨 일인지 / 핵심 내용 / 왜 중요한지를 여러 문장으로 자세히 설명
- 반드시 제공된 제목·요지에 근거해 작성하고, 확실하지 않은 구체적 수치나 사실은 절대 지어내지 말 것
- 친근하지만 정보 전달이 명확한 톤
- 각 뉴스 끝에 링크를 그대로 포함
- 텔레그램 메시지로 바로 보낼 거라 마크다운 기호(*, #, _)는 쓰지 말고 일반 텍스트 + 이모지로 보기 좋게 정리
- 전체 길이는 3500자 이내

[뉴스 목록]
${newsBlock}`;

  const explanation = await askClaude(prompt);

  // 3) 텔레그램 발송
  const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  await sendTelegram(`📰 오늘의 AI 뉴스 (${today})\n\n${explanation}`);
  console.log('✅ 발송 완료');
}

async function askClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude API 오류: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.content
    .map((b) => b.text || '')
    .join('')
    .trim();
}

async function sendTelegram(text) {
  // 텔레그램 메시지 길이 제한(4096) 안전하게 자르기
  const safeText = text.length > 4000 ? text.slice(0, 3990) + '\n…(생략)' : text;

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: safeText,
      disable_web_page_preview: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`텔레그램 발송 오류: ${res.status} ${await res.text()}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1); // 실패하면 Actions가 빨간색으로 표시 → 알림 받기 좋음
});
