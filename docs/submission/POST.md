# Social post draft（草稿，未发布）

用途：第四届 Open Scientific Intelligence Hackathon 提交帖。发布本身需玉米明确授权；链接、标签、账号按官方 Slack 最终入口替换。

## 英文正文（建议）

What does an AI reader actually take from your figure?

Figure Relay makes that answer inspectable. Reader A sees only the original published figure and writes a structured memory: entities, relationships, conditions, axes, series, uncertainty. A deterministic renderer draws a new figure from that memory alone. Reader B then sees only the reconstruction. The author's checkpoints are compared against both memories, so each loss is attributed to the first read, the rendering, or the second read — instead of hiding behind one similarity score.

We ran a fixed protocol on four attributed CC BY research figures (nonlinear physics, lattice design, network analysis) with a local Qwen3-VL 4B model: 8 of 12 runs completed, every failure recorded, no retries swapped in. By label-level matching, all completed runs kept every confirmed checkpoint in both readers — and the reconstructions still lost real content: a lattice diagram collapsed into three labelled boxes, confidence bands vanished because the schema had no field for them. A project-curated threshold/flatness check with a tolerance basis frozen from the source panel now judges both reads contradicted: A sampled the flat `alpha = 0.05` line as y=0, and B recorded it as a falling (0,1)→(3,0). The earlier 0.05 tolerance that accepted A's zero is superseded, so "retained" is no longer treated as scientific fidelity. The app reports which checks actually ran, what they could not cover, and flags semantic matches for human review; an isolated direct-check baseline lets the round trip be compared against just reading the image.

Built as a local Next.js app with Ollama; zero API fees, private runs, exportable reports.

Repo: [link]
Demo (≤4 min): [link]
Write-up: [link]

Limitations: AI-simulated reader feedback only, not human memory measurement; small sample; same-model requests are not statistically independent.

## 中文备用（如需中文帖）

你的科研图，AI 读者究竟看懂了什么？Figure Relay 让 A 只看原图写结构化记忆，确定性渲染器只按记忆重画，B 只看重画图；作者检查点分别对照两次阅读，明确损失发生在“首次理解、绘图表达还是再次阅读”。四张 CC BY 论文图、本地 4B 视觉模型、固定协议 8/12 完成，全部失败保留；完成运行按标签检查点全保留，但带独立容差依据的项目整理 alpha 阈值/恒定性检查在真实数学运行上判 A 把平坦 0.05 参考线采成 y=0、B 又读成 (0,1)→(3,0)，两次阅读都判 contradicted；重建仍丢失晶格几何与置信带——这正是产品要暴露的东西。报告还会标明哪些检查实际执行、哪些未覆盖。本地运行、零 API 费用、报告可导出。

## 附件建议

- 主图：`artifacts/validation/live-browser-math-result.png`（含原图、重建、逐项结果、基线）。
- 次图：`artifacts/validation/live-browser-math-setup.png`（检查点与隔离说明）或物理重建截图。
- 视频：尚未录制；脚本见 `DEMO_SCRIPT.md`，时长控制在 2 分钟或 ≤4 分钟。

## 发布前核查

1. 不使用未授权的论文原图；所附图为 CC BY 4.0，帖内保留署名与许可说明。
2. 所有数字与 `docs/DELIVERY_VALIDATION.md` 一致；失败运行不删除、不改述。
3. 链接可用、仓库已按玉米授权 push；否则删去链接或标注 “local demo”。
4. 标签、@ 账号、提交表单以官方 Slack 当届公告为准。
