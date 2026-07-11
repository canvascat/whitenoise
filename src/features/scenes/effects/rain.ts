import { select, timer } from "d3";

export type EffectHandle = { stop: () => void };

type Drop = {
  x: number;
  y: number;
  len: number;
  speed: number;
  opacity: number;
};

type Ripple = {
  x: number;
  y: number;
  r: number;
  opacity: number;
};

const DROP_COUNT = 60;
const MAX_RIPPLES = 12;

export function startRain(container: HTMLElement): EffectHandle {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const svg = select(container)
    .append("svg")
    .attr("class", "scene-effect-rain")
    .attr("width", "100%")
    .attr("height", "100%")
    .style("position", "absolute")
    .style("inset", "0")
    .style("pointer-events", "none");

  const drops: Drop[] = Array.from({ length: DROP_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    len: 12 + Math.random() * 18,
    speed: 4 + Math.random() * 6,
    opacity: 0.25 + Math.random() * 0.45,
  }));

  const ripples: Ripple[] = [];

  const dropLayer = svg.append("g").attr("class", "rain-drops");
  const rippleLayer = svg.append("g").attr("class", "rain-ripples");

  const dropSel = dropLayer
    .selectAll("line")
    .data(drops)
    .join("line")
    .attr("stroke", "rgba(210, 230, 255, 0.85)")
    .attr("stroke-width", 1.2)
    .attr("stroke-linecap", "round");

  let lastRippleAt = 0;

  const t = timer((elapsed) => {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;

    for (const d of drops) {
      d.y += d.speed;
      d.x += d.speed * 0.12;
      if (d.y > h) {
        d.y = -d.len;
        d.x = Math.random() * w;
        if (ripples.length < MAX_RIPPLES && elapsed - lastRippleAt > 80) {
          ripples.push({
            x: d.x,
            y: h - 8 - Math.random() * 24,
            r: 2,
            opacity: 0.35,
          });
          lastRippleAt = elapsed;
        }
      }
      if (d.x > w) d.x = 0;
    }

    dropSel
      .attr("x1", (d) => d.x)
      .attr("y1", (d) => d.y)
      .attr("x2", (d) => d.x + d.len * 0.15)
      .attr("y2", (d) => d.y + d.len)
      .attr("opacity", (d) => d.opacity);

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]!;
      r.r += 0.35;
      r.opacity -= 0.008;
      if (r.opacity <= 0) ripples.splice(i, 1);
    }

    rippleLayer
      .selectAll("circle")
      .data(ripples)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", "none")
      .attr("stroke", "rgba(200, 220, 255, 0.7)")
      .attr("stroke-width", 1)
      .attr("opacity", (d) => d.opacity);
  });

  return {
    stop() {
      t.stop();
      svg.remove();
    },
  };
}
