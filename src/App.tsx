import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import {
  TravelResult,
  DirectionId,
  DIRECTIONS,
} from './types';
import { calculateTravel } from './utils/travel-engine';
import { useInterstitialAd } from './hooks/useInterstitialAd';
import { DeviceViewport } from './components/DeviceViewport';

type Phase = 'idle' | 'spinning' | 'result';

const AD_GROUP_ID = 'ait.v2.live.b9e7a7bc7b144238';
const DEVICE_ID_KEY = 'where-to-go-device-id';
const FIRST_VISIT_KEY = 'where-to-go-first-visit';
const TODAY_RESULT_KEY = 'where-to-go-today';

// === Mascot images ===

const MASCOT = {
  main: '/mascot/narin-main-1.png',
  flying: '/mascot/narin-flying-1.png',
  thinking: '/mascot/narin-thinking-1.png',
  guiding: '/mascot/narin-guiding-1.png',
  happy: '/mascot/narin-happy-1.png',
};

// === Direction SVG Stamp Icons ===

function DirectionStampIcon({ id, size = 18, color = 'currentColor' }: { id: DirectionId; size?: number; color?: string }) {
  switch (id) {
    case 'east':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20 L10 6 L17 20" />
          <path d="M10 20 L15 11 L21 20" />
        </svg>
      );
    case 'west':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
          <path d="M2 13 C5 7, 9 7, 12 13 C15 19, 19 19, 22 13" />
          <path d="M2 18 C5 12, 9 12, 12 18" />
        </svg>
      );
    case 'south':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="10" width="7" height="11" rx="1" />
          <rect x="14" y="4" width="7" height="17" rx="1" />
          <line x1="5.5" y1="14" x2="7.5" y2="14" />
          <line x1="16" y1="8" x2="19" y2="8" />
          <line x1="16" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'north':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <path d="M5 20 Q5 14, 12 14 Q19 14, 19 20" />
          <line x1="4" y1="20" x2="20" y2="20" />
          <path d="M9 11 C9.5 8.5, 8.5 6, 9 3.5" />
          <path d="M12 11 C12.5 8.5, 11.5 6, 12 3.5" />
          <path d="M15 11 C15.5 8.5, 14.5 6, 15 3.5" />
        </svg>
      );
  }
}

// === Storage helpers ===

async function storageGet(key: string): Promise<string | null> {
  try {
    const { Storage } = await import('@apps-in-toss/web-framework');
    const val = await Storage.getItem(key);
    if (val != null) return val;
  } catch {}
  return localStorage.getItem(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    const { Storage } = await import('@apps-in-toss/web-framework');
    await Storage.setItem(key, value);
  } catch {}
  localStorage.setItem(key, value);
}

// === Today key ===

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// === Tomorrow direction teaser ===

function getTomorrowDirection(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Simple hash to get direction hint
  let h = 0;
  const seed = `tomorrow-hint@${key}`;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const dirs = ['동', '서', '남', '북'];
  return dirs[Math.abs(h) % 4];
}

// === Narin speech ===

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '좋은 아침이래요~ 오늘은 어디로 떠나볼래요?';
  if (hour < 18) return '오늘도 좋은 하루래요~ 나침반을 돌려볼래요?';
  return '고요한 저녁이래요~ 오늘의 여행지가 궁금하지 않대요?';
}

const NARIN_SPEECH = {
  spinning: [
    '나린이 길을 찾고 있대요...',
    '어느 방위가 끌리는지 보고 있대요...',
    '거의 다 찾았어요~!',
  ],
  found: (dir: string) =>
    `${dir}쪽이래요! 오늘의 여행지를 찾았대요~ 크르릉!`,
  retry: '다른 방위의 여행지가 궁금하대요~?',
} as const;

// === Constants ===

const DIRECTION_LABELS: { id: DirectionId; angle: number; label: string }[] = [
  { id: 'north', angle: 0, label: '북' },
  { id: 'east', angle: 90, label: '동' },
  { id: 'south', angle: 180, label: '남' },
  { id: 'west', angle: 270, label: '서' },
];

// === Sparkle Generator ===

function SparkleParticles({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; sx: number; sy: number; ex: number; ey: number; delay: number }[]
  >([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }
    const interval = setInterval(() => {
      const id = Date.now() + Math.random();
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 60;
      setParticles((prev) => [
        ...prev.slice(-12),
        {
          id,
          x: 50 + Math.random() * 200,
          y: 50 + Math.random() * 200,
          sx: Math.cos(angle) * dist * 0.3,
          sy: Math.sin(angle) * dist * 0.3,
          ex: Math.cos(angle) * dist,
          ey: Math.sin(angle) * dist,
          delay: Math.random() * 0.3,
        },
      ]);
    }, 150);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  return (
    <div className="sparkle-container">
      {particles.map((p) => (
        <div
          key={p.id}
          className="sparkle-particle"
          style={{
            left: p.x,
            top: p.y,
            '--sx': `${p.sx}px`,
            '--sy': `${p.sy}px`,
            '--ex': `${p.ex}px`,
            '--ey': `${p.ey}px`,
            animationDelay: `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// === Main App ===

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [deviceId, setDeviceId] = useState('');
  const [result, setResult] = useState<TravelResult | null>(null);
  const [hiddenGemUnlocked, setHiddenGemUnlocked] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);
  const [spinMsg, setSpinMsg] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showRipple, setShowRipple] = useState(false);

  const { loading: adLoading, showAd } = useInterstitialAd(AD_GROUP_ID);
  const needleRef = useRef<SVGGElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const msgTimerRef = useRef<ReturnType<typeof setInterval>>();

  // --- Init ---
  useEffect(() => {
    (async () => {
      let id = await storageGet(DEVICE_ID_KEY);
      if (!id) {
        try {
          id = crypto.randomUUID();
        } catch {
          id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        }
        await storageSet(DEVICE_ID_KEY, id);
        const visited = await storageGet(FIRST_VISIT_KEY);
        if (!visited) {
          setShowWelcome(true);
          await storageSet(FIRST_VISIT_KEY, 'true');
        }
      }
      setDeviceId(id);

      // #5: 같은 날 재방문 → 결과 바로 보여주기
      const savedToday = await storageGet(TODAY_RESULT_KEY);
      if (savedToday) {
        try {
          const parsed = JSON.parse(savedToday);
          if (parsed.date === todayKey()) {
            const travelResult = calculateTravel(id);
            setResult(travelResult);
            setPhase('result');
          }
        } catch {}
      }
    })();
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      if (msgTimerRef.current) clearInterval(msgTimerRef.current);
    };
  }, []);

  // --- Handlers ---

  const handleCompassTap = useCallback(() => {
    if (!deviceId || phase !== 'idle') return;

    const effectiveId = rerollCount > 0 ? `${deviceId}:r${rerollCount}` : deviceId;
    const travelResult = calculateTravel(effectiveId);
    setResult(travelResult);

    try {
      generateHapticFeedback({ type: 'softMedium' });
    } catch {}

    // Ripple
    setShowRipple(true);
    setTimeout(() => setShowRipple(false), 600);

    // Spinning phase
    setPhase('spinning');
    setSpinMsg(NARIN_SPEECH.spinning[0]);
    setHiddenGemUnlocked(false);

    // #1: Needle animation 1800ms (2초 이내)
    const targetAngle = travelResult.direction.angle;
    const totalRotation = 720 + (targetAngle === 0 ? 360 : targetAngle);

    requestAnimationFrame(() => {
      needleRef.current?.getAnimations().forEach((a) => a.cancel());
      needleRef.current?.animate(
        [
          { transform: 'rotate(0deg)' },
          { transform: `rotate(${totalRotation}deg)` },
        ],
        {
          duration: 1800,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        },
      );
    });

    // Spin messages
    let msgIdx = 0;
    msgTimerRef.current = setInterval(() => {
      msgIdx++;
      if (msgIdx < NARIN_SPEECH.spinning.length) {
        setSpinMsg(NARIN_SPEECH.spinning[msgIdx]);
      }
    }, 600);

    // #1: Transition to result 2000ms (2초 이내)
    spinTimerRef.current = setTimeout(() => {
      if (msgTimerRef.current) clearInterval(msgTimerRef.current);

      try {
        generateHapticFeedback({ type: 'rigid' });
      } catch {}

      setPhase('result');

      // #5: 오늘 결과 저장 (재방문 시 스피닝 스킵용)
      storageSet(TODAY_RESULT_KEY, JSON.stringify({ date: todayKey() }));

      // Scroll to results
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }, 2000);
  }, [deviceId, phase, rerollCount]);

  const handleUnlockHiddenGem = useCallback(() => {
    showAd({
      onDismiss: () => {
        setHiddenGemUnlocked(true);
        try {
          generateHapticFeedback({ type: 'softMedium' });
        } catch {}
      },
    });
  }, [showAd]);

  // #2: 다시 돌리기 — 광고 완전 제거 (항상 무료)
  const handleRetry = useCallback(() => {
    setRerollCount((prev) => prev + 1);
    setPhase('idle');
    setResult(null);
    setHiddenGemUnlocked(false);
    needleRef.current?.getAnimations().forEach((a) => a.cancel());
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      generateHapticFeedback({ type: 'softMedium' });
    } catch {}
  }, []);

  // #7: 공유 메시지 — 수신자 관점
  const handleShare = useCallback(async () => {
    if (!result) return;
    try {
      const { share, getTossShareLink } = await import('@apps-in-toss/web-framework');
      const link = await getTossShareLink('intoss://where-to-go/home');
      const msg =
        `오늘 나침반이 가리킨 곳은 ${result.direction.name}쪽!\n\n` +
        `${result.dataSet.mainSpot.name} ${result.dataSet.mainSpot.tag}\n` +
        `${result.dataSet.subSpot.name} ${result.dataSet.subSpot.tag}\n\n` +
        `너도 나침반 돌려봐! ${link}`;
      await share({ message: msg });
    } catch {
      try {
        await navigator.share({
          title: '운명의 나침반',
          text: `오늘 나침반이 가리킨 곳: ${result.direction.name}쪽 ${result.dataSet.mainSpot.name}! 너도 돌려봐~`,
          url: 'https://toss.im',
        });
      } catch {}
    }
  }, [result]);

  // Active direction
  const activeDir = result?.direction ?? null;
  const isSpinningOrResult = phase === 'spinning' || phase === 'result';

  // Mascot for current phase
  const mascotSrc =
    phase === 'idle'
      ? MASCOT.main
      : phase === 'spinning'
        ? MASCOT.flying
        : MASCOT.guiding;

  // #8: Tomorrow direction teaser
  const tomorrowDir = getTomorrowDirection();

  return (
    <>
      <DeviceViewport />

      {/* === Welcome Overlay === */}
      {showWelcome && (
        <div className="welcome-overlay">
          <div className="flex flex-col items-center px-8 text-center">
            <img
              src={MASCOT.happy}
              alt="나린"
              className="w-[120px] h-[120px] mascot-img mb-6"
            />
            <h2 className="text-2xl font-bold text-gray-800 font-gmarket mb-3">
              반갑대요! 크르릉~
            </h2>
            <p className="text-sm text-gray-600 font-gmarket leading-relaxed mb-2">
              나는 나린이래요~
              <br />
              나침반에서 태어난 여행 안내 아기 용이래요!
            </p>
            <p className="text-sm text-gray-500 font-gmarket leading-relaxed mb-8">
              나침반을 탭하면 오늘의 여행지를 알려줄 거래요~
              <br />
              매일 바뀌니까 내일도 와달래요!
            </p>
            <button
              onClick={() => setShowWelcome(false)}
              className="h-12 px-8 rounded-xl bg-[#0D9488] text-white font-gmarket font-bold text-sm
                active:scale-95 transition-transform"
            >
              시작하기
            </button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-b from-[#F0FDFA] to-[#CCFBF1] pb-12">
        {/* ===== Sticky Compass Section ===== */}
        <div
          className={`
            sticky top-0 z-30 transition-all duration-500
            ${phase === 'result' ? 'bg-[#F0FDFA]/80 backdrop-blur-md shadow-sm' : ''}
          `}
        >
          <div className="flex flex-col items-center pt-6 pb-4 px-4">
            {/* Narin mascot */}
            <div
              className={`
                transition-all duration-700 ease-out relative
                ${phase === 'idle' ? 'w-[100px] h-[100px]' : 'w-[56px] h-[56px]'}
                ${phase === 'idle' ? 'animate-breathe' : ''}
              `}
            >
              <img
                src={mascotSrc}
                alt="나린"
                className={`
                  w-full h-full mascot-img
                  ${phase === 'spinning' ? 'animate-float' : ''}
                `}
              />
            </div>

            {/* Title + greeting (idle only) */}
            {phase === 'idle' && (
              <div className="text-center mt-3 animate-fadeIn">
                <h1 className="text-2xl font-bold text-gray-800 font-gmarket">
                  운명의 나침반
                </h1>
                <p className="text-sm text-gray-700 mt-1">{getTimeGreeting()}</p>
              </div>
            )}

            {/* CompassRose SVG */}
            <div
              className={`
                relative mt-4 transition-all duration-700 ease-out
                ${phase === 'result' ? 'w-[160px] h-[160px]' : 'w-[260px] h-[260px]'}
                ${phase === 'idle' ? 'compass-tap-area compass-idle-ring' : ''}
              `}
              onClick={phase === 'idle' ? handleCompassTap : undefined}
              role={phase === 'idle' ? 'button' : undefined}
              tabIndex={phase === 'idle' ? 0 : undefined}
              aria-label={phase === 'idle' ? '나침반 탭해서 돌리기' : undefined}
            >
              <svg viewBox="0 0 300 300" className="w-full h-full">
                {/* Outer rings */}
                <circle
                  cx="150" cy="150" r="140"
                  fill="none" stroke="#E5E7EB" strokeWidth="1"
                  strokeDasharray={phase === 'idle' ? '4 3' : 'none'}
                />
                <circle
                  cx="150" cy="150" r="135"
                  fill="none" stroke="#D1D5DB" strokeWidth="2"
                />
                <circle
                  cx="150" cy="150" r="120"
                  fill="none" stroke="#E5E7EB" strokeWidth="1"
                />

                {/* 8-direction tick marks */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
                  const rad = (angle * Math.PI) / 180;
                  const r1 = angle % 90 === 0 ? 118 : 125;
                  const r2 = 135;
                  return (
                    <line
                      key={angle}
                      x1={150 + r1 * Math.sin(rad)}
                      y1={150 - r1 * Math.cos(rad)}
                      x2={150 + r2 * Math.sin(rad)}
                      y2={150 - r2 * Math.cos(rad)}
                      stroke="#9CA3AF"
                      strokeWidth={angle % 90 === 0 ? 2 : 1}
                    />
                  );
                })}

                {/* 4 directional circles (N/E/S/W) */}
                {DIRECTION_LABELS.map(({ id, angle, label }) => {
                  const dir = DIRECTIONS[id];
                  const rad = (angle * Math.PI) / 180;
                  const cx = 150 + 95 * Math.sin(rad);
                  const cy = 150 - 95 * Math.cos(rad);
                  const isActive = activeDir?.id === id && phase === 'result';
                  return (
                    <g key={id}>
                      <circle
                        cx={cx} cy={cy}
                        r={isActive ? 22 : 18}
                        fill={isActive ? dir.color : '#F3F4F6'}
                        stroke={dir.color}
                        strokeWidth={isActive ? 2 : 1}
                        opacity={isSpinningOrResult && !isActive ? 0.15 : isActive ? 1 : 0.3}
                        className="transition-all duration-500"
                      />
                      {isActive && (
                        <circle
                          cx={cx} cy={cy} r={28}
                          fill="none" stroke={dir.color} strokeWidth="2" opacity="0.4"
                          className="animate-pulse"
                        />
                      )}
                      <text
                        x={cx} y={cy + 1}
                        textAnchor="middle" dominantBaseline="central"
                        fill={isActive ? '#FFFFFF' : dir.color}
                        fontSize={isActive ? '14' : '12'}
                        fontWeight="bold"
                        opacity={isSpinningOrResult && !isActive ? 0.15 : isActive ? 1 : 0.3}
                        className="transition-all duration-500"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Center: decorative pivot */}
                <circle cx="150" cy="150" r="15" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" />
                <circle cx="150" cy="150" r="8" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1" />

                {/* #6: Needle — idle에서도 희미하게 표시 */}
                <g
                  ref={needleRef}
                  style={{
                    transformOrigin: '150px 150px',
                    opacity: phase === 'idle' ? 0.15 : 1,
                    transition: 'opacity 0.3s',
                  }}
                >
                  <line
                    x1="150" y1="150" x2="150" y2="60"
                    stroke={activeDir?.color ?? '#0D9488'}
                    strokeWidth="3" strokeLinecap="round"
                  />
                  <polygon
                    points="150,52 145,65 155,65"
                    fill={activeDir?.color ?? '#0D9488'}
                  />
                  <circle
                    cx="150" cy="150" r="5"
                    fill={activeDir?.color ?? '#0D9488'}
                  />
                </g>
              </svg>

              {/* Sparkle particles during spinning */}
              <SparkleParticles active={phase === 'spinning'} />

              {/* Ripple effect */}
              {showRipple && (
                <div className="ripple-overlay">
                  <div className="ripple-circle" />
                </div>
              )}

              {/* Idle CTA */}
              {phase === 'idle' && (
                <div className="absolute -bottom-2 left-0 right-0 flex justify-center animate-ctaPulse">
                  <span className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-[#0D9488]/10 border border-[#0D9488]/20 text-sm text-[#0D9488] font-gmarket font-bold">
                    <span className="text-base">👆</span> 나침반을 눌러보세요!
                  </span>
                </div>
              )}
            </div>

            {/* Spin message */}
            {phase === 'spinning' && (
              <p className="text-sm text-gray-600 mt-3 animate-fadeIn font-gmarket">
                {spinMsg}
              </p>
            )}

            {/* Found message */}
            {phase === 'result' && activeDir && (
              <p className="text-sm text-[#0D9488] font-medium mt-2 animate-fadeIn font-gmarket">
                {NARIN_SPEECH.found(activeDir.name)}
              </p>
            )}
          </div>
        </div>

        {/* ===== Result Section ===== */}
        {/* #4: 카드 순서 변경 — 방위→여행지→서브→시나리오→팁 */}
        {phase === 'result' && result && (
          <div ref={resultRef} className="px-5 mt-4" style={{ scrollMarginTop: '320px' }}>
            {/* Direction Stamp */}
            <div className="flex flex-col items-center py-6 animate-stampPress">
              <div
                className="w-[140px] h-[140px] rounded-full border-4 border-dashed flex flex-col items-center justify-center"
                style={{ borderColor: result.direction.color }}
              >
                <DirectionStampIcon id={result.direction.id} size={48} color={result.direction.color} />
                <span
                  className="text-lg font-bold font-gmarket mt-1"
                  style={{ color: result.direction.color }}
                >
                  {result.direction.name}쪽
                </span>
              </div>
              <p className="text-base font-bold text-gray-800 mt-4 font-gmarket">
                오늘의 방위
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {result.direction.name}쪽 · {result.direction.theme}
              </p>
            </div>

            {/* Main spot — 시나리오보다 위로 */}
            <div className="animate-slideUp" style={{ animationDelay: '0.1s' }}>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-gmarket mb-1">
                  추천 여행지
                </p>
                <p className="text-lg font-bold text-gray-800 font-gmarket">
                  {result.dataSet.mainSpot.name}
                </p>
                <span
                  className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-gmarket"
                  style={{
                    backgroundColor: `${result.direction.color}15`,
                    color: result.direction.color,
                  }}
                >
                  {result.dataSet.mainSpot.tag}
                </span>
              </div>
            </div>

            {/* Sub spot */}
            <div className="mt-3 animate-slideUp" style={{ animationDelay: '0.2s' }}>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-gmarket mb-1">
                  함께 가면 좋은 곳
                </p>
                <p className="text-lg font-bold text-gray-800 font-gmarket">
                  {result.dataSet.subSpot.name}
                </p>
                <span
                  className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-gmarket"
                  style={{
                    backgroundColor: `${result.direction.color}15`,
                    color: result.direction.color,
                  }}
                >
                  {result.dataSet.subSpot.tag}
                </span>
              </div>
            </div>

            {/* Scenario — 여행지 아래로 이동 */}
            <div className="mt-4 animate-slideUp" style={{ animationDelay: '0.3s' }}>
              <div className="bg-gradient-to-b from-[#FFFBEB] to-[#FEF3C7] rounded-2xl p-5 border border-[#F59E0B]/20">
                <div className="h-px bg-gradient-to-r from-transparent via-[#D97706]/30 to-transparent mb-4" />
                <div className="flex gap-3 items-start">
                  <img
                    src={MASCOT.guiding}
                    alt="나린"
                    className="w-[48px] h-[48px] mascot-img shrink-0"
                  />
                  <div>
                    <p className="text-xs text-[#92400E] font-gmarket mb-2">
                      나린의 여행 시나리오
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed font-gmarket">
                      &ldquo;{result.dataSet.scenario}&rdquo;
                    </p>
                  </div>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-[#D97706]/30 to-transparent mt-4" />
              </div>
            </div>

            {/* Narin tip */}
            <div className="mt-4 animate-slideUp" style={{ animationDelay: '0.4s' }}>
              <div className="flex gap-3 items-start">
                <img
                  src={MASCOT.thinking}
                  alt="나린"
                  className="w-[48px] h-[48px] mascot-img shrink-0"
                />
                <div className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative">
                  <div className="absolute left-[-8px] top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-white" />
                  <p className="text-xs text-gray-500 font-gmarket mb-1">
                    나린의 여행 팁
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed font-gmarket">
                    {result.dataSet.narinTip}
                  </p>
                </div>
              </div>
            </div>

            {/* Premium: Hidden Gem (AD) */}
            <div className="mt-5 animate-slideUp" style={{ animationDelay: '0.5s' }}>
              {hiddenGemUnlocked ? (
                <div className="bg-gradient-to-br from-[#FFFBEB] to-white rounded-2xl p-5 border border-[#F59E0B]/20">
                  <p className="text-xs text-[#92400E] font-gmarket mb-1">
                    숨은 명소 추천
                  </p>
                  <p className="text-lg font-bold text-gray-800 font-gmarket">
                    {result.dataSet.hiddenGem.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 font-gmarket">
                    {result.dataSet.hiddenGem.desc}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <img
                      src={MASCOT.happy}
                      alt="나린"
                      className="w-[28px] h-[28px] mascot-img"
                    />
                    <p className="text-sm font-bold text-gray-700 font-gmarket">
                      숨은 명소 추천
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3 font-gmarket">
                    크르릉~ 아는 사람만 아는 비밀 여행지를 알려줄 거래요!
                  </p>
                  <button
                    onClick={handleUnlockHiddenGem}
                    disabled={adLoading}
                    className="w-full h-12 rounded-xl bg-gray-200 text-gray-600 text-sm font-gmarket
                      flex items-center justify-center gap-2
                      disabled:opacity-40 active:scale-[0.98] transition-transform"
                  >
                    <span className="ad-badge">AD</span>
                    <span>광고 보고 명소 확인</span>
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2 font-gmarket">
                    광고 시청 후 열람할 수 있어요
                  </p>
                </div>
              )}
            </div>

            {/* Share + Retry */}
            <div className="mt-5 flex gap-3 animate-slideUp" style={{ animationDelay: '0.6s' }}>
              <button
                onClick={handleShare}
                className="flex-1 h-12 rounded-xl bg-[#0D9488] text-white font-gmarket font-bold text-sm
                  flex items-center justify-center gap-2
                  active:scale-[0.98] transition-transform"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>공유하기</span>
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 h-12 rounded-xl bg-white border border-gray-200 text-gray-700 font-gmarket font-bold text-sm
                  flex items-center justify-center gap-2
                  active:scale-[0.98] transition-transform"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                <span>다시 돌리기</span>
              </button>
            </div>
            <p className="text-center text-xs text-gray-500 mt-2 mb-4 font-gmarket">
              {NARIN_SPEECH.retry}
            </p>
          </div>
        )}

        {/* #8: Footer — idle일 때 내일의 방위 티저 */}
        {phase === 'idle' && (
          <div className="text-center mt-8 px-5">
            <p className="text-xs text-gray-600 font-gmarket">
              나린과 나침반이 오늘의 여행지를 찾아줄 거래요~
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-gray-100">
              <span className="text-xs text-gray-500 font-gmarket">내일의 방위 힌트</span>
              <span className="text-sm font-bold text-[#0D9488] font-gmarket">{tomorrowDir}쪽</span>
              <span className="text-xs text-gray-400">?</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default App;
