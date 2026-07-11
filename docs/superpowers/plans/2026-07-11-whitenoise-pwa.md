# 白噪声 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可安装的白噪声 PWA：推荐全屏场景（线声+点声）、自选混音、定时关闭、场景动效，对齐小米白噪声核心体验与真机截图。

**Architecture:** React UI 经 Playback Store 驱动自研 Web Audio Engine（LineTrack / PointScheduler / SceneLoader）；场景动效（D3/CSS）与音频解耦；资源来自解包拷贝到 `public/assets`；PWA 按需缓存音频。

**Tech Stack:** Vite+、React、TypeScript、Tailwind CSS、TanStack Store、D3（ESM）、Vitest、vite-plugin-pwa。三方库必须支持 ESM。

**Spec:** `docs/superpowers/specs/2026-07-11-whitenoise-pwa-design.md`

---

## 文件结构（锁定）

```
public/assets/
  audio/*.mp3
  scene/*.jpg
  scene/*.json
  icons/*.png
  prebuilt_scene_config.json
  prebuilt_icon_config.json
  prebuilt_dot_icon_config.json
scripts/copy-mi-assets.mjs          # 从 ~/Downloads/mi 拷贝并写 manifest
src/
  main.tsx
  index.css                         # Tailwind 入口
  app/App.tsx                       # 顶栏 Tab 壳
  data/types.ts                     # 配置类型
  data/loadConfig.ts                # fetch 配置
  data/paths.ts                     # 音频/图片 URL 拼装
  audio/decode.ts                   # fetch + decodeAudioData
  audio/lineTrack.ts
  audio/pointScheduler.ts
  audio/engine.ts                   # 对外 API
  store/playbackStore.ts            # TanStack Store
  store/usePlayback.ts              # React 绑定
  features/scenes/RecommendPage.tsx
  features/scenes/SceneStage.tsx    # 全屏图 + 动效层挂载点
  features/scenes/effects/rain.ts   # D3 雨丝等
  features/scenes/effects/fireplace.ts
  features/scenes/effects/breath.ts
  features/mixer/CustomPage.tsx
  features/mixer/TrackGrid.tsx
  features/mixer/DockBar.tsx
  features/timer/TimerSheet.tsx
  lib/mediaSession.ts
src/audio/*.test.ts
src/data/*.test.ts
```

---

### Task 1: React + Tailwind + Vitest 脚手架

**Files:**

- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/main.tsx`, `src/App.tsx`（临时）, `src/index.css`, `index.html`
- Remove or replace: `src/main.ts`, `src/counter.ts`, `src/style.css`（脚手架残留）

- [ ] **Step 1: 安装依赖（仅 ESM 友好包）**

```bash
cd /home/yz/Documents/workspace/whitenoise
vp add react react-dom
vp add -D @types/react @types/react-dom
vp add -D @tailwindcss/vite tailwindcss
vp add @tanstack/store @tanstack/react-store
vp add d3
vp add -D @types/d3
vp add -D vitest @vitest/coverage-v8 jsdom
vp add -D vite-plugin-pwa
```

- [ ] **Step 2: 配置 Vite（React + Tailwind + test）**

将 `vite.config.ts` 设为：

```ts
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

若 `@vitejs/plugin-react` 未装：`vp add -D @vitejs/plugin-react`。

- [ ] **Step 3: 入口与 Tailwind**

`src/index.css`:

```css
@import "tailwindcss";

html,
body,
#root {
  height: 100%;
}
body {
  margin: 0;
  background: #121212;
  color: #fff;
  font-family: "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

临时 `src/app/App.tsx`：

```tsx
export function App() {
  return <div className="flex h-full items-center justify-center text-lg">白噪声</div>;
}
```

更新 `index.html` 的 script 为 `/src/main.tsx`，并加 `<div id="root"></div>`。

- [ ] **Step 4: 验证**

```bash
vp run build
vp test --run
```

Expected: build 成功；测试 0 或通过。

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts index.html src
git commit -m "$(cat <<'EOF'
脚手架：接入 React、Tailwind 与 Vitest

EOF
)"
```

---

### Task 2: 拷贝解包资源到 public/assets

**Files:**

- Create: `scripts/copy-mi-assets.mjs`
- Create: `public/assets/**`（生成物，可提交以便离线开发）

- [ ] **Step 1: 编写拷贝脚本**

`scripts/copy-mi-assets.mjs`：

```js
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(process.env.HOME, "Downloads/mi/assets");
const dest = path.join(root, "public/assets");

async function main() {
  await mkdir(path.join(dest, "audio"), { recursive: true });
  await mkdir(path.join(dest, "scene"), { recursive: true });
  await mkdir(path.join(dest, "icons"), { recursive: true });

  await cp(path.join(srcRoot, "audio"), path.join(dest, "audio"), {
    recursive: true,
  });
  for (const f of await readdir(path.join(srcRoot, "scene"))) {
    await cp(path.join(srcRoot, "scene", f), path.join(dest, "scene", f));
  }
  for (const f of await readdir(path.join(srcRoot, "icons"))) {
    if (f.endsWith(".json")) {
      await cp(path.join(srcRoot, "icons", f), path.join(dest, f));
    } else {
      await cp(path.join(srcRoot, "icons", f), path.join(dest, "icons", f));
    }
  }
  await cp(
    path.join(srcRoot, "scene/prebuilt_scene_config.json"),
    path.join(dest, "prebuilt_scene_config.json"),
  );

  // 统一：场景轨 JSON 已在 scene/；icon 配置在 assets 根
  const sceneCfg = JSON.parse(
    await readFile(path.join(dest, "prebuilt_scene_config.json"), "utf8"),
  );
  await writeFile(
    path.join(dest, "README.md"),
    `Copied from Xiaomi unpack. Scenes: ${sceneCfg.map((s) => s.title).join(", ")}\n`,
  );
  console.log("assets copied to public/assets");
}

main();
```

- [ ] **Step 2: 运行拷贝**

```bash
node scripts/copy-mi-assets.mjs
ls public/assets/audio | wc -l
ls public/assets/scene
test -f public/assets/prebuilt_scene_config.json && echo OK
```

Expected: 约 72 个 mp3；scene 含 jpg/json；配置文件存在。

- [ ] **Step 3: Commit**

```bash
git add scripts/copy-mi-assets.mjs public/assets
git commit -m "$(cat <<'EOF'
资源：拷贝小米解包音频与场景素材

EOF
)"
```

---

### Task 3: 配置类型与加载（TDD）

**Files:**

- Create: `src/data/types.ts`
- Create: `src/data/paths.ts`
- Create: `src/data/loadConfig.ts`
- Create: `src/data/loadConfig.test.ts`
- Create: `src/data/paths.test.ts`

- [ ] **Step 1: 写失败测试**

`src/data/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { audioUrl, sceneImageUrl, iconUrl } from "./paths";

describe("paths", () => {
  it("builds audio url from name without extension", () => {
    expect(audioUrl("夏雨")).toBe("/assets/audio/夏雨.mp3");
  });

  it("builds scene image url", () => {
    expect(sceneImageUrl("夏雨.jpg")).toBe("/assets/scene/夏雨.jpg");
  });

  it("builds icon url", () => {
    expect(iconUrl("夏雨.png")).toBe("/assets/icons/夏雨.png");
  });
});
```

`src/data/loadConfig.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseSceneTracks, parseColorParam } from "./loadConfig";

describe("parseColorParam", () => {
  it("splits two hex colors", () => {
    expect(parseColorParam("#FF8FC86F;#FF46A773")).toEqual(["#8FC86F", "#46A773"]);
  });
});

describe("parseSceneTracks", () => {
  it("maps line and point tracks", () => {
    const raw = [
      {
        audioName: "河流",
        isLineAudio: true,
        isPointAudio: false,
        volume: 1,
        names: [],
        frequency: 0,
        duration: 0,
        totalEndTime: 0,
      },
      {
        isLineAudio: false,
        isPointAudio: true,
        names: ["雷1", "雷2"],
        frequency: 5,
        duration: 8000,
        totalEndTime: 120000,
        volume: 1,
      },
    ];
    const tracks = parseSceneTracks(raw);
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({ kind: "line", name: "河流" });
    expect(tracks[1]).toMatchObject({
      kind: "point",
      variants: ["雷1", "雷2"],
      frequency: 5,
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
vp test src/data/paths.test.ts src/data/loadConfig.test.ts --run
```

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`src/data/types.ts`:

```ts
export type SceneMeta = {
  title: string;
  desp: string;
  engTitle: string;
  engDesp: string;
  imagePath: string;
};

export type LineTrackConfig = {
  kind: "line";
  name: string;
  volume: number;
};

export type PointTrackConfig = {
  kind: "point";
  variants: string[];
  frequency: number;
  durationMs: number;
  windowMs: number;
  volume: number;
};

export type TrackConfig = LineTrackConfig | PointTrackConfig;

export type IconConfig = {
  title: string;
  engTitle: string;
  colors: [string, string];
  icon: string;
  volume: number;
  audioName: string;
};
```

`src/data/paths.ts`:

```ts
export function audioUrl(name: string): string {
  return `/assets/audio/${name}.mp3`;
}

export function sceneImageUrl(imagePath: string): string {
  return `/assets/scene/${imagePath}`;
}

export function iconUrl(icon: string): string {
  return `/assets/icons/${icon}`;
}

export function sceneTracksUrl(title: string): string {
  return `/assets/scene/${title}.json`;
}
```

`src/data/loadConfig.ts`（核心解析；fetch 封装可同文件）：

```ts
import type { IconConfig, SceneMeta, TrackConfig } from "./types";

function stripArgb(hex: string): string {
  const h = hex.trim();
  if (/^#FF[0-9A-Fa-f]{6}$/i.test(h)) return `#${h.slice(3)}`;
  if (/^#ff[0-9A-Fa-f]{6}$/i.test(h)) return `#${h.slice(3)}`;
  return h.startsWith("#") ? h : `#${h}`;
}

export function parseColorParam(colorParam: string): [string, string] {
  const [a, b] = colorParam.split(";");
  return [stripArgb(a), stripArgb(b ?? a)];
}

type RawSceneTrack = {
  audioName?: string;
  isLineAudio?: boolean;
  isPointAudio?: boolean;
  names?: string[];
  frequency?: number;
  duration?: number;
  totalEndTime?: number;
  volume?: number;
};

export function parseSceneTracks(raw: RawSceneTrack[]): TrackConfig[] {
  return raw.map((t) => {
    if (t.isPointAudio) {
      return {
        kind: "point" as const,
        variants: t.names ?? [],
        frequency: t.frequency ?? 0,
        durationMs: t.duration ?? 0,
        windowMs: t.totalEndTime || 120_000,
        volume: t.volume ?? 1,
      };
    }
    return {
      kind: "line" as const,
      name: t.audioName ?? "",
      volume: t.volume ?? 1,
    };
  });
}

export async function loadSceneList(): Promise<SceneMeta[]> {
  const res = await fetch("/assets/prebuilt_scene_config.json");
  if (!res.ok) throw new Error("scene config missing");
  return res.json();
}

export async function loadSceneTracks(title: string): Promise<TrackConfig[]> {
  const res = await fetch(`/assets/scene/${encodeURIComponent(title)}.json`);
  if (!res.ok) throw new Error(`scene tracks missing: ${title}`);
  const raw = await res.json();
  return parseSceneTracks(raw);
}

export async function loadIconConfigs(): Promise<IconConfig[]> {
  const res = await fetch("/assets/prebuilt_icon_config.json");
  if (!res.ok) throw new Error("icon config missing");
  const raw = await res.json();
  return raw.map(
    (item: {
      title: string;
      engTitle: string;
      colorParam: string;
      icon: string;
      volume: string | number;
      audioUrls: { url: string }[];
    }) => ({
      title: item.title,
      engTitle: item.engTitle,
      colors: parseColorParam(item.colorParam),
      icon: item.icon,
      volume: Number(item.volume),
      audioName: item.audioUrls[0]?.url ?? item.title,
    }),
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
vp test src/data --run
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "$(cat <<'EOF'
数据：场景与音轨配置类型及解析

EOF
)"
```

---

### Task 4: LineTrack（TDD）

**Files:**

- Create: `src/audio/lineTrack.ts`
- Create: `src/audio/lineTrack.test.ts`
- Create: `src/audio/testUtils.ts`（mock AudioContext）

- [ ] **Step 1: 写失败测试**

`src/audio/testUtils.ts`：用可手动推进的假 `AudioContext`（最少实现 `createBufferSource` / `createGain` / `currentTime` / `destination`）。若过重，可对 `LineTrack` 注入 `ctx` 接口。

`src/audio/lineTrack.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { LineTrack } from "./lineTrack";

function mockCtx() {
  const gain = {
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const source = {
    buffer: null as AudioBuffer | null,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  return {
    currentTime: 0,
    destination: {},
    createGain: () => gain,
    createBufferSource: () => source,
    _gain: gain,
    _source: source,
  } as unknown as AudioContext & {
    _gain: typeof gain;
    _source: typeof source;
  };
}

describe("LineTrack", () => {
  it("starts looping buffer at given volume", () => {
    const ctx = mockCtx();
    const buffer = { duration: 2 } as AudioBuffer;
    const track = new LineTrack(ctx, buffer, 0.5);
    track.start();
    expect(ctx._source.loop).toBe(true);
    expect(ctx._source.start).toHaveBeenCalled();
    expect(ctx._gain.gain.value).toBe(0.5);
  });

  it("stop is idempotent", () => {
    const ctx = mockCtx();
    const track = new LineTrack(ctx, { duration: 1 } as AudioBuffer, 1);
    track.start();
    track.stop();
    track.stop();
    expect(ctx._source.stop).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 跑测失败 → 实现 `LineTrack` → 跑通**

`src/audio/lineTrack.ts` 要点：

```ts
export class LineTrack {
  private source: AudioBufferSourceNode | null = null;
  private readonly gain: GainNode;

  constructor(
    private readonly ctx: AudioContext,
    private readonly buffer: AudioBuffer,
    volume: number,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = volume;
    this.gain.connect(ctx.destination);
  }

  start(when = 0) {
    this.stop();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.connect(this.gain);
    src.start(when);
    this.source = src;
  }

  setVolume(v: number) {
    this.gain.gain.value = v;
  }

  stop() {
    if (!this.source) return;
    try {
      this.source.stop();
    } catch {
      /* already stopped */
    }
    this.source.disconnect();
    this.source = null;
  }
}
```

```bash
vp test src/audio/lineTrack.test.ts --run
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/audio
git commit -m "$(cat <<'EOF'
音频：实现线声循环轨 LineTrack

EOF
)"
```

---

### Task 5: PointScheduler（TDD）

**Files:**

- Create: `src/audio/pointScheduler.ts`
- Create: `src/audio/pointScheduler.test.ts`

- [ ] **Step 1: 写失败测试**

行为约定（写进测试）：

- 给定 `frequency` 与 `windowMs`，在窗口内调度约 `frequency` 次触发（允许 ±1）
- 每次从 `variants` 缓冲 map 中随机取一个 one-shot
- `stop()` 取消未触发的 timeout
- 使用注入的 `now` / `random` / `schedule` 便于测

```ts
import { describe, expect, it, vi } from "vitest";
import { PointScheduler } from "./pointScheduler";

describe("PointScheduler", () => {
  it("schedules roughly frequency one-shots in a window", () => {
    const play = vi.fn();
    const timers: { t: number; fn: () => void }[] = [];
    const sched = new PointScheduler({
      frequency: 5,
      windowMs: 1000,
      variants: ["a", "b"],
      playOneShot: play,
      random: () => 0.5,
      schedule: (fn, ms) => {
        timers.push({ t: ms, fn });
        return timers.length;
      },
      clear: () => {},
    });
    sched.start();
    expect(timers.length).toBe(5);
    timers.forEach((x) => x.fn());
    expect(play).toHaveBeenCalledTimes(5);
  });

  it("stop clears pending", () => {
    const clear = vi.fn();
    const sched = new PointScheduler({
      frequency: 3,
      windowMs: 1000,
      variants: ["a"],
      playOneShot: () => {},
      random: () => 0.1,
      schedule: (fn) => {
        fn();
        return 1;
      },
      clear,
    });
    sched.start();
    sched.stop();
    expect(clear).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 实现并跑通**

`PointScheduler`：在 `start` 时用 `random` 生成 `frequency` 个 `[0, windowMs)` 延迟；到时 `playOneShot(variant)`；循环窗口可在窗口结束后再次 `start` 同逻辑（引擎层负责在 playing 期间续期）。

```bash
vp test src/audio/pointScheduler.test.ts --run
```

- [ ] **Step 3: Commit**

```bash
git add src/audio/pointScheduler.ts src/audio/pointScheduler.test.ts
git commit -m "$(cat <<'EOF'
音频：实现点声随机调度 PointScheduler

EOF
)"
```

---

### Task 6: AudioEngine + 解码（TDD）

**Files:**

- Create: `src/audio/decode.ts`
- Create: `src/audio/engine.ts`
- Create: `src/audio/engine.test.ts`

- [ ] **Step 1: Engine API 约定（测试锁定）**

```ts
// engine.test.ts 伪代码要点
const engine = new AudioEngine({ createContext: () => mockCtx, fetchBuffer });
await engine.loadScene(tracks); // TrackConfig[]
await engine.resume(); // 用户手势
engine.play();
engine.pause();
engine.stop();
engine.setTrackVolume("河流", 0.2);
engine.fadeOutAndStop(500);
```

实现要点：

- `decode.ts`: `fetch(audioUrl(name))` → `arrayBuffer` → `ctx.decodeAudioData`，带 `Map` 缓存
- 单轨失败：catch 后跳过，不抛垮整场景
- `loadGeneration` 计数：快速切场景时丢弃过期 load
- `play/pause/stop` 映射状态机 `idle|loading|playing|paused|stopped`

- [ ] **Step 2: 实现最小 Engine → 测试通过**

```bash
vp test src/audio --run
```

- [ ] **Step 3: Commit**

```bash
git add src/audio
git commit -m "$(cat <<'EOF'
音频：场景加载与播放引擎

EOF
)"
```

---

### Task 7: Playback Store（TanStack Store）

**Files:**

- Create: `src/store/playbackStore.ts`
- Create: `src/store/usePlayback.ts`
- Create: `src/store/playbackStore.test.ts`

- [ ] **Step 1: 状态形状**

```ts
type PlaybackState = {
  tab: "recommend" | "custom";
  scenes: SceneMeta[];
  sceneIndex: number;
  status: "idle" | "loading" | "playing" | "paused" | "stopped";
  /** 自选：title -> volume；缺省表示未选中 */
  customActive: Record<string, number>;
  timerMinutes: 0 | 15 | 30 | 60;
  timerEndsAt: number | null;
  error: string | null;
  reducedMotion: boolean;
};
```

Actions：`setTab`、`selectScene(index)`、`toggleCustom(title)`、`play`、`pause`、`setTimer`、`clearError`。  
`play` / `selectScene` 内调用 `AudioEngine`（store 持有 engine 单例）。

- [ ] **Step 2: 用 Vitest 测纯 reducer/action（mock engine）→ Commit**

```bash
git add src/store
git commit -m "$(cat <<'EOF'
状态：接入 TanStack Playback Store

EOF
)"
```

---

### Task 8: App 壳 + 推荐页 UI（对齐截图）

**Files:**

- Modify: `src/app/App.tsx`
- Create: `src/features/scenes/RecommendPage.tsx`
- Create: `src/features/scenes/SceneStage.tsx`
- Create: `src/features/scenes/TopTabs.tsx`

- [ ] **Step 1: TopTabs** — 居中「推荐 | 自选」，右侧 `⋮`（菜单可先空）

- [ ] **Step 2: RecommendPage**

- 全屏 `SceneStage`：`background-image` 用 `sceneImageUrl`
- 左下标题 `title` + `desp`
- 右下定时按钮（先打开占位 sheet）
- 左右滑切换 `sceneIndex`（`pointer` / `touch` 或简单按钮；推荐 `onPointerUp` 判断 dx）
- 切换时 `store.selectScene` → engine 加载该场景 JSON 并播放（需用户已解锁 context；第一次显示「点击播放」遮罩）

- [ ] **Step 3: 对照 `screenshot/Screenshot_20260711-103902.png` 调间距与字号**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
界面：推荐页全屏场景与顶栏 Tab

EOF
)"
```

---

### Task 9: 场景动效（D3）

**Files:**

- Create: `src/features/scenes/effects/rain.ts`
- Create: `src/features/scenes/effects/fireplace.ts`
- Create: `src/features/scenes/effects/breath.ts`
- Modify: `src/features/scenes/SceneStage.tsx`

- [ ] **Step 1: `SceneStage` 挂载绝对定位 canvas/svg**

- 若 `reducedMotion` 或 `matchMedia('(prefers-reduced-motion: reduce)')` → 不启动
- `title === '夏雨'` → `rain.ts`：D3 生成雨丝线 + 定时平移；可选涟漪圈
- `title === '炉火'` → `fireplace.ts`：火星粒子上飘
- 其他 → `breath.ts`：CSS `scale` 呼吸或慢速 Ken Burns

- [ ] **Step 2: 组件卸载时停止 timer / 清空 svg**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
动效：夏雨与炉火场景层 D3 效果

EOF
)"
```

---

### Task 10: 自选混音页

**Files:**

- Create: `src/features/mixer/CustomPage.tsx`
- Create: `src/features/mixer/TrackGrid.tsx`
- Create: `src/features/mixer/DockBar.tsx`

- [ ] **Step 1: TrackGrid** — 3 列；未选中 `#2c2c2c`；选中 `linear-gradient` 用 `colors`
- [ ] \*\*Step 2: 点击 toggle → store；engine 加载/卸载对应 LineTrack（自选 v1 只混线声 icon 配置）
- [ ] **Step 3: DockBar** — 摘要 `雨打树叶/河流/钢琴声` + 播放键（对照截图）
- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
界面：自选音轨网格与底栏播放条

EOF
)"
```

---

### Task 11: 定时器

**Files:**

- Create: `src/features/timer/TimerSheet.tsx`
- Modify: `src/store/playbackStore.ts`

- [ ] **Step 1: UI 四档：15 / 30 / 60 / 关闭**
- [ ] \**Step 2: `timerEndsAt = Date.now() + minutes*60_000`；`setInterval`检查；到时`engine.fadeOutAndStop` + status paused + 清 timer
- [ ] \*\*Step 3: 手动 pause/stop 时取消 timer
- [ ] **Step 4: 单测「到时调用 fadeOut」→ Commit**

```bash
git commit -m "$(cat <<'EOF'
功能：定时关闭与淡出停止

EOF
)"
```

---

### Task 12: Media Session 与错误提示

**Files:**

- Create: `src/lib/mediaSession.ts`
- Modify: `src/app/App.tsx` 或 store 订阅处

- [ ] **Step 1: 播放时 `navigator.mediaSession.metadata = new MediaMetadata({ title, artist: '白噪声' })`；actionHandler play/pause**
- [ ] \*\*Step 2: `error` 非空时顶部 toast（简单 `fixed` div）
- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
体验：Media Session 与加载错误提示

EOF
)"
```

---

### Task 13: PWA

**Files:**

- Modify: `vite.config.ts`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`（可用简单单色占位）
- Modify: `index.html`（theme-color）

- [ ] **Step 1: 配置 `VitePWA`**

```ts
import { VitePWA } from "vite-plugin-pwa";

VitePWA({
  registerType: "autoUpdate",
  includeAssets: ["icons/*.png"],
  manifest: {
    name: "白噪声",
    short_name: "白噪声",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    start_url: "/",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  workbox: {
    navigateFallback: "/index.html",
    runtimeCaching: [
      {
        urlPattern: /\/assets\/audio\/.*\.mp3$/,
        handler: "CacheFirst",
        options: {
          cacheName: "audio-cache",
          expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: /\/assets\/scene\/.*\.(jpg|json)$/,
        handler: "CacheFirst",
        options: { cacheName: "scene-cache" },
      },
    ],
  },
});
```

- [ ] **Step 2: `vp run build && vp run preview`，Chrome Application 面板确认 manifest / SW**
- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
PWA：可安装与音频按需缓存

EOF
)"
```

---

### Task 14: 验收烟测与收尾

**Files:** 按需修 bug；更新规格状态如需要

- [ ] **Step 1: 手工清单**

1. 打开推荐：夏雨/森林/炉火/海洋可滑切，有声（线声+点声）
2. 自选：多轨混音，底栏名称正确，播放/暂停
3. 定时 15 分钟可先改 store 测 5 秒档做开发验证，再改回
4. `prefers-reduced-motion` 下无粒子
5. 构建产物可预览安装

- [ ] **Step 2: `vp check && vp test --run && vp run build`**
- [ ] **Step 3: Commit 修复**

```bash
git commit -m "$(cat <<'EOF'
收尾：验收修复与构建通过

EOF
)"
```

---

## Spec 覆盖自检

| Spec 项                   | Task   |
| ------------------------- | ------ |
| 推荐全屏场景              | 8      |
| 自选混音                  | 10     |
| 线声+点声                 | 4–6    |
| 定时 15/30/60             | 11     |
| 场景动效 D3               | 9      |
| Tailwind / TanStack / ESM | 1, 7   |
| PWA 按需缓存              | 13     |
| 错误处理 / Media Session  | 6, 12  |
| 解包素材                  | 2      |
| 非目标（账号等）          | 不实现 |

## 执行说明

- 提交信息使用简体中文（已写在各 Task）
- 若本机无 `user.name`/`user.email`，先配置再 commit，或由用户配置后补提
- 素材版权仅适合个人学习；公开发布前需替换资源
