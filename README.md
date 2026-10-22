# Research Figure Evaluator / Figure Relay

**AI-reader round-trip diagnostics for scientific figures.** An image-only reader extracts a structured memory; a deterministic renderer reconstructs it; a separate image-only request reads the reconstruction. Reports compare author checkpoints, expose record-level scientific differences, and distinguish reconstruction gaps from unchecked content. This is not a measure of human memory or scientific correctness.

**Public website:** [Figure Relay](https://figure-relay.chicchair5.chatgpt.site) — browse four recorded real cases without installing anything. Image previews close with the Close image button, Escape, or the backdrop. **New-image analysis is available locally; free hosted analysis is not connected yet.**

**Evidence:** 4 published, CC BY figures across physics, materials and mathematics; 8/12 attempts completed under a fixed local-model protocol. The 4 failures remain counted. Label retention did not guarantee fidelity: a threshold line changed shape and lattice geometry was lost. See the [English write-up](docs/submission/WRITEUP.md), [latest one-page PDF](artifacts/validation/T11-public-writeup-writeup-one-page.pdf) and [validation record](docs/DELIVERY_VALIDATION.md).

**Try locally:** Node.js >=22.12, then `npm ci` and `npm run dev`; open http://127.0.0.1:3000. Browse four **recorded real cases** immediately, without a model or private run files. Choose **Check my figure** for the three-step workspace. Engineering controls also offer a clearly labeled Scripted tutorial under Advanced options in step 3. For real inference, install Ollama separately, run `ollama pull qwen3-vl:4b-instruct`, then `ollama create qwen3-vl:4b-instruct-16k -f scripts/Modelfile.qwen3-vl-4b-instruct-16k`. The app defaults to that local model. Shareable evidence is in `artifacts/validation/`.

**Public website package:** `node scripts/build-public-demo.mjs --label my-public-version` builds a separate static site in `artifacts/web-preview/my-public-version/`. It excludes private APIs, uploads, model access and unreviewed first-export JSON. The free ZeroGPU candidate is in `adapters/huggingface/`; prepare it with `node scripts/build-hf-space.mjs --label my-space-v1`. Its GPU runtime is unvalidated: the HF connector cannot select ZeroGPU hardware and default Gradio creation was rejected by the platform's PRO requirement. The first local integration of this new relay failed explicitly at reader A; it is not included in the original 8/12. Do not expose the current single-user workspace server as a multi-user service.

---

科研图 → AI 阅读 → 显式记忆 → 确定性重建 → AI 再读 → 逐项检查作者的关键信息。

**公开网页已上线，可浏览真实历史案例；新图分析仍需本地运行。** 四张论文图覆盖物理、材料、数学，来源与CC BY许可随图显示；固定协议4图×3次完成8/12，失败均保留，不能当作泛化准确率。首页围绕作者预期信息、模拟阅读与修改展开；大图支持关闭按钮/Esc/遮罩退出，外网13项交互检查通过。教学脚本、历史真实回放和当前真实推理严格区分。具体数字与限制见 `docs/DELIVERY_VALIDATION.md`。

## 启动

需要 Node.js >=22.12；依赖均为项目局部安装。

```powershell
npm ci
npm run dev
```

打开 http://127.0.0.1:3000 。当前工作区已安装依赖，可直接运行第二条。生产模式使用 `npm run build` 后 `npm start`。

## 使用

首页可直接浏览四个真实历史案例（含失败）与全部12次固定协议结果。点击 Check my figure 后按“选图 → 确认信息 → 运行”三步操作，填写并确认3–5条关键点。报告优先大图对照与复核清单，A/B记忆和技术审计默认收起，支持Markdown/JSON导出、同条件运行比较、历史列表与深链接回放（`/?run=<run-id>`）。公开案例另有 `/?case=<case-id>`，不依赖私有runs。

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

代码已推送到 [GitHub 仓库](https://github.com/snowgoose1975/Research-Figure-Evaluator) 的 `main`。本地私有 `runs/` 不随仓库公开；旧运行的离线回归和历史检查需要对应本地记录，新克隆可直接运行单测和教学流程。尚未部署、发布社交帖子或提交比赛。
