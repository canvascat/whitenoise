# iOS debug / sourcemap / 播放动效 Implementation Plan

> **For agentic workers:** 按任务顺序实现；完成后跑 `vp check` 与相关测试。

**Goal:** 正式环境可排查音频；播放有动效、暂停停止。

**Architecture:** 薄 `audioDebug` 封装；引擎/store/App 关键路径打点；SceneStage 用 `playing` 启停特效；DockBar CSS 脉动；Vite 开启 sourcemap。

**Tech Stack:** Vite+、React、现有 effects、console

---

## 文件

| 文件                                   | 职责                    |
| -------------------------------------- | ----------------------- |
| `src/lib/audioDebug.ts`                | `[wn-audio]` 日志       |
| `src/audio/engine.ts` / `decode.ts`    | 引擎打点                |
| `src/store/playbackStore.ts`           | store 动作打点          |
| `src/app/App.tsx`                      | visibility 续播打点     |
| `vite.config.ts`                       | `build.sourcemap: true` |
| `SceneStage.tsx` / `RecommendPage.tsx` | `playing` 联动          |
| `DockBar.tsx` / `index.css`            | 底栏脉动                |
| 对应 `*.test.ts(x)`                    | 覆盖关键行为            |

## 任务

- [x] 1. `audioDebug` + 引擎/store/App 打点
- [x] 2. vite sourcemap
- [x] 3. SceneStage `playing` 启停特效
- [x] 4. DockBar 播放脉动
- [x] 5. `vp check` / `vp test`
