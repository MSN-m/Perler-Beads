# 开发归档：网站图标与 Chrome 安装应用图标

时间：2026-10-06 03:03（Asia/Shanghai）

## 1. 功能变更

- 使用用户提供的 /Users/msn/Desktop/Frame 34.png 作为网站图标。原图复制至 assets/favicon.png（2242×2148，约2MB），用户桌面原文件保持。
- 原图补为正方形后等比例缩放，生成标签页64×64、Apple触控180×180、Chrome应用192×192和512×512 PNG。
- index.html引入favicon、apple-touch-icon和manifest.webmanifest，图标URL增加版本参数。
- Manifest配置应用名称、短名、./index.html身份与启动入口、./范围、standalone显示模式及两种应用图标。
- 未新增Service Worker、离线缓存、草稿存储变更或编辑逻辑。本轮归档仅更新文档。

## 2. 排查与结论

- 首次仅设置favicon，未覆盖安装应用图标；之后依据Dock截图按Safari判断并补apple-touch-icon。
- 用户进一步明确为Chrome，截图“Open in 拼豆图案生成器”是打开已安装的应用。Safari解释不适用于该场景。
- 补齐Chrome所用Manifest与规范尺寸图标。已安装应用可能仍沿用旧图标，刷新网页不保证立即更新，实际Dock效果仍待确认。
- 关闭应用、刷新Chrome网页并重新打开可用于检查更新；若重新安装，不勾选清除网站数据，保护本地草稿。不能声称旧应用图标已修好。

## 3. 修改文件清单

- index.html：三种图标/Manifest引用，保留CRLF。
- manifest.webmanifest：新增应用元数据与图标配置。
- assets/favicon.png：用户原始图片副本。
- assets/favicon-64.png、assets/apple-touch-icon.png、assets/app-icon-192.png、assets/app-icon-512.png：生成的图标尺寸。
- docs/PROJECT_CORE.md、docs/PRODUCT_GUARDRAILS.md、本归档。

之前自动保存、退出保护等工作区改动仍保留，本轮未重新修改这些业务功能。

## 4. 验证与已知问题

- localhost:8090下Manifest可解析，192与512图标请求返回HTTP200，Content-Type为image/png。
- git diff --check通过；未重新运行功能测试。此前69项自动检查结果属于上一轮代码验证。
- Chrome已有安装应用实际图标尚未验收；Safari、移动端安装图标也未实机确认。
- Codex内置浏览器刷新兼容问题继续按用户决定搁置，Chrome未保存提醒、页面内退出确认和五分钟自动保存要求保持。
- 历史恢复原生confirm兼容、真实下载、自动保存实际周期、PAD/手机及固定标尺跨端回归仍待完成；PC工具栏位置/间距/布局与像素画完整覆盖待办保持。

## 5. 下一步

1. 用户确认Chrome安装应用的新图标是否显示；若仍未更新，检查实际Chrome安装来源、Manifest关联与图标缓存，保留网站数据。
2. 回到恢复记录规划：首页管理各张图纸、编辑页针对当前图纸及版本，尚未拆分实现；每图纸独立一份自动恢复。
3. “不保存返回”目前保留自动记录，清理策略后续明确；查看大图、另存为、导出弹窗、参考图按需上传仍待开发任务。

## 6. 文档同步

- PROJECT_CORE.md已更新最新归档链接、图标资源、Chrome场景纠正与验收状态。
- PRODUCT_GUARDRAILS.md已增加安装应用身份、草稿数据保护及图标验收边界。
- 未执行git add、commit或push。

参考：Chrome应用Manifest https://web.dev/articles/add-manifest ，应用元数据更新 https://developer.chrome.com/blog/improvements-to-web-app-updates 。
