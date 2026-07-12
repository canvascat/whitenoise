# iOS 排查日志 · 正式 sourcemap · 播放动效联动

**日期：** 2026-07-12  
**状态：** 已批准（聊天确认 ok）

## 背景

iOS PWA 音频无声原因待查；正式环境需可对照控制台与源码。同时播放应有场景/底栏动效，暂停时停止。

## 决策

1. **Debug 日志**：始终输出，前缀 `[wn-audio]`（选项 A）。
2. **Source map**：`build.sourcemap: true`，正式包保留 `.map`。
3. **动效**：复用现有雨/炉火/呼吸；仅 `playing` 时运行。自选页 DockBar 播放中轻脉动（选项 C）。尊重 `prefers-reduced-motion`。

## 非目标

- 不在本轮修复静音开关 / audioSession 根因。
- 不上报远程日志服务。
- 不重做场景特效实现。

## 接口要点

- `audioDebug.info|warn|error(...args)`
- `SceneStage` 增加 `playing: boolean`
- `DockBar` 在 `status === "playing"` 时加脉动 class
