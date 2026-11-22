import { VIEWBOX, floorCenter, floorPoints, hingeOrigin, lid, polygon, wallRibbon, walls } from "@/lib/gift-box";

const origin = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` }) as React.CSSProperties;
const [knotX, knotY] = [lid.center[0], lid.center[1] - 6];

// Wall faces, by which side of the light they're on
const wallFill: Record<(typeof walls)[number]["name"], string> = {
  "back-left": "url(#gift-inside)",
  "back-right": "url(#gift-inside)",
  "front-left": "url(#gift-lit)",
  "front-right": "url(#gift-shade)",
};

// The closed blue gift box, drawn so every piece the opening moves is its own group:
// the four walls (each hinged at the floor), the lid, the bow's two loops, its knot and its two tails.
// The parent finds them by data-part.
//
// It is drawn in two layers with the particle canvas between them: the back walls and floor behind,
// the front walls and lid in front, so the particles rise from inside the box.
export function GiftBox({ layer }: { layer: "back" | "front" }) {
  const back = layer === "back";
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      aria-hidden="true"
      focusable="false"
      className="gift-svg block h-auto w-full overflow-visible"
    >
      <defs>
        <linearGradient id="gift-lit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f80ff" />
          <stop offset="1" stopColor="#2a56dc" />
        </linearGradient>
        <linearGradient id="gift-shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2449c4" />
          <stop offset="1" stopColor="#173394" />
        </linearGradient>
        <linearGradient id="gift-inside" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14307e" />
          <stop offset="1" stopColor="#0d2160" />
        </linearGradient>
        <linearGradient id="gift-lid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7aa3ff" />
          <stop offset="1" stopColor="#3f6ff0" />
        </linearGradient>
        <linearGradient id="gift-silk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef4ff" />
          <stop offset=".55" stopColor="#b9d0ff" />
          <stop offset="1" stopColor="#86a9f6" />
        </linearGradient>
        <linearGradient id="gift-silk-shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9c2fb" />
          <stop offset="1" stopColor="#6489e6" />
        </linearGradient>
        <radialGradient id="gift-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#d6e7ff" stopOpacity=".95" />
          <stop offset=".45" stopColor="#6ea6ff" stopOpacity=".55" />
          <stop offset="1" stopColor="#2f6bff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g data-part="box" style={origin(160, 300)}>
        {/* A soft shadow on the "floor" */}
        {back && <ellipse cx={floorCenter[0]} cy={floorCenter[1] + 22} rx="118" ry="26" fill="#000" opacity=".5" />}

        {/* Back walls first: once the front walls fall, these are the inside of the box */}
        {back && walls
          .filter((wall) => wall.name.startsWith("back"))
          .map((wall) => (
            <g key={wall.name} data-part={`wall-${wall.name}`} style={{ transformOrigin: hingeOrigin(wall) }}>
              <polygon points={polygon(...wall.points)} fill={wallFill[wall.name]} />
            </g>
          ))}
        {back && <polygon points={polygon(...floorPoints)} fill="#0b1c52" />}
        {back && <ellipse data-part="glow" cx={floorCenter[0]} cy={floorCenter[1]} rx="92" ry="40" fill="url(#gift-glow)" opacity="0" />}

        {!back && walls
          .filter((wall) => wall.name.startsWith("front"))
          .map((wall) => (
            <g key={wall.name} data-part={`wall-${wall.name}`} style={{ transformOrigin: hingeOrigin(wall) }}>
              <polygon points={polygon(...wall.points)} fill={wallFill[wall.name]} />
              <polygon data-ribbon="" points={wallRibbon(wall) ?? ""} fill={wall.name === "front-left" ? "url(#gift-silk)" : "url(#gift-silk-shade)"} />
              {/* Its inner face, shown once it has tipped past edge-on */}
              <polygon data-part={`wall-${wall.name}-inside`} points={polygon(...wall.points)} fill="url(#gift-inside)" opacity="0" />
            </g>
          ))}
        {/* The box's front edge catches the light */}
        {!back && <line x1="160" y1="208" x2="160" y2="300" stroke="#9cbcff" strokeOpacity=".45" strokeWidth="1.2" />}

        {!back && <g data-part="lid" style={origin(lid.center[0], lid.center[1])}>
          <polygon points={lid.leftSkirt} fill="url(#gift-lit)" />
          <polygon points={lid.rightSkirt} fill="url(#gift-shade)" />
          <polygon points={lid.top} fill="url(#gift-lid)" />
          {lid.ribbons.map((points, i) => (
            <polygon key={i} data-ribbon="" points={points} fill={i === 3 ? "url(#gift-silk-shade)" : "url(#gift-silk)"} />
          ))}

          <g data-part="bow">
            {/* Tails sit under the loops; their notched ends are what stretches outward */}
            <g data-part="tail-left" style={origin(knotX, knotY)}>
              <path d="M155 153C149 168 139 181 124 195l10-2 3 10c10-15 18-29 24-45z" fill="url(#gift-silk)" />
            </g>
            <g data-part="tail-right" style={origin(knotX, knotY)}>
              <path d="M165 153c7 14 17 27 32 39l-10-1-2 10c-11-14-19-28-26-44z" fill="url(#gift-silk-shade)" />
            </g>
            <g data-part="loop-left" style={origin(knotX, knotY)}>
              <path
                fillRule="evenodd"
                d="M160 150C141 126 106 108 109 130c2 19 30 27 51 20zM150 146c-12-11-28-19-28-11 0 8 16 12 28 11z"
                fill="url(#gift-silk)"
              />
            </g>
            <g data-part="loop-right" style={origin(knotX, knotY)}>
              <path
                fillRule="evenodd"
                d="M160 150c19-24 54-42 51-20-2 19-30 27-51 20zm10-4c12-11 28-19 28-11 0 8-16 12-28 11z"
                fill="url(#gift-silk-shade)"
              />
            </g>
            <g data-part="knot" style={origin(knotX, knotY)}>
              <path d="M150 145c4-5 16-5 20 0 2 4 1 9-1 12-5 3-13 3-18 0-2-3-3-8-1-12z" fill="url(#gift-silk)" />
              <path d="M153 147c4-2 10-2 14 0" stroke="#7f9fe8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </g>
          </g>
        </g>}
      </g>
    </svg>
  );
}
