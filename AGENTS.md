# Perler Beads 项目 - AI 助手开发规则

> 本文件供所有参与此项目的 AI 助手阅读，包含项目约定、开发规范和历史经验教训。
> 每次会话开始时请先阅读本文件和最新的 `docs/archive/DEVELOPMENT_SUMMARY_*.md`。

---

## 1. 项目概览

**拼豆图案生成器**：上传图片 → 自动像素化 → 匹配拼豆颜色调色板 → 生成可打印图纸。

### 技术栈
- 纯前端：HTML + Vanilla JS（ES Module）+ Tailwind CSS（CDN）
- 无构建工具、无框架、无后端
- 入口：`index.html`，逻辑分布在 `src/` 下 8 个模块

### 模块职责

| 文件 | 职责 |
|------|------|
| `src/main.js` | 事件绑定入口，DOMContentLoaded 里绑定所有按钮和画布事件 |
| `src/ui.js` | UI 交互逻辑：颜色调整、删除色块、边缘调整、缩放平移、颜色清单 |
| `src/state.js` | 全局状态 `AppState`，所有模块共享 |
| `src/renderer.js` | Canvas 渲染：图纸绘制、缩放变换、坐标系计算 |
| `src/processor.js` | 图像处理：背景移除、颜色量化、抖动算法、调色板过滤 |
| `src/constants.js` | 调色板数据（Perler/Hama/Artkal/MARD） |
| `src/exporter.js` | 图片导出（原图/镜像/带标注） |
| `src/utils.js` | 通用工具函数 |

---

## 2. 关键状态字段（AppState）

修改前必须理解这些字段的含义，改错会影响多个功能：

```js
AppState = {
    // 编辑模式：'none' | 'adjust' | 'delete'
    editMode,

    // 调整阶段：'waiting_receiver' | 'waiting_donor'
    adjustPhase,

    // 颜色调整：接收格（被替换）的索引和颜色ID
    receiverIndex,
    receiverColorId,

    // 暂存区：所有调整/删除操作在此进行，confirm 后写入 pixelData
    stagedPixelData,
    stagedActions,  // 撤回栈

    // 渲染坐标系（renderer.js 每次渲染后更新）
    renderedMinX,   // 内容包围盒左边界（原始坐标）
    renderedMinY,   // 内容包围盒上边界（原始坐标）
    renderedContentWidth,
    renderedContentHeight,

    // 缩放平移状态
    zoomState: { scale, x, y, isDragging, lastX, lastY, lastDist },

    // 批量替换（颜色清单菜单触发）
    batchReplace: { active, mode, sourceColorId, nearCandidates, nearBaseline, nearCurrentId },

    // 边缘调整
    edgeSelectionMode,
    selectedEdgeBeadsIndices,

    deleteMode,
    highlightedColorId,
}
```

---

## 3. 坐标系说明（重要）

渲染器使用**内容包围盒坐标系**，不是固定画板坐标系：

```
canvas 像素坐标 = gridOffset + (globalX - renderedMinX) * scale
```

- `scale = 30`（每格 30px）
- `gridOffset = 30`（左上标尺占 1 格）
- `renderedMinX/Y`：内容最小 X/Y（每次 renderResult 后更新到 AppState）

### 点击坐标转网格坐标的正确公式

```js
// rect = canvas.getBoundingClientRect()
const localX = e.clientX - rect.left;
const localY = e.clientY - rect.top;
// 注意：localX 已是相对 canvas 显示左上角的偏移，直接除以 scale
const canvasX = localX / AppState.zoomState.scale;
const canvasY = localY / AppState.zoomState.scale;
const xOnRenderedGrid = Math.floor((canvasX - gridOffset) / scale);
const yOnRenderedGrid = Math.floor((canvasY - gridOffset) / scale);
const gx = AppState.renderedMinX + xOnRenderedGrid;  // 原始 pixelData 坐标
const gy = AppState.renderedMinY + yOnRenderedGrid;
const idx = gy * AppState.gridWidth + gx;
```

**常见错误**：不要用 `(localX - zoomState.x) / zoomState.scale`，`zoomState.x` 是容器级偏移，`getBoundingClientRect` 已经包含了它。

---

## 4. 编辑模式的互斥关系

三种编辑模式完全互斥，进入任意一种会自动退出其他：

```
adjust（颜色调整）
  ├─ 普通子模式：两阶段单格替换（waiting_receiver → waiting_donor）
  ├─ from_canvas：点击画布选色后批量替换（batchReplace.mode === 'from_canvas'）
  ├─ nearby：颜色清单选相近色替换（batchReplace.mode === 'nearby'）
  └─ edge：边缘色块批量替换（edgeSelectionMode === true）

delete（删除色块）：点击单格 → 确认弹窗 → 设为 NONE

none：正常浏览模式，可拖拽平移
```

**在 adjust 或 delete 模式下必须禁用拖拽**，相关事件检查：

```js
// main.js 中以下事件都要检查
mousedown:  if (editMode === 'adjust' || editMode === 'delete') return;
mousemove:  if (editMode === 'adjust' || editMode === 'delete') return;
mouseup:    if (editMode === 'adjust' || editMode === 'delete') return;
touchstart: if (editMode === 'adjust' || editMode === 'delete') return;
touchmove:  if (editMode === 'adjust' || editMode === 'delete') return;
touchend:   if (editMode === 'adjust' || editMode === 'delete') return;
```

---

## 5. 撤回栈的数据格式

`stagedActions` 支持两种格式，`adjustUndo` 通过 `Array.isArray(action.indices)` 区分：

```js
// 单格操作（颜色调整单格替换、删除色块）
{ index: number, prevColor: {id,r,g,b}, nextColor: {id,r,g,b} }

// 批量操作（from_canvas 批量替换、边缘调整）
{ indices: number[], prevColors: [{id,r,g,b},...], nextColor: {id,r,g,b} }
```

---

## 6. 文件编码规范

- 所有 `src/` 下的 JS 文件：**CRLF 换行符，UTF-8 编码**
- `index.html`、`css/style.css`：CRLF
- 不要混用 LF 和 CRLF，会导致 StrReplace 工具匹配失败

---

## 7. 改动安全规范

### 改动前必做
1. 阅读被修改函数的完整代码，不要只看片段
2. 用 `Grep` 搜索函数名，确认所有调用方
3. 列出该函数涉及的 `AppState` 字段，评估影响范围
4. 确认改动不会影响其他编辑模式

### 改动中
- 一次只改一件事，改完立即验证
- 优先使用 `StrReplace` 工具精确替换，避免整文件重写
- 不要用 PowerShell here-string 做多行替换（换行符不稳定）
- 用 `ReadLints` 检查每次改动后是否引入语法错误

### 改动后
- 运行 `ReadLints` 确认无 lint 错误
- 在浏览器中测试被改动的功能
- 同时测试相关联的功能（同一函数服务多个模式时）
- 通过后执行 `git commit`，提交信息说明改了什么、为什么

---

## 8. 归档规范

收到"**一键归档**"指令时：
1. 分析当前会话的所有改动
2. 生成总结文档，保存到 `docs/archive/DEVELOPMENT_SUMMARY_YYYYMMDD_HHMM.md`
3. 内容包含：功能变更、修改文件清单、已知 Bug 现状、下一步计划

---

## 9. 已知历史问题和经验教训

### 坐标系问题（已修复）
- `drawReceiverOutline` ��ʹ�þɵĹ̶���������ϵ��boardSize 52/104�������Ѹ�Ϊ renderedMinX/Y
- �������ת��������ؼ�ȥ zoomState.x/y�����޸�Ϊֱ�ӳ��� scale

### ��ģʽ���ú����ķ���
- handleResultCanvasClickForAdjust ͬʱ���� 4 ����ģʽ����ͨ����/from_canvas/��Ե����/ɾ����
- �޸�ʱ���������з�֧������ֻ��һ����֧
- ��ק�¼����ֻ�ų��� adjust ģʽ����©�� delete ģʽ������ɾ��ʱ��������

### state.js �ṹ�𻵣����޸���
- ������ PowerShell �ַ����滻ʧ�ܵ��� state.js ����˳�����
- ��������д�������ֶ�˳��
- ��ѵ����Ҫ�� PowerShell here-string �����ӵĶ����滻

### ���з����ã����޸���
- ui.js��main.js��processor.js ������ LF/CRLF ����
- ���� StrReplace ���߷���ʧ�ܣ��������ֽڲ����ƹ�
- ��ͳһΪ CRLF�����ֱ���� StrReplace ����

### ������պ����Ŷ�ʧ
- ��� PowerShell ������������ export function ǰȱ�� } �����
- ���� SyntaxError: Unexpected token 'export'
- ÿ�β���������� ReadLints ��֤�﷨���� Read Ŀ�Ӽ������ǰ�������

---

## 10. ��ǰ����״̬������ 2026-03-18��

### ��������
- ͼƬ�ϴ� / ʾ��ͼƬ����
- �����Ƴ��������䣩����������Ƭ����
- �����ܶȵ�����Ʒ��/��װѡ����ɫ���ơ������㷨
- ͼֽ������Ԥ��
- �������ţ�����/˫ָ����ƽ�ƣ���ק��
- ��ɫ�嵥��ʾ����ɫ����
- ��ɫ�������������׶��滻�����ѡ������ѡɫ��
- ��ɫ��������ͼֽ�����滻��from_canvas��
- ��ɫ�����������ɫ�滻��nearby����ʵʱԤ����
- ɾ��ɫ�飺������ɾ������ȷ�ϵ�����
- ��Ե�������Զ�ʶ���Ե�������滻��ɫ
- ���� / ȡ�� / ȷ�ϣ����б༭ģʽͨ�ã�
- ͼƬ������ԭͼ/����/����ע��

### ��֪����
- ���Զ������ԣ��Ķ������˹��������֤
- ���ܶ�������Ӳ���룬δ�����û��ɵ�
- JPG����͸��ͨ������Ե��ɫ��������

---

*���ļ��� Claude ������ 2026-03-18������ÿ���ش�Ķ���ͬ�����¡�*