# T13 图片查看、作者任务与公开发布

用户已授权真实发布和免费在线适配。当前范围：修复图片退出、以作者传达预期科学信息为产品目标重整措辞，发布可审核网页，再接真实分析；免费算力与阶段实际状态必须真实披露。

脑力：主代理冻结数据流与免费GPU适配、发布和验收。体力：Luna只改入口图片交互/文案、相关样式。严禁改变旧实验、科学判定或伪装新图在线可用。

验证：dialog关闭按钮/Esc/遮罩/焦点、首页目标和手机显示、原工作台与静态回放；`npm run validate`；公开站版本/地址实际成功核验。发布授权已给，不重复索取。HF插件中途恢复；未读取其凭据。Sites承担已上线的只读案例站，GPU候选状态独立披露。

状态：公开案例站已上线，免费新图分析未上线。

## 实际交付与阻断

- 外网：https://figure-relay.chicchair5.chatgpt.site ，public audience，Sites部署成功；Edge外网13/13检查、无console/page错误，证据`T13-public-online.json`。本地静态v3也13/13，早期焦点/手机点击失败证据保留。
- project：`appgprj_6ad9acebaf7081918c9ec818c1421b67`；version：`appgprj_6ad9acebaf7081918c9ec818c1421b67~appgver_53e9cbcfee0481918266b524cf755e1f`；deployment：`appgdep_6ad9b5850fcc81919e37b20e44423137`。
- 独立站源码commit `a18f16ee7d2ea7277c1fd823e17ec8ab79cf63a8`。站点manifest在忽略目录`artifacts/web-preview/figure-relay-site/`，后续复用此project，不重复创建。
- `npm run validate`最终通过：14文件94测试、typecheck/lint/生产构建。第一次沙箱构建因EPERM失败，同命令完整复验成功，无代码绕过。
- Python relay6项测试通过，共享Node桥4项通过，GPU入口与bootstrap仅做语法检查。独立上传包使用`node scripts/build-hf-space.mjs --label <new-label>`生成，最新包`artifacts/web-preview/T13-hf-space-v2/`，不覆盖旧包。Node校验归档SHA256、只在Space项目内安装依赖，不修改系统。
- 首个真实本地新relay测试失败：materials，A标记incomplete_memory，13.28秒，input5074/output129，finish_reason stop，单次HTTP，无B/judge和替换重跑。`T13-local-relay-live.json`是新适配链路失败证据，不是HF GPU测试，不混入旧8/12。
- HF插件已恢复；账号MarqueeMoon为free。创建Gradio Space被默认cpu-basic的PRO限制拒绝，仓库未创建；插件无上传文件和选择ZeroGPU硬件接口。用户随后截图确认创建页Gradio/Docker均为Paid，此账号当前免费路线被阻断。未购买或开启付费资源；此前免费ZeroGPU可直接使用的判断过早。
- 待完成：可用免费算力渠道、实际启动/登录注入/GPU分配/三阶段真实运行/缓存验证。候选适配不能宣称可用。Gradio上传临时缓存可能约10–20分钟或更长，UI提示只上传公开图。独立模型请求不构成统计独立，重建缺陷不等于原图缺陷。
- 社交发帖、比赛提交未执行；公开网页发布已获明确授权并执行。

## 免费分析适配冻结接口

HF Space采用Gradio/PyTorch GPU函数和无持久运行目录的Node语义桥。Node复用既有Memory/Intent校验、投影/绘图和评估，不重写第二套科学规则。新协议`hf-zerogpu-0.1`，不混算Ollama结果。Python只编排每会话子进程和独立模型请求；不把K放到A/B，不提供共享历史；单次流程最多A、B、judge三次，任一失败停止，不重跑补成功。

JSONL：初始`{type:'start',image_base64,keypoints}`。Node发`{type:'request',id,stage,prompt,schema,image_base64,max_output_tokens}`；stage/id为reading_a、reading_b或judging，A/B使用同一盲读prompt但不同独立图片，judge才包含K/A/B。Python回`{id,response:{text,input_tokens?,output_tokens?,finish_reason}}`。length显式失败；不补缺失usage。终态`{type:'result',protocol,a,b,report,render_audit,reconstruction_png_base64,stages}`或`{type:'error',stage,code,message}`。无图片/模型文本写日志，无跨会话目录或原图回流B。

主代理拥有bridge.ts、GPU app、构建与科学验收；Luna拥有relay.py及纯离线编排测试。独立测试证明输入隔离/失败停机，不冒充真实GPU验证。
