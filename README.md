# Research Figure Evaluator / Figure Relay

科研图 → AI 阅读 → 显式记忆 → 确定性重建 → AI 再读 → 逐项检查作者的关键信息。

**当前为可运行应用，已含真实本地视觉模型闭环证据。** 四张真实论文图已接入（物理、材料、数学网络、数学 metric 双面板），来源和 CC BY 许可随图显示。固定协议 4 图 × 3 次共完成 8/12；所有失败显式记录，未重跑替换。T09 修正了语义结果覆盖科学规则、双侧面板歧义、阈值容差和 partial usage；T10 修正小量级阈值误判与 B-only 面板漏报，并给证据生成脚本加独立命名和默认拒绝覆盖保护。当前 11 个测试文件 75 项通过。数字与限制见 `docs/DELIVERY_VALIDATION.md`。教学样例使用明确标记的脚本记忆，不代表模型实验结果。

## 启动

需要 Node.js >=22.12；依赖均为项目局部安装。

```powershell
npm ci
npm run dev
```

打开 http://127.0.0.1:3000 。当前工作区已安装依赖，可直接运行第二条。生产模式使用 `npm run build` 后 `npm start`。

## 使用

选择真实论文图或上传 PNG/JPEG，填写并确认 3–5 条关键点，启动真实检查。报告展示原图、重建图、A/B 记忆、逐项保留或偏差、绘图审计、检测覆盖（哪些检查实际执行、哪些未覆盖）和科学发现，支持 Markdown/JSON 导出、同条件运行比较、历史列表与深链接回放（`/?run=<run-id>`）。

完整操作步骤、结果字段解释和故障排查见 [使用手册](docs/USER_GUIDE.md)。

没有视觉模型时，可在 Engineering controls 中体验六组教学样例；真实论文图禁止使用脚本模式。产品模拟 AI 读者，不测量真人记忆，不验证论文结论，也不提供未经验证的综合质量分。

## 本地视觉模型

默认连接 Ollama：`http://127.0.0.1:11434/v1`，无需 API key。实测在 8GB 显存机器上 `qwen3-vl:4b-instruct` 可用，需派生 16k 上下文版本（8B 在此配置下溢出显存，仅适合更大显存）：

```powershell
ollama pull qwen3-vl:4b-instruct
ollama create qwen3-vl:4b-instruct-16k -f scripts/Modelfile.qwen3-vl-4b-instruct-16k
npm run dev
```

应用默认对本地 Ollama 使用 `qwen3-vl:4b-instruct-16k` 和 10000 输出上限，通常不需要设置环境变量。要显式覆盖时，在 PowerShell 中先设置再启动：

```powershell
$env:RFE_MODEL="qwen3-vl:4b-instruct-16k"
$env:RFE_MAX_OUTPUT_TOKENS="10000"
npm run dev
```

默认 4096 上下文放不下“图片 + 完整 JSON schema + 提取结果”，必须用派生模型或调大 `num_ctx`；输出上限 10000 是实测下较快且能完成多数图的配置。32k/14000 在 8GB 显存上会溢出到 CPU，单次约 20 分钟；8000 输出会让复杂的物理图截断。思考型 `qwen3-vl:*b` 会把输出预算耗在隐藏推理上，应使用 `-instruct` 变体；8B 在本机同样溢出显存，只作抽查。

本机 `ollama pull` 曾在 Cloudflare 层卡住（下载目标解析到 198.18.0.7），绕开办法是用 curl 按 registry manifest 逐个 blob 下载到 `~/.ollama/models/blobs/`，写入 `~/.ollama/models/manifests/registry.ollama.ai/library/<model>/<tag>`，再用 `ollama list` 和 sha256 校验。这是网络环境适配，不是产品逻辑；不要修改系统 DNS/代理或关闭下载安全检查。

`/api/status` 显示 `configured: true` 才可做真实运行。主链路三次模型调用（A、B、语义检查），可选独立直接检查增加一次；同模型独立请求不等于统计独立。

## 验证和交接

```powershell
npm run validate
node scripts/smoke-api.mjs --label T11-api-smoke
node scripts/browser-smoke.mjs --label T11-browser-smoke
node scripts/history-browser.mjs --label T11-history-browser
node scripts/t09-legacy-coverage.mjs --label T11-legacy-coverage
npx tsx scripts/t09-boundary-probes.ts --label T11-boundary-probes
npx tsx scripts/t08-scientific-regression.ts --label T11-scientific-regression
npx tsx scripts/t08-audit-stub.ts --label T11-audit-stub
```

后几项需要本地服务运行；浏览器脚本使用本机 Microsoft Edge。验证产物在 `artifacts/validation/`，私有输入和运行记录在忽略提交的 `runs/`。证据文件不可覆盖：脚本默认拒绝写入已存在的同名文件，重跑时用新的 `--label`；已存在的历史证据不要删除或改名来绕过保护。

继续开发先读 [项目规则](AGENTS.md)、[DeepSeek 交接](docs/HANDOFF.md)、[当前实现合同](docs/IMPLEMENTATION.md)。[真实论文图来源](docs/REAL_FIGURES.md)、[比赛信息](docs/COMPETITION.md)、[历史总纲](docs/MASTER_PLAN.md) 保留供复核。

尚未 git push、部署、发布或提交比赛；这些操作需玉米明确许可。
