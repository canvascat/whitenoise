# 白噪声 PWA 设计规格

日期：2026-07-11  
状态：已审阅通过（2026-07-11）

## 1. 目标

做一个可安装的白噪声 PWA，**核心体验对齐小米白噪声**（参考解包资源与真机截图），第一版聚焦：

- 推荐：全屏场景播放（线声 + 点声）
- 自选：多轨自由混音
- 定时关闭
- 场景层轻量动效（灵动、可关）

不做：账号、云收藏、推荐运营、推送、付费下载。

素材：先复用 `~/Downloads/mi` 解包资源；后期可整体替换，引擎与配置结构保持不变。

## 2. 产品决策摘要

| 项          | 决策                                               |
| ----------- | -------------------------------------------------- |
| 定位        | 核心体验复刻（非像素级全功能仿制）                 |
| 素材        | 解包资源先行，可替换                               |
| 音频        | 线声循环 + 点声随机触发（完整）                    |
| UI 框架     | React + Vite+                                      |
| 样式        | Tailwind CSS                                       |
| 状态 / 数据 | TanStack（按需：Query / Store 等）                 |
| 场景动效    | 允许 D3（或轻量 Canvas/SVG）；复杂粒子/调度优先 D3 |
| 混音        | 推荐场景 + 自选自由混音                            |
| 视觉        | 对齐真机：顶栏「推荐 / 自选」、全屏场景、自选网格  |
| 三方库      | 按需引入；**必须支持 ESM**                         |

## 3. 信息架构（对齐真机截图）

参考仓库内 `screenshot/`：

1. **推荐**
   - 顶栏：`推荐` | `自选`，右侧菜单
   - 主体：全屏场景插画（可横滑切换）
   - 左下：场景中文名 + 文案
   - 右下：定时入口

2. **自选**
   - 同顶栏
   - 3 列圆形音轨网格：未选中深灰底，选中彩色渐变
   - 底栏：已选音轨名称摘要 + 播放键

3. **定时**
   - 档位固定为：15 / 30 / 60 分钟 / 关闭
   - 到时 fade-out 后停止

v1 不强制实现「浮点拖拽调音」页；若后续对照原版需要，再作为增量。

## 4. 系统架构

```
React UI（推荐 / 自选 / 定时 / 场景动效）
        │  命令 & 订阅
Playback Store（当前场景、轨开关与音量、播放态、定时器）
        │
Audio Engine（Web Audio API）
  · LineTrack：无缝循环 + Gain
  · PointScheduler：按 frequency 随机 one-shot
  · SceneLoader：场景 JSON → 建轨
        │
Assets（public/assets，源自解包）
  audio/ · scene/*.jpg+json · icons/ · *config.json
        │
PWA（vite-plugin-pwa：可安装、按需缓存音频）
```

边界：

- UI 不直接操作 `AudioContext`，只经 Store / Engine API
- 换素材 = 换资源文件与配置，不改引擎接口
- 场景动效在 UI 层，与音频调度解耦

## 5. 音频引擎与数据模型

### 5.1 配置来源（解包）

- `prebuilt_scene_config.json`：场景列表（标题、文案、图、裁剪参数）
- `scene/<名>.json`：该场景轨列表
- `prebuilt_icon_config.json`：自选线声轨（标题、色、默认音量、audio url）
- `prebuilt_dot_icon_config.json`：点声类轨（frequency、多 variant）
- `audio/*.mp3`：实际音频

### 5.2 轨类型

**LineTrack（`isLineAudio`）**

- 解码为 `AudioBuffer`，循环播放
- 独立 `GainNode`；音量来自配置默认值或用户调节

**PointTrack（`isPointAudio`）**

- `names[]` 为变体列表；`frequency` 表示时间窗内触发次数量级
- 调度器在窗口内随机时刻、随机变体触发 one-shot
- 不阻塞线声；可独立 Gain

### 5.3 状态机

`idle → loading → playing ⇄ paused → stopped`

- 切场景：取消进行中的 load → 停旧轨 → 加载新配置 → 起播（短 fade 可选）
- 首次播放：在用户手势中 `audioContext.resume()`

### 5.4 定时器

- 倒计时结束 → 全轨 fade-out → stop → UI 暂停态
- 用户手动停止则取消定时

## 6. UI 与动效

### 6.1 视觉

- 深色主题，对齐截图气质（非另起编辑风）
- 推荐页以场景图为唯一主视觉；控件极少
- 自选页网格呼吸感间距；底栏渐变摘要条 + 播放键

### 6.2 场景动效（v1）

| 场景 | 动效                         |
| ---- | ---------------------------- |
| 夏雨 | 雨丝、涟漪、萤火微闪         |
| 炉火 | 火焰闪烁、火星上飘、光晕呼吸 |
| 其他 | 轻呼吸缩放或慢视差           |

- 实现：简单效果用 CSS；雨丝/粒子/时间轴等用 **D3 + Canvas/SVG**
- `prefers-reduced-motion: reduce` → 静态图
- 动效可关（设置或系统偏好）

## 7. PWA

- 可安装、`display: standalone`
- App Shell 预缓存；**当前场景 / 已选轨音频按需缓存**（避免首屏拉满约 28MB）
- Media Session：场景名、播放/暂停
- 后台播放：在浏览器/系统允许范围内尽力保持；回前台时校准 UI 与引擎状态

## 8. 错误处理

| 情况                | 处理                               |
| ------------------- | ---------------------------------- |
| 单轨加载失败        | 跳过该轨，其余继续；轻提示         |
| AudioContext 未解锁 | 引导再次点击播放                   |
| 快速切场景          | 只保留最新 load                    |
| 离线且未缓存        | 提示需联网首次加载，或禁用未缓存项 |
| 定时到时            | fade-out → stop                    |

## 9. 测试

- **单元**：PointScheduler、音量映射、场景 JSON 解析
- **集成**：夏雨/炉火起播（线声+点声）；定时结束停止
- **烟测**：滑场景、自选混音、PWA 安装、弱网首次加载

## 10. 技术栈与目录约定

**基础**

- Vite+、React、TypeScript
- `vite-plugin-pwa`

**允许的三方库（按需引入，不为用而用）**

约束：**仅允许支持 ESM 的库**（可通过 `import` 使用；不引入仅提供全局 script / 无 ESM 入口的包）。选型时优先看 `package.json` 的 `exports` / `module` 与官方 ESM 说明。

| 库               | 用途                                                               |
| ---------------- | ------------------------------------------------------------------ |
| **Tailwind CSS** | 布局、间距、主题色、自选网格与底栏样式                             |
| **TanStack**     | 播放/混音客户端状态（如 Store）；若有远程配置再考虑 Query          |
| **D3.js**        | 场景层动效（雨丝、涟漪、火星粒子、缓动时间轴）；不替代 Web Audio   |
| 其他             | 实现阶段可按需增加，同样须为 ESM；仅当 CSS/D3 不够时再考虑动画类库 |

原则：

- 三方库按需引入，且 **必须支持 ESM**
- 音频核心仍自研 Web Audio 模块，不引入重量级音频框架
- UI 样式以 Tailwind 为主，避免再叠一套重型组件库
- D3 只服务场景「灵动」可视化，与 `Audio Engine` 解耦

建议目录：

```
src/
  app/           # 路由或顶栏 Tab 壳
  features/
    scenes/      # 推荐页、场景动效（可含 d3 层）
    mixer/       # 自选网格、底栏
    timer/       # 定时 UI
  audio/         # Engine、LineTrack、PointScheduler、SceneLoader
  store/         # Playback store（TanStack Store 或等价）
  data/          # 配置类型与加载
public/assets/   # 从解包拷贝的音频/图/配置
```

## 11. 非目标（v1）

- 账号 / 云同步 / 收藏云端
- 推送与权限引导流
- 完整像素级仿制所有原版次级页
- 浮点拖拽调音（可列为 v1.1）
- 全量音频预下载

## 12. 参考材料

- 解包：`~/Downloads/mi`（或本机等价路径）
- 真机截图：仓库 `screenshot/`
- 头脑风暴示意：`.superpowers/brainstorm/`（本地，不入库）
