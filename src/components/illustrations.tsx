import { cn } from "@/lib/cn";

type Tree = { x: number; trunk: number; canopy: number; color: string; fruit?: boolean };

// Every tree is a different height and colour: each child grows in their own way.
const trees: Tree[] = [
  { x: 70, trunk: 48, canopy: 34, color: "#7fb89c" },
  { x: 150, trunk: 78, canopy: 48, color: "#2f7a5f", fruit: true },
  { x: 236, trunk: 36, canopy: 26, color: "#a9cf8f" },
  { x: 306, trunk: 96, canopy: 58, color: "#23634f", fruit: true },
  { x: 392, trunk: 56, canopy: 38, color: "#4f9c7c" },
  { x: 458, trunk: 30, canopy: 22, color: "#c9a24a" },
];

/** A small grove of trees of every size, used on the welcome page. */
export function GroveIllustration({ className }: { className?: string }) {
  const ground = 300;
  return (
    <svg viewBox="0 0 520 340" className={cn("h-auto w-full", className)} aria-hidden="true">
      <circle cx="420" cy="86" r="42" fill="#f2b84b" opacity="0.9" />
      <circle cx="420" cy="86" r="62" fill="#f2b84b" opacity="0.18" />
      <path d={`M0 ${ground + 6} C 130 ${ground - 22}, 390 ${ground - 22}, 520 ${ground + 6} L520 340 L0 340 Z`} fill="#e9dfc6" />
      <path d={`M0 ${ground + 18} C 150 ${ground}, 370 ${ground}, 520 ${ground + 18} L520 340 L0 340 Z`} fill="#dccfae" />
      {trees.map((tree) => {
        const top = ground - tree.trunk;
        return (
          <g key={tree.x}>
            <path d={`M${tree.x} ${ground} V${top}`} stroke="#7a5233" strokeWidth={Math.max(5, tree.canopy / 6)} strokeLinecap="round" />
            <circle cx={tree.x} cy={top - tree.canopy * 0.35} r={tree.canopy} fill={tree.color} />
            <circle
              cx={tree.x - tree.canopy * 0.35}
              cy={top - tree.canopy * 0.7}
              r={tree.canopy * 0.28}
              fill="#ffffff"
              opacity="0.16"
            />
            {tree.fruit ? (
              <>
                <circle cx={tree.x + tree.canopy * 0.4} cy={top - tree.canopy * 0.2} r="4.5" fill="#f2b84b" />
                <circle cx={tree.x - tree.canopy * 0.3} cy={top + tree.canopy * 0.05} r="4.5" fill="#f2b84b" />
                <circle cx={tree.x + tree.canopy * 0.05} cy={top - tree.canopy * 0.65} r="4.5" fill="#f2b84b" />
              </>
            ) : null}
          </g>
        );
      })}
      <path d="M96 246 q8 -10 16 0 q8 -10 16 0" fill="none" stroke="#5b6862" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <path d="M200 120 q7 -8 14 0 q7 -8 14 0" fill="none" stroke="#5b6862" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
