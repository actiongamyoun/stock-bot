# 텔레그램 자동화 봇

GitHub Actions로 돌아가는 텔레그램 봇 2개입니다.

- **AI 뉴스 봇**: 매일 아침 6시(KST), AI 기술 최신 뉴스 2개를 Claude가 상세히 설명해서 발송
- **급등급락 봇**: 평일 장중(09~15시 KST) 매시 정각, 코스피+코스닥 급등·급락 상위 5종목 발송

## 폴더 구조

```
.github/workflows/
  ├── ai-news-bot.yml      # 뉴스 봇 스케줄
  └── stock-movers.yml     # 급등급락 봇 스케줄
scripts/
  ├── send-news.mjs        # 뉴스 봇 로직
  └── stock-movers.mjs     # 급등급락 봇 로직
```

> 이 4개 파일(`.github` 폴더 포함)을 GitHub 저장소 **루트**에 그대로 올리면 됩니다.
> `.github` 폴더는 탐색기/Finder에서 숨김 처리되어 안 보일 수 있는데 정상입니다.

## 필요한 Secret 등록

저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 설명 | 사용하는 봇 |
|------|------|------------|
| `TELEGRAM_TOKEN` | @BotFather에서 받은 봇 토큰 | 둘 다 |
| `CHAT_ID` | 받을 그룹의 chat id (음수, 예: `-100123...`) | 둘 다 |
| `ANTHROPIC_API_KEY` | console.anthropic.com 발급 키 | 뉴스 봇 |
| `KIS_APP_KEY` | 한국투자증권 Open API APP KEY | 급등급락 봇 |
| `KIS_APP_SECRET` | 한국투자증권 Open API APP SECRET | 급등급락 봇 |

### chat id 얻는 법 (그룹)
1. 텔레그램 그룹을 만들고 봇을 멤버로 추가
2. 그룹에 `@getidsbot` 잠깐 초대 → chat id 확인 후 내보내기
3. 그 음수 id를 `CHAT_ID`에 등록

### 한국투자증권 키 발급
1. 한국투자증권 실계좌 개설
2. apiportal.koreainvestment.com → Open API 신청 → 계좌 등록
3. APP KEY / APP SECRET 발급 → Secret 등록

## 테스트

Actions 탭 → 원하는 워크플로우 선택 → **Run workflow** 버튼으로 즉시 실행.
(급등급락 봇은 평일 장중에 돌려야 의미 있는 데이터가 나옵니다.)

## 조정 포인트

- **뉴스 검색어**: `scripts/send-news.mjs`의 `q: '인공지능 AI 기술 when:2d'`
- **급등급락 거래량 필터**: `scripts/stock-movers.mjs`의 `MIN_VOLUME`(끄려면 `''`)
- **발송 시간**: 각 `.yml`의 `cron` 값 (UTC 기준, KST = UTC+9)

## 참고

- GitHub cron은 부하에 따라 몇 분~십여 분 지연될 수 있습니다.
- 저장소가 60일간 커밋 등 활동이 없으면 스케줄이 자동 비활성화됩니다. 가끔 작은 커밋을 해두면 안전합니다.
- 공휴일엔 한국 증시가 쉬므로 급등급락 봇이 전일 데이터를 보낼 수 있습니다.
