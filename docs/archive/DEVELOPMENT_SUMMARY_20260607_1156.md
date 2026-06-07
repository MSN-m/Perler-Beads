# 开发进度总结 (Development Summary) - 20260607_1156

> **助手交接协议**：当用户输入口令 **“一键归档”** 时，请分析当前项目状态，提取功能变更、文件状态、Bug 现状及下一步计划，并按照 `DEVELOPMENT_SUMMARY_YYYYMMDD_HHMM.md` 的格式保存到 `docs/archive/` 目录。

## 1. 本次归档摘要

本次归档基于当前仓库源码状态生成，用于补齐 `20260409` 之后实际已落地但尚未归档的进展。

当前项目已经从早期的单页上传生成流程，演进为包含 **工作台模式、像素预览阶段、拼豆映射阶段、草稿管理、原图对照、编辑工具增强和架构图谱页面** 的纯前端拼豆图纸工具。

本次归档前检查结果：

- `git status --short`：工作区干净
- `node --check`：`src/*.js`、`src/features/*.js`、`server.js`、`scripts/*.cjs` 均通过语法检查
- 已确认存在架构图谱页面：`understand-view-standalone.html`

---

## 2. 当前项目结构和入口

### 2.1 普通入口

- `index.html`
  - 原始移动端/步骤式入口
  - 包含上传、设置、图纸编辑和导出步骤

### 2.2 工作台入口

- `workbench.html`
  - 新增工作台式布局
  - 包含源图预览、裁剪、像素预览、拼豆生成、颜色清单、草稿、原图对照和编辑工具栏

### 2.3 架构图谱入口

- `understand-view-standalone.html`
  - 单文件架构图谱页面
  - 当前展示：30 个文件、109 个节点、130 条关系、6 个分层、6 个导览步骤

### 2.4 本地服务

- `server.js`
  - 静态文件服务
  - 默认端口：`8080`

---

## 3. 已落地功能进展

### 3.1 工作台模式

当前 `workbench.html` 已成为更完整的主工作区，包含：

- 上传/换图入口
- 原图预览区
- 裁剪框与裁剪拖拽控制
- 像素预览阶段
- 拼豆图纸生成阶段
- 颜色清单面板
- 编辑工具栏
- 草稿保存、恢复、删除、重命名
- 草稿导入/导出
- 原图对照视图
- 对照视图缩放与拖拽

相关状态字段已加入 `src/state.js`：

- `pixelArtData`
- `pixelArtSettings`
- `workbenchSettingsCollapsed`
- `comparePreviewScale`
- `comparePreviewOffsetX/Y`
- `comparePreviewDragging`
- `comparePreviewDidDrag`
- `drafts`
- `draftDrawerOpen`

### 3.2 两阶段图纸生成流程

当前图纸生成已拆成两个阶段：

1. **生成像素预览**
   - `generatePixelArtData()`
   - 对源图做采样、主色融合、对比度调整、锐化等处理
   - 输出中间态 `pixelArtData`

2. **生成拼豆图纸**
   - `mapPixelArtToBeads()`
   - 将 `pixelArtData` 或源图采样结果映射到拼豆调色板
   - 支持颜色限制、抖动、DeltaE/Redmean 匹配和区域清理

工作台里 `生成拼豆图纸` 按钮依赖像素预览：未生成 `pixelArtData` 时会禁用。

### 3.3 高精度直接映射

在 `src/processor.js` 中已新增直接拼豆映射路径：

- `collectCellSamples()`
- `scoreColorForSamples()`
- `findBestBeadForSamples()`
- `limitDirectMappedColors()`
- `mapSourceToBeadsDirect()`

当满足以下条件时启用：

- `precisionMode === 'high'`
- 传入了 `sourceImageData`

该路径绕过中间 RGB 像素平均色，直接对每个网格格子的源图样本与候选拼豆色进行误差评分，以提升对原图细节的忠实度。

### 3.4 颜色匹配能力增强

`src/processor.js` 当前支持：

- Redmean 距离
- Lab 色彩空间转换
- DeltaE76 色差
- MARD 套装过滤
- 中值切分限色
- 高精度直接映射中的样本权重

### 3.5 像素预览调节

工作台新增像素预览控制：

- 对比度 `contrast`
- 锐化 `sharpen`
- 主色权重 `dominant`

对应函数：

- `applyPixelArtContrast()`
- `applyPixelArtSharpen()`
- `generatePixelArtData()`

### 3.6 背景移除交互增强

除了原来的点击移除背景，现在已加入框选式背景移除状态：

- `bgRemovalSelection`
- `startBgRemovalSelection()`
- `moveBgRemovalSelection()`
- `endBgRemovalSelection()`
- `updateBgSelectionOverlay()`

### 3.7 草稿能力增强

`src/ui.js` 当前包含完整的工作台草稿逻辑：

- IndexedDB 保存草稿
- 草稿列表渲染
- 草稿恢复
- 草稿删除
- 草稿重命名
- 草稿导出
- 草稿导入
- 缩略图生成
- 导入数据校验与规范化

相关函数：

- `saveWorkbenchDraft()`
- `restoreWorkbenchDraft()`
- `deleteWorkbenchDraft()`
- `renameWorkbenchDraft()`
- `exportWorkbenchDrafts()`
- `importWorkbenchDrafts()`

### 3.8 编辑能力增强

编辑模块已包含：

- 颜色调整
- 批量替换
- 相近色替换
- 删除色块
- 边缘调整
- 取色填色
- 原图取色
- 框选填色
- 移除底色
- undo / cancel / apply
- 原图对照拖拽与缩放

关键模块：

- `src/features/adjust.js`
- `src/features/delete.js`
- `src/features/edge.js`
- `src/features/zoom.js`
- `src/editor.js`

---

## 4. 架构图谱进展

新增/保留了 Understand Anything 相关产物：

- `understand-view.html`
- `understand-view-standalone.html`
- `scripts/build-understand-static.cjs`
- `scripts/translate-understand-view.cjs`

`understand-view-standalone.html` 是可直接打开的单文件架构图谱，包含：

- 项目描述
- 文件/节点/关系/分层统计
- 搜索框
- 分层视图
- 导览路线
- 主要依赖关系表

当前分层包括：

1. 入口与页面
2. 应用 UI 流程
3. 编辑功能
4. 图像与渲染核心
5. 状态与数据
6. 文档与归档

---

## 5. 当前关键文件职责

| 文件 | 当前职责 |
|------|----------|
| `index.html` | 原始步骤式入口 |
| `workbench.html` | 工作台式主入口，承载新流程 |
| `src/main.js` | DOM 事件绑定、上传、按钮、Canvas/触摸交互入口 |
| `src/ui.js` | 页面流程、工作台状态、草稿、裁剪、像素预览、图纸生成、导出初始化 |
| `src/state.js` | 全局 AppState，包含新工作台和像素预览状态 |
| `src/processor.js` | 图像处理、像素预览、拼豆映射、DeltaE/Redmean、限色、抖动、后处理 |
| `src/renderer.js` | 拼豆 Canvas 渲染、标尺、高亮、边界计算、缩放变换 |
| `src/editor.js` | 编辑共享工具、颜色统计、批量替换、调色板访问 |
| `src/features/adjust.js` | 调色、填色、移除底色、原图取色、对照拖拽 |
| `src/features/delete.js` | 删除色块模式和确认弹窗 |
| `src/features/edge.js` | 边缘色块识别与边缘调整模式 |
| `src/features/zoom.js` | 结果画布缩放和平移 |
| `src/exporter.js` | 图片导出、镜像图、原始图 |

---

## 6. 验证状态

本次归档前执行了只读/静态检查：

```bash
node --check src/*.js src/features/*.js server.js scripts/*.cjs
```

结果：

- 语法检查通过
- 工作区无未提交修改

未执行浏览器端完整人工回归测试。

---

## 7. 已知风险和注意事项

### 7.1 归档曾落后于源码

`20260409` 的归档没有覆盖后续新增的工作台、像素预览、直接映射、草稿导入导出、架构图谱等能力。本次归档已补齐当前状态。

### 7.2 换行符仍需注意

部分文件仍存在 CRLF/LF 混用：

- `src/processor.js`
- `src/features/delete.js`
- `src/features/edge.js`
- `src/features/zoom.js`
- `index.html`
- `css/style.css`

项目规则要求尽量保持 CRLF。后续修改时应避免整文件重写导致换行符大面积变化。

### 7.3 高精度映射性能风险

高精度直接映射路径已做代表采样和 Lab 缓存优化，但仍比标准映射更重。大图、高网格、全色板、DeltaE 同时开启时仍需浏览器实测。

重点关注：

- 104x104 网格
- MARD 221/264 色
- DeltaE
- 色彩限制开启
- 抖动开启

### 7.4 工作台流程复杂度上升

当前工作台已经有多个阶段和状态：

- 原图阶段
- 裁剪阶段
- 像素预览阶段
- 拼豆图纸阶段
- 编辑阶段
- 草稿恢复阶段
- 原图对照阶段

后续改动需要谨慎处理 `AppState` 字段清理，避免残留状态影响下一张图。

### 7.5 浏览器回归仍必要

虽然语法通过，但以下流程仍建议人工回归：

1. 普通入口上传/示例图/生成/导出
2. 工作台上传/裁剪/生成像素预览/生成拼豆图纸
3. 高精度/标准模式切换
4. DeltaE/Redmean 切换
5. 最大颜色数切换
6. 背景移除框选
7. 草稿保存/恢复/导入/导出
8. 原图对照缩放/拖拽/取色
9. 填色/删除/边缘调整/撤回/确认
10. 导出原图/镜像/标注图

---

## 8. 建议下一步

### 高优先级

1. 做一次完整浏览器人工回归测试，优先覆盖工作台主流程。
2. 对高精度直接映射做真实图片性能测试，记录 52/104 网格耗时。
3. 检查工作台按钮和状态文案是否全部中文化、一致化。

### 中优先级

4. 为 `processor.js` 增加更清晰的算法注释或拆分模块，当前文件职责已经较重。
5. 将 `generatePatternData()` 旧路径、`generatePatternDataOriginal()`、`generatePixelArtData()`、`mapPixelArtToBeads()` 的关系整理成文档，降低后续维护成本。
6. 统一换行符，避免 CRLF/LF 混用继续扩大。

### 低优先级

7. 重新生成 Understand Anything 图谱，使 `understand-view-standalone.html` 反映最新函数和工作台状态。
8. 如果当前功能已稳定，补一次 Git 提交，便于后续回退。

---

## 9. 当前状态结论

当前项目已经进入“工作台化 + 两阶段生成 + 高精度拼豆映射”的阶段。

核心能力已经明显超过 `20260409` 归档记录，但稳定性验证仍主要依赖人工浏览器回归。后续开发应优先围绕：

- 工作台流程稳定性
- 高精度算法效果和性能
- 编辑状态互斥与清理
- 草稿数据兼容性
- 导出结果一致性

进行测试和收敛。

---

*Generated during archive command on 2026-06-07 11:56*  
*会话类型：当前项目状态归档 + 工作台/像素预览/高精度映射进展同步*  
*代码修改：仅新增本归档文档*
