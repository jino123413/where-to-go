# Animation Technology Research for "Where To Go" Mini-App

## Target Animations (Updated)
1. **Compass spin + 나린 orbit**: 나린 (divine bird mascot) flies in a circular orbit around the compass as it spins
2. **나린 landing**: Bird decelerates and lands, pointing at the target direction
3. **Glow effect**: Crown feather + chest compass pattern glow in the direction's color
4. **Result unfurl**: Scroll/cards appear below with staggered animation

---

## 1. Remotion Player Analysis

### What It Is
Remotion is a framework for creating videos programmatically using React. The `@remotion/player` package provides a `<Player>` component that can be embedded inline in any React app -- it renders compositions in real-time without exporting video files.

### Packages Required
- `remotion` (core)
- `@remotion/player` (inline player component)
- All `@remotion/*` packages must share the exact same version (no `^` prefix)

### React 18 Compatibility
- Fully compatible with React 18.2.0 (supported since Remotion 3.0+)
- Works correctly in React 18 strict mode

### Rsbuild Compatibility -- PROBLEM
- Remotion's `@remotion/bundler` is built on **Webpack** internally
- However, `@remotion/player` does NOT use `@remotion/bundler` at runtime -- it is a pure React component
- The Player component should work with any bundler (Rsbuild, Vite, etc.) since it's just React code
- The Webpack dependency only matters for server-side rendering/exporting, which we don't need
- **Verdict: Player-only usage should work with Rsbuild**, but this is not officially tested/documented

### Bundle Size -- CRITICAL CONCERN
- `@remotion/player` + `remotion` core: estimated **~150-200KB minified** (not gzipped)
- Remotion pulls in significant internals even for player-only usage
- The `remotion` core package includes timeline, sequencing, and composition infrastructure
- **No effective tree-shaking**: You cannot strip down to just animation primitives
- For a mini-app that should be lightweight, this is **too heavy**

### Playback Control API (If Used)
```typescript
const playerRef = useRef<PlayerRef>(null);

// Play/Pause/Seek
playerRef.current?.play();
playerRef.current?.pause();
playerRef.current?.seekTo(frame);
playerRef.current?.toggle();

// Completion callback
playerRef.current?.addEventListener('ended', () => {
  console.log('Animation complete');
});

// Frame tracking
playerRef.current?.addEventListener('timeupdate', (e) => {
  console.log('Current frame:', e.detail.frame);
});
```

### Verdict: NOT RECOMMENDED
- Too heavy for a mini-app (~150-200KB)
- Designed for video creation, not lightweight UI animations
- Overkill for our use case (compass spin, stamp effect, card reveal)
- Rsbuild compatibility untested
- Would add unnecessary complexity

---

## 2. Alternative Approaches

### Option A: Framer Motion (motion)

| Metric | Value |
|--------|-------|
| Bundle (full) | ~32KB gzipped |
| Bundle (LazyMotion) | ~4.6KB gzipped initial |
| Bundle (useAnimate mini) | ~2.3KB gzipped |
| React 18 support | Yes |
| Bundler agnostic | Yes (works with Rsbuild) |

**Pros:**
- Declarative animation API (`animate`, `variants`, `transition`)
- Built-in spring physics and easing functions
- `useAnimate` hook for imperative control
- Layout animations for card unfurling
- Path animations via SVG `motion.path`
- Lightweight with LazyMotion code-splitting
- Excellent React integration

**Cons:**
- Full bundle still 32KB if using all features
- Complex path animations (bird flight) need manual SVG path definition

**Compass Spin Example:**
```tsx
import { motion, useAnimate } from "framer-motion";

const [scope, animate] = useAnimate();

const spinCompass = async (targetAngle: number) => {
  // 3 full rotations + target
  const totalRotation = 360 * 3 + targetAngle;
  await animate(scope.current,
    { rotate: totalRotation },
    { duration: 4, ease: [0.2, 0.8, 0.2, 1] } // custom deceleration curve
  );
  // Animation complete callback is implicit (await resolves)
};
```

### Option B: GSAP (GreenSock)

| Metric | Value |
|--------|-------|
| Bundle (core) | ~23KB gzipped |
| Bundle (core only, no plugins) | ~15KB gzipped |
| React 18 support | Yes (via @gsap/react) |
| Bundler agnostic | Yes |

**Pros:**
- Industry-standard animation engine
- Timeline sequencing (perfect for multi-step compass animation)
- MotionPath plugin for bird flight along Bezier curves
- Extremely performant (GPU-accelerated transforms)
- `useGSAP()` hook with automatic cleanup
- Fine-grained easing control (`Power4.easeOut`, custom curves)
- Modular imports (only load what you use)

**Cons:**
- Imperative API (less "React-like" than Framer Motion)
- Some advanced plugins require paid license (MotionPath is free)
- Slightly steeper learning curve

**Compass Spin Example:**
```tsx
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const compassRef = useRef<HTMLDivElement>(null);

const spinCompass = (targetAngle: number) => {
  const tl = gsap.timeline({
    onComplete: () => console.log("Animation done")
  });

  tl.to(compassRef.current, {
    rotation: 360 * 3 + targetAngle,
    duration: 4,
    ease: "power4.out", // natural deceleration
  });
};
```

### Option C: CSS Animations + requestAnimationFrame

| Metric | Value |
|--------|-------|
| Bundle | 0KB (native browser APIs) |
| React 18 support | N/A (vanilla JS) |
| Bundler agnostic | Yes |

**Pros:**
- Zero bundle cost
- GPU-accelerated CSS transforms
- Web Animations API for programmatic control
- Maximum performance

**Cons:**
- No declarative React integration
- Complex sequences require manual state management
- Path animations (bird flight) are very difficult
- Callback/completion handling requires manual implementation
- More boilerplate code
- Harder to maintain

**Compass Spin Example:**
```tsx
const spinCompass = (el: HTMLElement, targetAngle: number) => {
  const totalRotation = 360 * 3 + targetAngle;
  const animation = el.animate(
    [
      { transform: "rotate(0deg)" },
      { transform: `rotate(${totalRotation}deg)` }
    ],
    {
      duration: 4000,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fill: "forwards"
    }
  );

  return new Promise<void>((resolve) => {
    animation.onfinish = () => resolve();
  });
};
```

### Option D: Lottie (Pre-rendered Animations)

| Metric | Value |
|--------|-------|
| Bundle (lottie-web full) | ~82KB gzipped |
| Bundle (lottie_light) | ~40KB gzipped |
| Bundle (dotlottie-react, WASM) | ~15KB gzipped |
| React 18 support | Yes |

**Pros:**
- Designer-friendly (After Effects workflow)
- Beautiful, complex animations possible
- dotLottie format is very compact
- WASM renderer is performant

**Cons:**
- Requires pre-designed animation files (not code-driven)
- Cannot dynamically change target angle at runtime easily
- Compass must stop at a random angle -- hard to parameterize in Lottie
- Bird path would be fixed, not dynamic
- Requires external design tool (After Effects / LottieFiles)
- **Not suitable for our dynamic, data-driven animations**

---

## 3. Comparison Matrix

| Criteria | Remotion | Framer Motion | GSAP | CSS/rAF | Lottie |
|----------|----------|---------------|------|---------|--------|
| **Bundle size** | ~150KB+ | 4.6-32KB | 15-23KB | 0KB | 15-82KB |
| **Compass spin** | Overkill | Excellent | Excellent | Good | Poor (static) |
| **Bird flight path** | Good | Good (SVG) | Excellent | Hard | Good (static) |
| **Stamp effect** | Overkill | Excellent | Excellent | Good | Good |
| **Card unfurling** | Overkill | Excellent | Good | Medium | Poor |
| **React integration** | Good | Excellent | Good | Poor | Good |
| **Dynamic params** | Yes | Yes | Yes | Yes | Limited |
| **Completion callbacks** | Yes | Yes (await) | Yes | Manual | Yes |
| **Rsbuild compat** | Unknown | Yes | Yes | Yes | Yes |
| **Learning curve** | High | Low | Medium | Medium | Low (design) |
| **Mobile WebView perf** | Heavy | Good | Excellent | Best | Good |

---

## 4. Recommendation

### Primary: Framer Motion (LazyMotion + useAnimate)
### Fallback: GSAP (if more complex sequencing needed)

**Rationale:**

1. **Bundle size**: With LazyMotion, initial load is only ~4.6KB gzipped. Even full Framer Motion at 32KB is acceptable.

2. **Compass spin**: `useAnimate` provides imperative control with `await` for completion -- perfect for "spin then show result" flow. Custom cubic-bezier easing handles the deceleration naturally.

3. **Bird flight**: SVG `motion.path` with `pathLength` animation, or use `animate` with keyframes for position along a circular/elliptical path.

4. **Stamp effect**: Simple `scale` + `opacity` transition with spring physics for the "press" bounce.

5. **Card unfurling**: `AnimatePresence` + staggered `variants` for sequential card reveals with spring animations.

6. **React-native feel**: Declarative API with `motion.div` components feels natural in React 18.

7. **Rsbuild compatible**: Framework-agnostic, pure React components.

8. **Completion handling**: `useAnimate` returns a Promise that resolves on completion -- clean async flow.

### Implementation Strategy

```
npm install framer-motion
```

```tsx
// Lazy loading for minimal initial bundle
import { LazyMotion, domAnimation } from "framer-motion";

function App() {
  return (
    <LazyMotion features={domAnimation}>
      {/* All animated components here */}
    </LazyMotion>
  );
}
```

For the compass animation specifically:
```tsx
import { useAnimate } from "framer-motion";

function CompassAnimation({ targetDirection }: { targetDirection: number }) {
  const [compassRef, animate] = useAnimate();
  const [isSpinning, setIsSpinning] = useState(false);

  const spin = async () => {
    setIsSpinning(true);

    // Phase 1: Fast spin (3 full rotations + target)
    await animate(compassRef.current,
      { rotate: 360 * 3 + targetDirection },
      {
        duration: 3.5,
        ease: [0.15, 0.85, 0.25, 1.0], // strong deceleration
      }
    );

    // Phase 2: Settle/bounce at target
    await animate(compassRef.current,
      { rotate: [360 * 3 + targetDirection + 3, 360 * 3 + targetDirection] },
      { duration: 0.4, ease: "easeOut" }
    );

    setIsSpinning(false);
    // Ready to show results
  };

  return (
    <div ref={compassRef} onClick={spin}>
      {/* Compass SVG */}
    </div>
  );
}
```

### If GSAP is Needed Later

If bird flight paths or complex multi-element timelines prove too difficult with Framer Motion alone, GSAP can be added alongside it:
- Use Framer Motion for UI transitions (cards, stamps)
- Use GSAP for complex path animations (bird flight)
- Both can coexist in the same project
- GSAP's MotionPathPlugin handles Bezier curve following natively

---

## 5. Summary

| Decision | Choice | Reason |
|----------|--------|--------|
| **Use Remotion?** | No | Too heavy (~150KB+), designed for video not UI animation |
| **Primary library** | Framer Motion | 4.6-32KB, excellent React integration, async/await control |
| **Backup option** | GSAP | 15-23KB, superior timeline sequencing if needed |
| **For compass spin** | Framer Motion `useAnimate` | Custom easing + await completion |
| **For bird flight** | Framer Motion keyframes or GSAP MotionPath | Depends on path complexity |
| **For stamp effect** | Framer Motion spring | Natural bounce physics |
| **For card unfurling** | Framer Motion `AnimatePresence` + `variants` | Staggered children animation |

---

## 6. Detailed Implementation: 나린 (羅鱗) Mascot Animations

These patterns are specific to the "Where To Go" app's divine bird mascot.

### 6.1 Compass Spin + 나린 Orbit (Simultaneous)

나린 flies in a circular orbit around the compass while it spins. Both animations run in parallel, then 나린 decelerates and lands at the target direction.

```tsx
import { useAnimate, motion } from "framer-motion";
import { useState, useCallback } from "react";

interface AnimationProps {
  targetAngle: number;       // 0-359 degrees
  directionColor: string;    // e.g. "#E84545" for South/Fire
}

function CompassWithNarin({ targetAngle, directionColor }: AnimationProps) {
  const [compassRef, animateCompass] = useAnimate();
  const [birdRef, animateBird] = useAnimate();
  const [glowRef, animateGlow] = useAnimate();
  const [phase, setPhase] = useState<"idle" | "spinning" | "landing" | "result">("idle");

  const runAnimation = useCallback(async () => {
    if (phase !== "idle") return;
    setPhase("spinning");

    const totalRotation = 360 * 3 + targetAngle;

    // Phase 1: Compass spin + bird orbit (parallel)
    await Promise.all([
      // Compass spins with deceleration
      animateCompass(compassRef.current,
        { rotate: totalRotation },
        { duration: 3.5, ease: [0.15, 0.85, 0.25, 1.0] }
      ),
      // Bird orbits around compass center
      // Use keyframes for circular path: x and y follow sin/cos
      animateBird(birdRef.current,
        {
          // Orbit via CSS offset-path or manual x/y keyframes
          offsetDistance: ["0%", "100%", "200%", "300%"],
          scale: [1, 1.1, 1, 0.95, 1],
        },
        { duration: 3.5, ease: [0.15, 0.85, 0.25, 1.0] }
      ),
    ]);

    // Phase 2: Bird landing at target direction
    setPhase("landing");
    const landingX = Math.cos((targetAngle - 90) * Math.PI / 180) * 80; // 80px radius
    const landingY = Math.sin((targetAngle - 90) * Math.PI / 180) * 80;

    await animateBird(birdRef.current,
      {
        x: landingX,
        y: landingY,
        rotate: targetAngle,       // point toward direction
        scale: [1, 1.15, 1],       // slight bounce on landing
      },
      { duration: 0.6, ease: "easeOut" }
    );

    // Phase 3: Glow effect
    await animateGlow(glowRef.current,
      {
        opacity: [0, 0.8, 1],
        filter: [
          "drop-shadow(0 0 0px transparent)",
          `drop-shadow(0 0 12px ${directionColor})`,
          `drop-shadow(0 0 8px ${directionColor})`,
        ],
      },
      { duration: 0.8, ease: "easeOut" }
    );

    setPhase("result");
  }, [targetAngle, directionColor, phase]);

  return (
    <div className="relative w-[280px] h-[280px] flex items-center justify-center">
      {/* Compass */}
      <div ref={compassRef} className="compass-dial">
        {/* SVG compass face */}
      </div>

      {/* Bird on orbit path */}
      <div
        ref={birdRef}
        className="absolute"
        style={{
          offsetPath: "path('M 140,60 A 80,80 0 1,1 139.99,60')", // circular orbit
        }}
      >
        {/* 나린 SVG/image */}
        <div ref={glowRef} className="narin-glow-layer">
          {/* Crown feather + chest compass glow overlay */}
        </div>
      </div>
    </div>
  );
}
```

### 6.2 Circular Orbit: Two Approaches

**Approach A: CSS offset-path (Recommended)**
The simplest way to orbit an element on a circular path. Supported in all modern mobile WebViews.

```tsx
// Define circular path around compass center
const orbitStyle = {
  offsetPath: "circle(80px at 50% 50%)", // 80px radius orbit
  offsetRotate: "0deg",                   // bird faces forward, not tangent
};

// Animate along the path
await animateBird(birdRef.current,
  { offsetDistance: ["0%", "300%"] },  // 3 full orbits
  { duration: 3.5, ease: [0.15, 0.85, 0.25, 1.0] }
);
```

**Approach B: Manual x/y keyframes (Fallback)**
If offset-path has issues in Toss WebView:

```tsx
// Generate circular keyframe positions
function generateOrbitKeyframes(radius: number, orbits: number, steps: number) {
  const keyframes: { x: number; y: number }[] = [];
  const totalSteps = orbits * steps;
  for (let i = 0; i <= totalSteps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    keyframes.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }
  return keyframes;
}

const orbitPoints = generateOrbitKeyframes(80, 3, 36); // 80px, 3 orbits, 36 steps each
await animateBird(birdRef.current,
  {
    x: orbitPoints.map(p => p.x),
    y: orbitPoints.map(p => p.y),
  },
  { duration: 3.5, ease: [0.15, 0.85, 0.25, 1.0] }
);
```

### 6.3 Glow Effect: Crown Feather + Chest Compass

The glow uses CSS `filter: drop-shadow()` animated with Framer Motion. The glow color matches the direction (e.g., red=South, blue=North).

```tsx
// Direction color mapping
const DIRECTION_COLORS: Record<string, string> = {
  "N":  "#4A90D9", // blue
  "NE": "#7B68EE", // purple-blue
  "E":  "#50C878", // green
  "SE": "#FFD700", // gold
  "S":  "#E84545", // red
  "SW": "#FF8C42", // orange
  "W":  "#C0C0C0", // silver
  "NW": "#E6E6FA", // lavender
};

// Glow animation on specific SVG elements
const glowAnimation = async (color: string) => {
  // Crown feather glow
  await animateGlow(".crown-feather",
    {
      filter: [
        "drop-shadow(0 0 0px transparent)",
        `drop-shadow(0 0 16px ${color})`,
        `drop-shadow(0 0 10px ${color})`,
      ],
      opacity: [0.6, 1, 0.9],
    },
    { duration: 1.0, ease: "easeInOut" }
  );

  // Chest compass pattern glow (slightly delayed)
  await animateGlow(".chest-compass",
    {
      filter: `drop-shadow(0 0 8px ${color})`,
      opacity: [0.5, 1],
    },
    { duration: 0.6, ease: "easeOut" }
  );
};
```

**Alternative: CSS Custom Properties for Glow**
For smoother performance, use CSS variables animated via Framer Motion:

```css
.narin-glow {
  --glow-color: transparent;
  --glow-size: 0px;
  filter: drop-shadow(0 0 var(--glow-size) var(--glow-color));
  transition: filter 0.3s ease;
}
```

```tsx
// Animate CSS custom properties
birdEl.style.setProperty("--glow-color", directionColor);
await animateBird(birdRef.current,
  { "--glow-size": ["0px", "16px", "10px"] } as any,
  { duration: 1.0 }
);
```

### 6.4 Result Scroll/Cards Unfurling

After 나린 lands and glows, result cards appear below with a staggered unfurl effect.

```tsx
import { AnimatePresence, motion } from "framer-motion";

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 40,
    scaleY: 0.6,
    originY: 0,  // unfurl from top
  },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scaleY: 1,
    transition: {
      delay: i * 0.15,           // stagger each card
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94], // smooth unfurl
    },
  }),
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.2 },
  },
};

function ResultCards({ results, show }: { results: Result[]; show: boolean }) {
  return (
    <AnimatePresence>
      {show && results.map((result, i) => (
        <motion.div
          key={result.id}
          custom={i}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="result-card"
        >
          {/* Card content */}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
```

### 6.5 Full Animation Sequence Timeline

```
User taps compass
  |
  v
Phase 1: SPIN (3.5s)
  - Compass rotates: 3 full turns + target angle, ease: deceleration curve
  - 나린 orbits compass: circular path, synced with compass speed
  - Optional: subtle wing-flap via scale pulses [1, 1.05, 1, 1.05, 1]
  |
  v
Phase 2: LAND (0.6s)
  - 나린 breaks orbit, moves to target direction edge
  - Bird rotates to point at direction
  - Slight bounce on landing: scale [1, 1.15, 1]
  |
  v
Phase 3: GLOW (1.0s)
  - Crown feather glows in direction color (drop-shadow pulse)
  - Chest compass pattern illuminates (0.4s delay from crown)
  - Color intensifies then settles to steady glow
  |
  v
Phase 4: REVEAL (0.5s + stagger)
  - Result cards/scroll unfurl from top
  - Each card delayed 0.15s after previous
  - Cards slide up + scale from compressed height
  |
  v
Phase 5: IDLE
  - 나린 has subtle breathing animation (scale 1.0 <-> 1.02)
  - Glow gently pulses (opacity 0.85 <-> 1.0)
  - User can scroll results or tap again
```

Total animation time: ~5.5-6s (before user interaction with results)

### 6.6 Performance Notes for Toss WebView

- All transforms (`rotate`, `scale`, `x`, `y`) are GPU-accelerated
- `filter: drop-shadow()` can be expensive -- limit to 2-3 simultaneous glows
- Use `will-change: transform, filter` on animated elements
- Avoid animating `width`/`height` -- use `scale` instead
- `offset-path` is supported in Chrome 55+ (Toss WebView is Chromium-based)
- Test on low-end Android devices -- keep total animated elements under 10 simultaneous
