import { select, timer } from "d3";

export type EffectHandle = { stop: () => void };

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
};

const MAX_SPARKS = 48;
const SPAWN_EVERY_MS = 45;

export function startFireplace(container: HTMLElement): EffectHandle {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const svg = select(container)
    .append("svg")
    .attr("class", "scene-effect-fireplace")
    .attr("width", "100%")
    .attr("height", "100%")
    .style("position", "absolute")
    .style("inset", "0")
    .style("pointer-events", "none");

  const sparks: Spark[] = [];
  const layer = svg.append("g").attr("class", "fireplace-sparks");

  let lastSpawn = 0;

  function spawn(w: number, h: number) {
    if (sparks.length >= MAX_SPARKS) return;
    const cx = w * (0.35 + Math.random() * 0.3);
    sparks.push({
      x: cx + (Math.random() - 0.5) * 40,
      y: h * (0.72 + Math.random() * 0.12),
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(1.2 + Math.random() * 2.2),
      r: 1.2 + Math.random() * 2.2,
      life: 0,
      maxLife: 900 + Math.random() * 1100,
    });
  }

  const t = timer((elapsed) => {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;

    if (elapsed - lastSpawn >= SPAWN_EVERY_MS) {
      spawn(w, h);
      lastSpawn = elapsed;
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!;
      s.life += 16;
      s.x += s.vx;
      s.y += s.vy;
      s.vy *= 0.995;
      s.vx += (Math.random() - 0.5) * 0.05;
      if (s.life >= s.maxLife || s.y < h * 0.25) sparks.splice(i, 1);
    }

    layer
      .selectAll("circle")
      .data(sparks)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r * (1 - (d.life / d.maxLife) * 0.5))
      .attr("fill", (d) => {
        const tLife = d.life / d.maxLife;
        if (tLife < 0.35) return "rgba(255, 220, 120, 0.95)";
        if (tLife < 0.7) return "rgba(255, 140, 60, 0.85)";
        return "rgba(255, 80, 30, 0.55)";
      })
      .attr("opacity", (d) => Math.max(0, 1 - d.life / d.maxLife));
  });

  return {
    stop() {
      t.stop();
      svg.remove();
    },
  };
}
