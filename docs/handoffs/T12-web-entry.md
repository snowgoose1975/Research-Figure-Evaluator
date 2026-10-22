# T12 网页入口与界面重整

授权：玉米确认界面重整，要求研究可供他人直接打开的网页，在线算力免费优先。发布、外部账号、密钥和CI仍遵循AGENTS红线。

## 范围与结构

- 首页：查看真实案例 / 检查自己的图；清楚区分历史真实回放、脚本演示、当前真实推理。
- 案例：三域首次完成与网络首次失败；完整12次协议索引；公开字段白名单、原报告与离线新规则审计分离。资产命名稳定，不覆盖旧证据。
- 工作台：分步选图、确认信息、运行；结果图像与复核在前，记忆/审计在展开层。
- 托管：先准备只读公开入口；当前工作台的全局历史与单活动运行不适合直接公网多用户。免费在线推理候选ZeroGPU需另做Gradio适配和实际硬件测试，不宣称已可用。

## 所有权与验证

脑力：主代理冻结产品/数据边界、审核公开产物、集成和验证。体力：Luna实现冻结后的工作台界面。

完成条件：`npm run validate`；桌面/390px浏览器首次访问、无模型案例、失败披露、工作台分步、回放只读与无秘密字段检查；新标签证据。模型统计保持8/12，不触发新模型调用。

## 当前状态

已实现本地新版入口、分步工作台、四个独立真实案例回放，以及隔离只读静态包。当前未部署，尚无外网入口。静态包可独立预览于 http://127.0.0.1:3001；本地完整应用于 http://127.0.0.1:3000。

## 公开数据审核

Luna只读审核核对了四份源manifest SHA、论文许可、完整12次索引与固定选择规则。初版导出保留了旧协议 `author_confirmed=true`，容易被误解为作者人工确认，因此初版JSON未提交、未纳入静态包，仍保留在本地供追溯。公开v2投影改为不含此布尔字段，只保留 `confirmation_provenance=protocol_marked_not_independently_confirmed`；旧run和原报告未修改。不要将忽略中的index.json/record.json复制到发布站点。前端只读index-v2.json、record-v2.json。

## 免费在线分析的结论与下一阶段方案

2026-10-22，通过Hugging Face插件确认用户账号 `MarqueeMoon`，非PRO；公开账号资料注册时间为2026-09-14，已超过30天。邮箱验证和平台实际开通资格尚未确认。插件已获仓库贡献权限，不等于已创建Space或获得GPU。

- [Hugging Face官方ZeroGPU说明](https://huggingface.co/docs/hub/spaces-zerogpu)：符合条件免费个人账号（邮箱验证、注册超过30天）可托管最多2个ZeroGPU Space；排队和每日配额适用，当前仅支持Gradio/PyTorch。不能直接运行现有Ollama/Node服务器，也不能保证匿名访客配额足够整条链路。
- [Spaces官方概览](https://huggingface.co/docs/hub/spaces-overview)：静态Space免费；CPU Basic虽无小时费用，但新建Gradio/Docker计算Space有账号计划限制，不能把“CPU免费”解释为人人可免费新建Docker服务。
- 已准备可公开的静态案例站、HF元数据与字段白名单。该站只读，不承诺新图在线推理。
- 下一阶段建议先确认ZeroGPU实际可选，再实现Gradio分析入口，复用本项目的盲读边界、记忆校验、确定性绘图和评估语义；模型改为HF PyTorch权重时新增协议版本，不混算旧Ollama统计。先用1张已许可图验证A→重建→B，记录排队/失败/实际配额，再开放上传。
- 新在线流程必须实现会话隔离、上传限制、单任务/排队上限和显式保存政策；不把当前单用户全局历史接口放到公网。免费并不等于永远在线或不限用。
- 这是后续架构适配方案，尚未实现或验证。当前没有发布、没有创建Space、没有使用付费GPU/API，也没有把用户电脑暴露到公网。

## 实际验证与可审查交付

- `npm run validate`：13 files / 90 tests、typecheck、lint（0 warning）、生产构建成功。
- `node scripts/build-public-demo.mjs --label T12-public-final`：静态导出只含首页/404/icon，无API route；包含HF静态Space README。隔离构建未导入真实Workbench，排除初版JSON，未复制私有runs或环境文件。系统临时构建目录按规则保留，不自动清理。
- `node scripts/t12-browser.mjs --public --label T12-public-final-browser`：15/15；浏览器无私有API请求，四图回放/失败/12次索引/390px布局及静态API404通过，无console/page error。
- 本地 `T12-local-browser-v1.json`：19/19，含三步门槛、一次明确标注的脚本演示（非模型实验）、大图在复核前、技术记录收起、旧run深链接。
- `node scripts/history-browser.mjs --label T12-history-browser-v1`：24/24，预期不存在ID的404保留，其余无错误。
- `T12-final-visual.json`：3/3，两张工作台完整图片在容器内且object-fit=contain，手机首页无横溢。已视觉检查首页、手机案例及修复后的图片对照。
- 初版静态包的缺失favicon 404按失败证据保留，不以重跑覆盖；最终版已修复。所有公共JSON均为显式白名单，原报告与新离线audit分开。
- 浏览器入口 `scripts/browser-smoke.mjs` 已转到T12流程，历史/coverage脚本适配新入口和技术折叠层；旧验证材料按历史版本阅读。

候选公开目标：免费HF Static Space `MarqueeMoon/figure-relay`（尚未创建；可用性/名称需发布时确认）。此目标只发布已验收静态包；ZeroGPU真实分析为独立下一阶段，需另行冻结新协议并实际验证。
