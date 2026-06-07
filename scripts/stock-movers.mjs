// 한국투자증권 Open API로 코스피+코스닥 급등·급락 상위 5종목을 조회해 텔레그램으로 발송
// 검증 출처: github.com/koreainvestment/open-trading-api (등락률 순위, tr_id FHPST01700000)

const { TELEGRAM_TOKEN, CHAT_ID, KIS_APP_KEY, KIS_APP_SECRET } = process.env;

const KIS_BASE = 'https://openapi.koreainvestment.com:9443'; // 실전 도메인
const TOP_N = 5;          // 급등/급락 각각 몇 개
const MIN_VOLUME = '100000'; // 최소 누적거래량(잡주 노이즈 제거). 끄려면 '' 로

// 1) 접근토큰 발급 (24시간 유효, 매 실행마다 새로 발급)
async function getToken() {
  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`토큰 발급 실패: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`토큰 응답 이상: ${JSON.stringify(data)}`);
  return data.access_token;
}

// 2) 등락률 순위 조회
//    sortCode: '0' = 상승률순(급등), '1' = 하락률순(급락)
async function getRanking(token, sortCode) {
  // 공식 샘플과 동일한 소문자 파라미터 키 사용
  const params = new URLSearchParams({
    fid_cond_mrkt_div_code: 'J',     // J: KRX (코스피+코스닥)
    fid_cond_scr_div_code: '20170',  // 등락률 (고정값)
    fid_input_iscd: '0000',          // 0000: 전체
    fid_rank_sort_cls_code: sortCode,
    fid_input_cnt_1: '0',
    fid_prc_cls_code: '0',
    fid_input_price_1: '',
    fid_input_price_2: '',
    fid_vol_cnt: MIN_VOLUME,
    fid_trgt_cls_code: '0',
    fid_trgt_exls_cls_code: '0',
    fid_div_cls_code: '0',
    fid_rsfl_rate1: '',
    fid_rsfl_rate2: '',
  });

  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/ranking/fluctuation?${params}`,
    {
      method: 'GET',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${token}`,
        appkey: KIS_APP_KEY,
        appsecret: KIS_APP_SECRET,
        tr_id: 'FHPST01700000',
        custtype: 'P', // 개인
      },
    }
  );
  if (!res.ok) throw new Error(`순위 조회 실패: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (data.rt_cd !== '0') throw new Error(`API 오류: ${data.msg1} (${data.msg_cd})`);
  return (data.output || []).slice(0, TOP_N);
}

// 3) 메시지 포맷 (isUp=true 급등, false 급락)
function formatRows(rows, isUp) {
  if (!rows.length) return '(데이터 없음)';
  return rows
    .map((r, i) => {
      const price = Number(r.stck_prpr).toLocaleString('ko-KR');
      const rate = Math.abs(Number(r.prdy_ctrt)).toFixed(2);
      const sign = isUp ? '+' : '-';
      return `${i + 1}. ${r.hts_kor_isnm}  ${sign}${rate}%  (${price}원)`;
    })
    .join('\n');
}

// 4) 텔레그램 발송
async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  if (!res.ok) throw new Error(`텔레그램 발송 오류: ${res.status} ${await res.text()}`);
}

async function main() {
  const token = await getToken();

  const [gainers, losers] = await Promise.all([
    getRanking(token, '0'), // 급등
    getRanking(token, '1'), // 급락
  ]);

  const now = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const msg =
    `📊 한국 증시 급등·급락 (${now} 기준)\n` +
    `※ 코스피+코스닥 · 거래량 10만주 이상\n\n` +
    `🔴 급등 TOP ${TOP_N}\n${formatRows(gainers, true)}\n\n` +
    `🔵 급락 TOP ${TOP_N}\n${formatRows(losers, false)}`;

  await sendTelegram(msg);
  console.log('✅ 발송 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1); // 실패 시 Actions가 빨간색으로 표시 → 문제 알아채기 좋음
});
