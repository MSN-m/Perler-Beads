# 小红书小工具构建

正式网页继续使用根目录 `index.html`。小工具从同一份源码生成独立产物，专用模块位于 `src/platform/minitool/`，不会自动改变网页行为。

构建依赖只在构建机使用：Python 3、Node 22+、esbuild 0.25.12、lightningcss 1.30.2。不需要项目运行时 npm 依赖，也不能把这些工具放入 ZIP。

```sh
python3 scripts/build-minitool.py \
  --node /path/to/node \
  --esbuild /path/to/esbuild \
  --lightningcss /path/to/lightningcss \
  --output outputs/new-minitool-build
```

`--output` 必须是项目内专用的空目录。脚本会校验关键源码替换位置，正式源码变化时替换失配会停止，不能直接绕过断言。默认工具路径是本次构建使用的 `/private/tmp/perler-minitool-build-tools/`，临时目录清理后需重新准备固定版本工具并传入路径。

脚本输出经典 `app.js`、classic `pixel-worker.js`、兼容样式和必需资源，随后执行 Skill 审计、禁止能力与资源门禁，生成 ZIP、输入依赖清单和哈希。ZIP 必须在平台模拟器与 iOS/Android 真机验证；普通浏览器模拟接口仅用于回归逻辑。

已知待维护测试：`renderer-grid-layer.test.mjs` 中手机嵌入式标尺断言未跟随已确认的手机固定标尺规则更新。具体范围见交付目录的校验摘要。

示例分组库及更新步骤见 `docs/MINITOOL_EXAMPLE_LIBRARY.md`。如仅需编译并审计预览，在上述命令追加 `--preview-only`，不会生成 ZIP。小工具分组数据由 `assets/data/minitool-examples/catalog.json` 管理，网页示例数据保持独立。
