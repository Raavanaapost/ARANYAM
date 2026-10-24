import type { ReactNode } from "react";

/**
 * Calm illustrated scenes for the slideshows, drawn in the logo's colours:
 * soft skies, layered hills, round trees and faceless figures. They show no
 * real people, so no family's privacy is ever at stake. Each scene is a mood
 * (the sky and light) and a motif (what is happening on the ground).
 *
 * The drawing is 1200 x 600 and is cropped to fill its box, so everything
 * important sits between x = 520 and x = 960: on wide screens the slide text
 * covers the left side, and phones show only the middle.
 */
export type Mood = "dawn" | "morning" | "golden" | "dusk" | "night" | "mist";
export type Motif =
  | "family"
  | "path"
  | "kite"
  | "gathering"
  | "forest"
  | "circle"
  | "sunrise"
  | "home"
  | "sapling"
  | "bench"
  | "lake"
  | "book"
  | "birds"
  | "bridge"
  | "lanterns"
  | "stars";

const FIGURE = {
  green: "#2f6e4a",
  teal: "#2f8f7d",
  yellow: "#e3a531",
  orange: "#d5703a",
  coral: "#e3876a",
  plum: "#866aa6",
};
const LEAVES = ["#5f9452", "#7fa95a", "#4b8456", "#98bd63", "#6a9e6e"];
const TRUNK = "#7a5a3c";

type Palette = {
  sky: [string, string, string];
  sun: string;
  hills: [string, string, string];
  ground: string;
  cloud: string;
  water: string;
};

const MOODS: Record<Mood, Palette> = {
  dawn: {
    sky: ["#e7ddf0", "#f7dfd3", "#fcefe2"],
    sun: "#f6bd8c",
    hills: ["#d9d2e5", "#bcd1bf", "#93b79a"],
    ground: "#7ba685",
    cloud: "#fff8f4",
    water: "#c9d9e3",
  },
  morning: {
    sky: ["#d3e7ef", "#e7f1ee", "#f8f5ea"],
    sun: "#fbe0a0",
    hills: ["#cfe0dc", "#abcbb1", "#85af8e"],
    ground: "#6e9d78",
    cloud: "#ffffff",
    water: "#b9d8dc",
  },
  golden: {
    sky: ["#f4ddb3", "#f9e9d0", "#fcf5e8"],
    sun: "#f4bf58",
    hills: ["#e7dcc0", "#c4cf9f", "#97b27c"],
    ground: "#7f9f68",
    cloud: "#fffaf0",
    water: "#cddbd2",
  },
  dusk: {
    sky: ["#c7bee2", "#ebc6d0", "#f8e0d1"],
    sun: "#f1a384",
    hills: ["#c2bcd8", "#a6b9b0", "#7f9e8c"],
    ground: "#6b8c7a",
    cloud: "#fbeef0",
    water: "#c3c4dd",
  },
  night: {
    sky: ["#1d2744", "#323f69", "#56618a"],
    sun: "#f6efd2",
    hills: ["#3c486a", "#2e4949", "#24403a"],
    ground: "#1f3a33",
    cloud: "#5d6890",
    water: "#3a4a72",
  },
  mist: {
    sky: ["#dde8e5", "#ebf1ed", "#f7f5ee"],
    sun: "#f5e4c0",
    hills: ["#d3e0db", "#b5cdbf", "#94b8a0"],
    ground: "#79a587",
    cloud: "#ffffff",
    water: "#c3dad8",
  },
};

/** Where the sun (or moon) sits for each motif, so it never hides the figures. */
const SUN: Record<Motif, { x: number; y: number; r: number }> = {
  family: { x: 900, y: 150, r: 46 },
  path: { x: 776, y: 280, r: 40 },
  kite: { x: 300, y: 140, r: 44 },
  gathering: { x: 980, y: 120, r: 40 },
  forest: { x: 780, y: 170, r: 54 },
  circle: { x: 980, y: 150, r: 42 },
  sunrise: { x: 740, y: 335, r: 80 },
  home: { x: 960, y: 150, r: 46 },
  sapling: { x: 740, y: 230, r: 70 },
  bench: { x: 600, y: 160, r: 44 },
  lake: { x: 760, y: 300, r: 50 },
  book: { x: 960, y: 140, r: 44 },
  birds: { x: 560, y: 170, r: 52 },
  bridge: { x: 900, y: 150, r: 44 },
  lanterns: { x: 980, y: 110, r: 36 },
  stars: { x: 930, y: 120, r: 40 },
};

const STARS = [
  [80, 60], [170, 140], [260, 40], [340, 110], [430, 70], [520, 150], [600, 50], [660, 120],
  [720, 40], [800, 90], [870, 40], [1040, 70], [1110, 150], [1160, 50], [980, 190], [380, 200],
  [130, 230], [560, 230], [1080, 240], [700, 200], [240, 280], [460, 260], [830, 250], [1000, 300],
];

/* ------------------------------------------------------------------ parts */

function Person({ x, y, s = 1, color, seated = false }: { x: number; y: number; s?: number; color: string; seated?: boolean }) {
  const bodyH = (seated ? 52 : 80) * s;
  const w = 25 * s;
  const r = 16.5 * s;
  const top = y - bodyH;
  return (
    <g fill={color}>
      <path
        d={`M${x - w} ${y} C${x - w} ${top + bodyH * 0.25} ${x - w * 0.62} ${top} ${x} ${top} C${x + w * 0.62} ${top} ${x + w} ${top + bodyH * 0.25} ${x + w} ${y} Z`}
      />
      <circle cx={x} cy={top - r - 5 * s} r={r} />
    </g>
  );
}

/** Two people holding hands: a soft curve between their shoulders. */
function Hands({ x1, x2, y, color, s = 1 }: { x1: number; x2: number; y: number; color: string; s?: number }) {
  const mid = (x1 + x2) / 2;
  return (
    <path
      d={`M${x1} ${y} Q${mid} ${y + 22 * s} ${x2} ${y}`}
      fill="none"
      stroke={color}
      strokeWidth={8 * s}
      strokeLinecap="round"
    />
  );
}

function Tree({ x, y, s = 1, leaf = LEAVES[0], tall = false }: { x: number; y: number; s?: number; leaf?: string; tall?: boolean }) {
  const h = (tall ? 110 : 90) * s;
  return (
    <g>
      <path d={`M${x - 7 * s} ${y} L${x - 4 * s} ${y - h} L${x + 4 * s} ${y - h} L${x + 7 * s} ${y} Z`} fill={TRUNK} />
      {tall ? (
        <>
          <ellipse cx={x} cy={y - h - 40 * s} rx={38 * s} ry={75 * s} fill={leaf} />
          <ellipse cx={x - 10 * s} cy={y - h - 60 * s} rx={14 * s} ry={34 * s} fill="#ffffff" opacity={0.12} />
        </>
      ) : (
        <>
          <circle cx={x - 36 * s} cy={y - h + 4 * s} r={36 * s} fill={leaf} />
          <circle cx={x + 36 * s} cy={y - h + 2 * s} r={38 * s} fill={leaf} />
          <circle cx={x} cy={y - h - 34 * s} r={50 * s} fill={leaf} />
          <circle cx={x - 16 * s} cy={y - h - 50 * s} r={20 * s} fill="#ffffff" opacity={0.13} />
        </>
      )}
    </g>
  );
}

function Cloud({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <g fill={color} opacity={0.8}>
      <ellipse cx={x} cy={y} rx={70 * s} ry={20 * s} />
      <ellipse cx={x - 22 * s} cy={y - 14 * s} rx={30 * s} ry={22 * s} />
      <ellipse cx={x + 18 * s} cy={y - 20 * s} rx={36 * s} ry={28 * s} />
    </g>
  );
}

function Bird({ x, y, s = 1, color = "#55625d" }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <path
      d={`M${x - 16 * s} ${y} Q${x - 8 * s} ${y - 10 * s} ${x} ${y} Q${x + 8 * s} ${y - 10 * s} ${x + 16 * s} ${y}`}
      fill="none"
      stroke={color}
      strokeWidth={3 * s}
      strokeLinecap="round"
    />
  );
}

function Heart({ x, y, k, color = FIGURE.coral }: { x: number; y: number; k: number; color?: string }) {
  return (
    <path
      d={`M${x} ${y + k * 0.9} C${x - k * 1.6} ${y - k * 0.2} ${x - k * 0.6} ${y - k * 1.3} ${x} ${y - k * 0.4} C${x + k * 0.6} ${y - k * 1.3} ${x + k * 1.6} ${y - k * 0.2} ${x} ${y + k * 0.9} Z`}
      fill={color}
    />
  );
}

/** Points along a quadratic curve, for strings of lights. */
function along(p0: [number, number], p1: [number, number], p2: [number, number], count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  });
}

/* ----------------------------------------------------------------- motifs */

function Motifs({ motif, p, uid }: { motif: Motif; p: Palette; uid: string }): ReactNode {
  switch (motif) {
    case "family":
      return (
        <>
          <Tree x={540} y={500} s={1.1} leaf={LEAVES[2]} />
          <Tree x={950} y={490} s={1.25} leaf={LEAVES[0]} />
          <Hands x1={665} x2={702} y={430} color={FIGURE.green} />
          <Hands x1={713} x2={745} y={455} color={FIGURE.yellow} s={0.7} />
          <Hands x1={757} x2={790} y={430} color={FIGURE.orange} />
          <Person x={648} y={505} color={FIGURE.green} />
          <Person x={712} y={505} s={0.66} color={FIGURE.yellow} />
          <Person x={760} y={505} s={0.7} color={FIGURE.teal} />
          <Person x={806} y={505} color={FIGURE.orange} />
          <Heart x={728} y={330} k={16} />
        </>
      );
    case "path":
      return (
        <>
          <path
            d="M590 600 C690 545 870 525 800 470 S715 420 770 392 L784 392 C750 424 828 452 822 476 S770 545 850 600 Z"
            fill="#f4e7cf"
            opacity={0.95}
          />
          <Tree x={560} y={520} s={0.9} leaf={LEAVES[1]} />
          <Tree x={950} y={520} s={1} leaf={LEAVES[2]} tall />
          <Tree x={1040} y={500} s={0.8} leaf={LEAVES[0]} />
          <Hands x1={786} x2={804} y={452} color={FIGURE.teal} s={0.5} />
          <Person x={778} y={482} s={0.5} color={FIGURE.teal} />
          <Person x={810} y={482} s={0.36} color={FIGURE.yellow} />
          <Person x={760} y={438} s={0.3} color={FIGURE.orange} />
        </>
      );
    case "kite":
      return (
        <>
          <Cloud x={640} y={150} s={0.9} color={p.cloud} />
          <Cloud x={1080} y={230} s={0.7} color={p.cloud} />
          <path d="M730 418 C800 360 860 280 905 230" fill="none" stroke="#6b5b4b" strokeWidth={2} />
          <path d="M905 140 L942 188 L905 240 L868 188 Z" fill={FIGURE.orange} />
          <path d="M905 140 L905 240 M868 188 L942 188" stroke="#fbe3c8" strokeWidth={3} />
          <path d="M905 240 C890 270 925 290 905 320 S890 360 910 385" fill="none" stroke={FIGURE.coral} strokeWidth={3} />
          <Heart x={898} y={282} k={6} color={FIGURE.yellow} />
          <Heart x={906} y={352} k={6} color={FIGURE.teal} />
          <Tree x={540} y={510} s={1} leaf={LEAVES[3]} />
          <Person x={668} y={510} color={FIGURE.plum} />
          <path d="M716 448 L732 416" stroke={FIGURE.yellow} strokeWidth={6} strokeLinecap="round" />
          <Person x={712} y={510} s={0.66} color={FIGURE.yellow} />
          <Hands x1={683} x2={704} y={460} color={FIGURE.plum} s={0.7} />
        </>
      );
    case "gathering": {
      const bulbs = along([500, 290], [735, 400], [970, 280], 13);
      const colours = [FIGURE.yellow, FIGURE.coral, "#f5d88a", FIGURE.teal];
      return (
        <>
          <Tree x={490} y={500} s={1.35} leaf={LEAVES[2]} />
          <Tree x={985} y={495} s={1.3} leaf={LEAVES[0]} />
          <path d="M500 290 Q735 400 970 280" fill="none" stroke="#6b5b4b" strokeWidth={2} />
          {bulbs.map(([bx, by], i) => (
            <g key={i}>
              <circle cx={bx} cy={by + 9} r={14} fill={colours[i % 4]} opacity={0.25} />
              <circle cx={bx} cy={by + 9} r={6} fill={colours[i % 4]} />
            </g>
          ))}
          <ellipse cx={740} cy={508} rx={170} ry={24} fill="#f2dcaf" />
          <path d="M600 500 L880 500 M590 512 L890 512" stroke="#e6c88d" strokeWidth={4} />
          <Person x={612} y={500} color={FIGURE.green} />
          <Person x={672} y={505} s={0.6} color={FIGURE.yellow} seated />
          <Person x={735} y={505} s={0.85} color={FIGURE.coral} seated />
          <Person x={800} y={505} s={0.6} color={FIGURE.teal} seated />
          <Person x={866} y={500} color={FIGURE.orange} />
        </>
      );
    }
    case "forest":
      return (
        <>
          <Tree x={470} y={470} s={0.8} leaf={LEAVES[4]} tall />
          <Tree x={560} y={500} s={1.2} leaf={LEAVES[0]} />
          <Tree x={660} y={460} s={0.75} leaf={LEAVES[3]} tall />
          <Tree x={890} y={470} s={0.85} leaf={LEAVES[1]} tall />
          <Tree x={980} y={505} s={1.3} leaf={LEAVES[2]} />
          <Tree x={1090} y={480} s={0.9} leaf={LEAVES[4]} />
          <Tree x={800} y={445} s={0.6} leaf={LEAVES[0]} />
          <Person x={740} y={512} s={0.6} color={FIGURE.green} />
          <Person x={772} y={512} s={0.42} color={FIGURE.yellow} />
          <Person x={800} y={512} s={0.6} color={FIGURE.orange} />
          <Hands x1={748} x2={766} y={480} color={FIGURE.green} s={0.45} />
          <Hands x1={779} x2={792} y={480} color={FIGURE.orange} s={0.45} />
        </>
      );
    case "circle":
      return (
        <>
          <Tree x={740} y={455} s={1.9} leaf={LEAVES[0]} />
          <ellipse cx={740} cy={500} rx={190} ry={30} fill="#e9d8b4" opacity={0.9} />
          <Person x={640} y={482} s={0.55} color={FIGURE.teal} seated />
          <Person x={705} y={478} s={0.55} color={FIGURE.yellow} seated />
          <Person x={775} y={478} s={0.55} color={FIGURE.plum} seated />
          <Person x={840} y={482} s={0.55} color={FIGURE.coral} seated />
          <Person x={590} y={520} s={0.75} color={FIGURE.green} seated />
          <Person x={890} y={520} s={0.75} color={FIGURE.orange} seated />
        </>
      );
    case "sunrise":
      return (
        <>
          {Array.from({ length: 9 }, (_, i) => {
            const angle = Math.PI + (i + 1) * (Math.PI / 10);
            return (
              <line
                key={i}
                x1={740 + Math.cos(angle) * 110}
                y1={335 + Math.sin(angle) * 110}
                x2={740 + Math.cos(angle) * 200}
                y2={335 + Math.sin(angle) * 200}
                stroke={p.sun}
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.5}
              />
            );
          })}
          <Bird x={560} y={180} s={0.9} />
          <Bird x={600} y={160} s={0.7} />
          <Bird x={920} y={190} s={0.8} />
          <Tree x={540} y={505} s={0.95} leaf={LEAVES[2]} />
          <Tree x={960} y={500} s={1.05} leaf={LEAVES[0]} />
          <Hands x1={707} x2={725} y={455} color={FIGURE.green} s={0.6} />
          <Hands x1={753} x2={772} y={455} color={FIGURE.orange} s={0.6} />
          <Person x={696} y={500} s={0.75} color={FIGURE.green} />
          <Person x={740} y={500} s={0.5} color={FIGURE.yellow} />
          <Person x={784} y={500} s={0.75} color={FIGURE.orange} />
        </>
      );
    case "home":
      return (
        <>
          <Tree x={570} y={495} s={1.15} leaf={LEAVES[2]} />
          <Tree x={920} y={490} s={1.2} leaf={LEAVES[1]} />
          <path d="M740 600 C720 560 760 530 740 492" stroke="#f3e5c9" strokeWidth={30} fill="none" />
          <rect x={672} y={382} width={136} height={112} rx={6} fill="#fbf2e2" />
          <path d="M652 392 L740 318 L828 392" fill="none" stroke="#d98a2b" strokeWidth={13} strokeLinejoin="round" strokeLinecap="round" />
          <g fill="#e09a3a">
            <rect x={716} y={400} width={14} height={14} rx={2} />
            <rect x={734} y={400} width={14} height={14} rx={2} />
            <rect x={716} y={418} width={14} height={14} rx={2} />
            <rect x={734} y={418} width={14} height={14} rx={2} />
          </g>
          <rect x={724} y={448} width={32} height={46} rx={14} fill={FIGURE.teal} />
          <Heart x={740} y={270} k={14} />
          <Person x={640} y={512} s={0.55} color={FIGURE.orange} />
          <Person x={842} y={512} s={0.45} color={FIGURE.yellow} />
        </>
      );
    case "sapling":
      return (
        <>
          <g fill="#5f9a4f">
            <path d="M628 600 C590 530 630 470 730 462 C696 482 668 524 676 600 Z" />
            <path d="M628 600 C590 530 630 470 730 462 C696 482 668 524 676 600 Z" transform="translate(1480 0) scale(-1 1)" />
          </g>
          <ellipse cx={740} cy={466} rx={58} ry={16} fill="#8a6a4a" />
          <path d="M740 462 C742 430 736 400 740 360" stroke="#4f8a4a" strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M740 392 C700 392 684 366 690 344 C716 344 738 362 740 392 Z" fill={LEAVES[3]} />
          <path d="M740 372 C780 370 798 342 792 318 C764 320 742 340 740 372 Z" fill={LEAVES[1]} />
          <Heart x={740} y={300} k={10} color="#f3c7b4" />
        </>
      );
    case "bench":
      return (
        <>
          <Tree x={860} y={490} s={1.8} leaf={LEAVES[0]} />
          <rect x={672} y={476} width={150} height={9} rx={3} fill="#9a7550" />
          <rect x={672} y={446} width={150} height={7} rx={3} fill="#9a7550" />
          <path d="M684 485 L684 512 M810 485 L810 512" stroke="#7a5a3c" strokeWidth={7} />
          <Person x={718} y={476} s={0.8} color={FIGURE.teal} seated />
          <Person x={776} y={476} s={0.8} color={FIGURE.coral} seated />
          <Bird x={600} y={250} s={0.8} />
          <Bird x={640} y={225} s={0.6} />
        </>
      );
    case "lake":
      return (
        <>
          <Tree x={560} y={430} s={0.7} leaf={LEAVES[2]} tall />
          <Tree x={620} y={432} s={0.6} leaf={LEAVES[0]} />
          <Tree x={1000} y={430} s={0.75} leaf={LEAVES[4]} tall />
          <path d="M380 440 C560 425 900 425 1200 445 L1200 560 C900 590 600 590 380 560 Z" fill={p.water} />
          <path d="M700 470 L820 470 M670 500 L850 500 M720 530 L800 530" stroke={p.sun} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
          <path d="M880 480 L960 480 L948 498 L892 498 Z" fill="#9a7550" />
          <path d="M920 480 L920 430 L950 476 Z" fill="#fbf2e2" />
          <Person x={560} y={540} s={0.6} color={FIGURE.green} seated />
          <Person x={600} y={540} s={0.45} color={FIGURE.yellow} seated />
        </>
      );
    case "book":
      return (
        <>
          <ellipse cx={740} cy={520} rx={170} ry={18} fill="#000000" opacity={0.08} />
          <path d="M740 505 C690 485 620 485 575 500 L575 430 C620 415 690 415 740 435 Z" fill="#fdf8ee" />
          <path d="M740 505 C790 485 860 485 905 500 L905 430 C860 415 790 415 740 435 Z" fill="#f6eedd" />
          <path d="M740 435 L740 505" stroke="#d9c8a6" strokeWidth={3} />
          <path d="M600 450 C640 440 690 442 720 452 M600 468 C640 458 690 460 720 470 M760 452 C800 442 850 440 880 450" stroke="#d9c8a6" strokeWidth={3} fill="none" />
          {[
            [800, 370, 1.7],
            [870, 290, 1.45],
            [950, 225, 1.2],
            [1030, 180, 0.95],
            [690, 330, 1.05],
          ].map(([bx, by, k], i) => (
            <g key={i} transform={`translate(${bx} ${by}) scale(${k})`}>
              <path d="M-24 6 L0 -10 L26 4 L4 0 Z" fill="#ffffff" stroke="#c99a52" strokeWidth={2} strokeLinejoin="round" />
              <path d="M0 -10 L4 0 L-6 14 Z" fill="#f3e6cc" />
            </g>
          ))}
        </>
      );
    case "birds":
      return (
        <>
          <Cloud x={980} y={180} s={0.9} color={p.cloud} />
          {[
            [760, 200, 1.4], [810, 230, 1.2], [720, 240, 1.1], [860, 260, 1], [680, 280, 0.9], [900, 200, 0.9], [960, 240, 0.8],
          ].map(([bx, by, k], i) => (
            <Bird key={i} x={bx} y={by} s={k} />
          ))}
          <Tree x={570} y={500} s={1} leaf={LEAVES[1]} />
          <Person x={700} y={510} s={0.9} color={FIGURE.green} />
          <path d="M726 432 L752 396" stroke={FIGURE.green} strokeWidth={7} strokeLinecap="round" />
          <Person x={760} y={510} s={0.62} color={FIGURE.orange} />
          <path d="M774 466 L796 438" stroke={FIGURE.orange} strokeWidth={6} strokeLinecap="round" />
        </>
      );
    case "bridge":
      return (
        <>
          <path d="M700 410 C690 450 640 480 620 600 L880 600 C840 500 790 450 760 410 Z" fill={p.water} />
          <path d="M610 500 Q740 410 870 500" fill="none" stroke="#9a7550" strokeWidth={12} strokeLinecap="round" />
          <path d="M630 480 Q740 395 850 480" fill="none" stroke="#b08a60" strokeWidth={4} />
          <path d="M660 474 L660 458 M700 452 L700 432 M740 444 L740 424 M780 452 L780 432 M820 474 L820 458" stroke="#b08a60" strokeWidth={4} />
          <Tree x={540} y={500} s={1.1} leaf={LEAVES[2]} />
          <Tree x={960} y={500} s={1.15} leaf={LEAVES[0]} />
          <Hands x1={720} x2={758} y={420} color={FIGURE.teal} s={0.6} />
          <Person x={712} y={446} s={0.62} color={FIGURE.teal} />
          <Person x={768} y={446} s={0.62} color={FIGURE.coral} />
        </>
      );
    case "lanterns":
      return (
        <>
          {[
            [640, 300, 1], [720, 220, 0.8], [820, 260, 1.1], [900, 170, 0.7], [560, 190, 0.6], [1000, 240, 0.75], [770, 130, 0.55],
          ].map(([lx, ly, k], i) => (
            <g key={i} transform={`translate(${lx} ${ly}) scale(${k})`}>
              <circle r={40} fill="#f7c873" opacity={0.18} />
              <path d="M-16 -22 L16 -22 L20 18 C10 24 -10 24 -20 18 Z" fill="#f2a65a" />
              <path d="M-12 18 L12 18" stroke="#fde3a8" strokeWidth={4} />
            </g>
          ))}
          <Tree x={520} y={505} s={1.05} leaf="#2f5a48" />
          <Person x={690} y={515} s={0.85} color={FIGURE.teal} />
          <Person x={738} y={515} s={0.6} color={FIGURE.yellow} />
          <Person x={786} y={515} s={0.85} color={FIGURE.coral} />
          <Hands x1={709} x2={729} y={466} color={FIGURE.teal} s={0.6} />
          <Hands x1={747} x2={766} y={466} color={FIGURE.coral} s={0.6} />
        </>
      );
    case "stars":
      return (
        <>
          <Tree x={580} y={495} s={1.1} leaf="#2f5a48" />
          <Tree x={900} y={490} s={1.2} leaf="#355f4a" tall />
          <rect x={672} y={384} width={136} height={110} rx={6} fill="#e9dcc4" />
          <path d="M652 394 L740 320 L828 394" fill="none" stroke="#c9822c" strokeWidth={13} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={740} cy={430} r={48} fill={`url(#${uid}-window)`} />
          <rect x={712} y={405} width={56} height={48} rx={6} fill="#fbd27a" />
          <path d="M740 405 L740 453 M712 429 L768 429" stroke="#e9dcc4" strokeWidth={4} />
          <Heart x={740} y={290} k={11} color="#f2a65a" />
        </>
      );
  }
}

/* ------------------------------------------------------------------ scene */

export function Scene({
  mood,
  motif,
  uid,
  keepGround = false,
  className,
}: {
  mood: Mood;
  motif: Motif;
  uid: string;
  /** In wide, short boxes, crop the sky rather than the figures. */
  keepGround?: boolean;
  className?: string;
}) {
  const p = MOODS[mood];
  const sun = SUN[motif];
  const night = mood === "night";
  return (
    <svg
      viewBox="0 0 1200 600"
      preserveAspectRatio={keepGround ? "xMidYMax slice" : "xMidYMid slice"}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.55" stopColor={p.sky[1]} />
          <stop offset="1" stopColor={p.sky[2]} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={p.sun} stopOpacity={night ? 0.45 : 0.75} />
          <stop offset="1" stopColor={p.sun} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${uid}-window`}>
          <stop offset="0" stopColor="#fbd27a" stopOpacity={0.6} />
          <stop offset="1" stopColor="#fbd27a" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${uid}-haze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? "#56618a" : "#ffffff"} stopOpacity={0} />
          <stop offset="1" stopColor={night ? "#56618a" : "#ffffff"} stopOpacity={0.5} />
        </linearGradient>
      </defs>

      <rect width="1200" height="600" fill={`url(#${uid}-sky)`} />
      {night
        ? STARS.map(([sx, sy], i) => <circle key={i} cx={sx} cy={sy} r={i % 3 === 0 ? 2.6 : 1.6} fill="#fdf6dc" opacity={0.85} />)
        : null}
      <circle cx={sun.x} cy={sun.y} r={sun.r * 3.2} fill={`url(#${uid}-glow)`} />
      <circle cx={sun.x} cy={sun.y} r={sun.r} fill={p.sun} />
      {night ? <circle cx={sun.x + sun.r * 0.45} cy={sun.y - sun.r * 0.25} r={sun.r * 0.85} fill={p.sky[0]} /> : null}
      {night ? null : (
        <>
          <Cloud x={180} y={120} s={1} color={p.cloud} />
          <Cloud x={420} y={70} s={0.6} color={p.cloud} />
        </>
      )}

      <path d="M0 360 C200 300 400 330 600 315 S1000 290 1200 330 V600 H0 Z" fill={p.hills[0]} />
      <rect y="300" width="1200" height="160" fill={`url(#${uid}-haze)`} />
      <path d="M0 425 C250 375 450 405 700 385 S1050 365 1200 405 V600 H0 Z" fill={p.hills[1]} />
      <path d="M0 520 C250 470 520 482 760 472 S1100 482 1200 500 V600 H0 Z" fill={p.hills[2]} />

      <Motifs motif={motif} p={p} uid={uid} />

      <path d="M0 575 C300 555 700 570 1200 560 V600 H0 Z" fill={p.ground} opacity={0.7} />
    </svg>
  );
}
