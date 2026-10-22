# T14 本机持续接单与暂停

状态：本机免费在线试用已上线并验收；第三方临时隧道无SLA，不是全天候生产承诺。用户已明确授权本机推理、持续接单、手动暂停恢复及公开发布，免费约束继续有效；随后选择手动启动，不添加系统启动项。架构和所有权见IMPLEMENTATION顶部；不新增数据库、全局软件或私有密钥。

冻结队列接口（仅内存）：`new ServiceQueue({execute,release,onPausedChange?,initialPaused?,now?,maxWaiting?,hourlyLimit?,sessionLimit?,ttlMs?})`；`submit(payload)`返回只含id/status/position的view；`get(id)`返回view/result/error或null；`status()`返回paused/active/waiting/accepting/remaining_hour/remaining_session；`pause()`取消等待、不打断active，active完成后release；`resume()`恢复接单；execute(payload)返回Promise<unknown>。任务状态queued/running/completed/failed/cancelled，id使用randomBytes(32) hex。无列表接口，终态30分钟后从内存过期（不删除磁盘文件）。busy/paused/limit由QueueError(code,message)显式拒绝。并发严格1，结果不记录输入payload；执行终结释放payload内存。暂停偏好仅由主代理持久化。

体力代理只拥有queue.ts及对应测试，或public.html/admin.html；主代理拥有server/executor/控制脚本/集成验证。公网9040，本机管理9041，管理URL http://127.0.0.1:9041 。

HTTP冻结：GET /status 返回服务状态；POST /jobs JSON {image_base64,keypoints:[{id,text,claim:null,author_confirmed:true}],consent:true}；GET /jobs/<64hex> 返回job view及终态result。result字段{report,reconstruction_data_url,model,prompt_version,render_audit,limitations}。无服务器run_id/路径。客户端每3秒轮询，结果不放URL/query/localStorage，不自动重试提交。POST只收application/json且同源Origin；公共页面同源自身，静态案例站通过链接进入。管理 GET /status 和POST /pause、/resume；暂停取消排队，当前完成后释放显卡。管理与公网服务器完全分开。

## 最终交付

- 固定入口：https://figure-relay.chicchair5.chatgpt.site ，Check my figure自动读取公开service-status/endpoint.json当前地址。临时地址会变，不应分享为永久入口。
- 本机控制：http://127.0.0.1:9041 。双击`scripts/start-sharing.cmd`手动启动，`scripts/open-service-controls.cmd`打开控制页。暂停偏好保存，空闲卸载模型。安装启动项的脚本仅准备，用户拒绝安装，未执行。
- 服务串行、最多3等待，滚动每小时12次和24小时100次自动恢复；<1GB空闲RAM不接单并在推理前再次检查。访客仅公开PNG/JPEG、10MB/25MP、3–5条确认信息。只公开白名单报告与PNG，不公开历史、私有路径、任意代理或模型端口。
- 正式本地pipeline提供真实推理，独立HTTP边界使用原API模型锁，不启用HF候选桥。结果30分钟内存会话访问，不自动删除本机审计。用户上传前明确同意由作者本机处理并保留私有记录。
- Cloudflare便携程序2026.10.3官方SHA已核对，仅在忽略目录下载；当前网络HTTP2/QUIC连接失败，进程已停，没有修改系统网络。
- 使用已有SSH+localhost.run官方nokey入口，保留主机公钥校验且不读取用户身份密钥；只转发9040。域名在同一连接中真实轮换，后台每20秒健康检测并向专用service-status分支发布公开地址/时间/online字段，最多12次公告尝试/小时；不用main记录心跳。连续三次探测失败公告离线；进程退出时尝试重新连接，失败可能需要人工启动。无可用性保证。

## 证据

- 最终`npm run validate`：16 files / 104 tests、typecheck/lint/生产构建通过。最后favicon/文案修复后另跑受影响HTTP/队列测试及lint。
- `T14-live-first-recovered.json`：首次HTTPS公开材料图完成，首次浏览器GET因ECONNRESET中断，同一个任务重新领取报告/重建，未重交图片、未重跑模型、未替换失败；K为项目整理，不能称独立作者确认。
- 采样显存峰值6627MiB，GPU采样75%、外部观察96%；最低空闲RAM289MiB与开发构建/测试重叠，不能当孤立基准或承诺用户软件流畅；空闲显存约12MiB。
- `T14-browser-final-v3.json`：16/16、零console/page错误；真实固定网页发现当前入口、真实本地暂停恢复、390px界面、弹窗关闭/Esc/焦点、新检查、许可均通过。报告显示使用首次完成记录的明确受控UI回放，零新模型调用。
- 前序`T14-browser-final.json`因过期临时域名中断，`-v2.json`包含按钮名称与favicon问题，均保留；v3修复且不覆盖旧证据。首次浏览器原始错误含会话能力地址，完整记录私存`runs/T14-live-first/browser-failure-private.json`，不公开。
- Sites source commit `69b8706fb1e614badf9c17e67dd918a3a37492ca`；version `appgprj_6ad9acebaf7081918c9ec818c1421b67~appgver_8fda4dcc6e2c81919f5e50def9382633`；deployment `appgdep_6ad9c23f83548191af2d47d3177c2d3f`，succeeded/public。更新仍复用原project，站点源码只在忽略的独立checkout。

未做：真人视觉复核、比赛提交、社交发帖、正式固定隧道或付费资源。原8/12运行、检查点与统计不改。不能因一张线上成功宣称跨领域泛化。
