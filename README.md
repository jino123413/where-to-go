# {{DISPLAY_NAME}}

Apps in Toss 웹뷰 미니앱 템플릿입니다.

## 플레이스홀더

이 템플릿을 사용할 때 다음 플레이스홀더를 실제 값으로 교체하세요:

| 플레이스홀더 | 설명 | 예시 |
|-------------|------|------|
| `{{APP_NAME}}` | 앱 이름 (영문, 하이픈) | `dday-calculator` |
| `{{DISPLAY_NAME}}` | 표시 이름 (한글) | `하루모아` |
| `{{DESCRIPTION}}` | 앱 설명 | `D-Day 계산기` |
| `{{PRIMARY_COLOR}}` | 테마 색상 | `#7C3AED` |
| `{{AD_GROUP_ID}}` | 광고 그룹 ID | `ait.v2.live.xxxxx` |
| `{{SERVICE_DESCRIPTION}}` | 서비스 설명 (약관용) | `D-Day 계산 서비스` |
| `{{CONTACT_EMAIL}}` | 연락처 이메일 | `your@email.com` |

## 빠른 시작

```bash
# 1. 템플릿 복사
cp -r template-app my-new-app

# 2. 플레이스홀더 교체 (수동 또는 sed 사용)

# 3. 의존성 설치 & 개발 서버
cd my-new-app
npm install --legacy-peer-deps
npm run dev

# 4. 빌드
npm run build
```

## 프로젝트 구조

```
template-app/
├── package.json
├── granite.config.ts
├── rsbuild.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.cjs
├── index.html
├── src/
│   ├── index.tsx
│   ├── index.css
│   ├── App.tsx
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useInterstitialAd.ts
│   │   └── useStorage.ts
│   ├── components/
│   │   ├── index.ts
│   │   └── DeviceViewport.tsx
│   └── utils/
│       └── index.ts
└── docs/
    ├── terms.html
    └── privacy.html
```

## 포함된 기능

- **useInterstitialAd**: 전면 광고 hook (GoogleAdMob)
- **useStorage / useJsonStorage**: 로컬 저장소 hook (Storage API)
- **DeviceViewport**: iOS safe area 대응 컴포넌트
- **Tailwind CSS**: 유틸리티 기반 스타일링
- **GmarketSans + Pretendard**: 기본 폰트 설정
- **Remix Icon**: 아이콘 라이브러리
- **이용약관/개인정보처리방침 템플릿**

## 기술 스택

- **프레임워크**: Granite (웹뷰 모드, Rsbuild)
- **UI**: Tailwind CSS v3 + CSS Variables
- **폰트**: GmarketSans (메인) + Pretendard Variable (폴백)
- **광고**: GoogleAdMob (`@apps-in-toss/web-framework`)

## 광고 배치 가이드

- **핵심 기능 (계산하기)**: 광고 없음
- **부가 기능 (다시 하기, 초기화)**: 광고 표시 후 실행
- AD 배지 + 사전 고지 문구 필수
