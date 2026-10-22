# 接口合同草案 v0.1

更新：实现已获授权；跨领域 v0.2 设计见 [IMPLEMENTATION](IMPLEMENTATION.md)，实际冻结类型以 `src/lib/schemas/index.ts` 为准。本文保留初稿的科学约束与决策背景，不再限制输入为机制流程图。

这是交给强模型 T00/T04 冻结并落地的设计合同，不是已经存在的代码。未经二者共同对齐，体力型任务不得自定 schema。确需改动，先在此记录理由、影响模块与兼容方式，再更新实现和 fixture。

## 1. 统一约定

- `schema_version` 起始为 `0.1.0`；时间使用 UTC ISO 8601，界面转为 Asia/Shanghai。
- ID 为非敏感字符串；A/B 局部 ID 不要求相同。跨阶段对应必须通过显式 alignment，不能直接按 `n1` 相等匹配。
- 数组是否可空由字段语义决定：已确认 IntentSet 必须 3–5 条；`completeness=complete` 的 graph 至少含 1 个有效 node。relations/groups 等可空。空图统一为 `completeness=unsupported`、`error_code=no_readable_content`；不能成为有效完整结果或让 renderer 审计通过。所有容量上限由 T00 冻结；超限报错，不截断后冒充遗漏。
- 缺乏图中证据时用 `unknown`；`not_shown` 指未展示该限定，不能解读成已证实或条件不存在。
- 机器类型只从 `src/lib/schemas/` 导出，其他模块不复制一套近似接口。

## 2. 数据结构

### MemoryRecord / UnderstandingRecord

A 和 B 输出同一语义结构；外围证据和运行元数据单独封装。

```text
MemoryRecord
  schema_version
  graph
    nodes[]: id, label, aliases[], group_id|null
    relations[]: id, source_id, target_id,
                 kind(promotes|inhibits|associated_with|flows_to|unknown),
                 direction(directed|undirected|unknown),
                 line_style(solid|dashed|unknown),
                 evidence_status(asserted|hypothesized|not_shown|unknown)
    groups[]: id, label                         # 首版仅一层
    conditions[]: id, text,
                  scope(graph|node|relation|group), target_ids[]
    legend[]: id, visual_cue, stated_meaning, linked_item_ids[]
    uncertainties[]: id, item_ids[], note
  evidence[]: item_id, image_bbox|null, visible_text|null, note
  reader_notes[]: item_ids[], summary
  completeness: complete|capacity_exceeded|unsupported
```

`asserted` 仅表示图中作为确定陈述呈现，不是科学上已证实。虚线不自动等于推测：必须依据该图图例或显式标签；图例没解释时保留未知。节点和关系引用必须有效，条件 scope/target 必须一致，ID 必须唯一。

`image_bbox` 使用归一化 `{x,y,width,height}`，均在 `[0,1]` 内，且不得越界；允许 `null`。B 的 bbox 位于重建 PNG，不能当原图定位。

`reader_notes` 是可核对的简明事实笔记，不是隐藏推理过程；不得包含 graph 中没有的额外科学断言。

阶段处理统一规则：`capacity_exceeded` 或 `unsupported` 均保存当前 record 并将 run 标为 failed，记录 failed_stage/error_code。若 A 失败，跳过 renderer、B 和语义评价；若 B 失败，保留 A/重建图但不产生完整语义报告。页面展示“本次未完成提取/不支持”，不把任何 K 判成 omitted，也不认定用户原图一定有问题。

### RenderInput / RenderArtifact

```text
RenderInput: graph                               # 从已持久化 MemoryRecord 投影
RenderArtifact
  svg_asset_id, png_asset_id, width, height
  rendered_item_ids[]
  unsupported_item_ids[]
  warnings[]: item_ids[], code, message
  structural_audit: complete|incomplete|failed
  visual_review: not_reviewed|passed|failed
  visual_review_ref|null
  renderer_version, layout_version
```

投影去掉原图、bbox、笔记、文件名、关键点、答案和运行元数据；保留 graph 的显式科学语义及引用。SVG 内可以用局部 ID 组织图元，但 PNG 不绘制内部 ID，不夹带答案或原图缩略图。B 的输入来自 PNG 像素，不来自 SVG 文本或 graph。

`structural_audit=complete` 要求所有应表达的条目映射到输出中的具体图元，引用和符号属性一致，无未支持项或语义缺口；不能只证明调用过 draw 函数。`visual_review` 是独立人工/强模型图像检查记录，不能由机器覆盖率推断为 passed。首版至少对全部正控和演示图检查 PNG 的实际可见性；其他未检查图维持 not_reviewed。

### IntentSet

```text
IntentSet
  id, version
  keypoints[3..5]
    id, text
    normalized_claim: AtomicClaim|null
    author_confirmed: boolean
  digest
AtomicClaim
  kind: relation|condition|group_membership|evidence_status
  subject_label, object_label|null
  relation_kind|null, direction|null
  condition_text|null, condition_scope|null
  evidence_status|null
  required_fields[]
```

关键点原文和 ID 不被自动替换。普通文本可由评估侧独立归一化；页面让作者核对提取含义，或通过结构化字段补齐。未确认/无法解析的关键点不能给确定性结论。

只比较作者实际声明的 `required_fields`。例如“A 促进 B”没有写条件，不能凭空将其视为“所有条件下均成立”；反之关键点明确写“仅在 X 下”，就必须核对该限制及作用范围。

### EvaluationReport

```text
EvaluationReport
  intent_digest, settings_digest
  keypoint_results[]
    keypoint_id
    in_a: Judgment
    in_b: Judgment
    observed_stage: first_read|round_trip|both|none|unresolved
    recovery_in_b: boolean
    render_item_status: represented|unsupported|unknown
    suggestions[]: text, basis_item_ids[], is_hypothesis
  a_to_b[]: a_item_ids[], b_item_ids[], judgment, alignment
  unmatched_b_claims[]: b_item_ids[], explanation, review_required
  summary: per_status_counts, retained_count, keypoint_count,
           unresolved_count, renderer_warning_count
  direct_check_result_ref|null
Judgment
  status: retained|partial|omitted|contradicted|uncertain
  issue_types[]: identity|direction|relation_type|condition|scope|evidence_status
  matched_item_ids[], evidence_refs[], rationale
  method: rule|semantic_assist|manual
  review_required: boolean
```

`omitted` 表示当前提取结果没恢复，不能断言图中没有。没有足够映射/证据则 `uncertain`。方向、关系、条件、范围和证据可同时有多个 issue。手工纠正另存 overlay，保留原判断。

`observed_stage` 是观察标签，不是因果结论。至少按下表实现，T04 补充更细判例；任何表述无法对齐均优先 unresolved：

| K→A | K→B | A→B / 绘图证据 | 观察标签 |
|---|---|---|---|
| retained | retained | 关键限定一致 | none |
| 非 retained 且可确定 | retained | B 恢复作者声明 | first_read，recovery_in_b=true；不当作全程无损 |
| 非 retained 且可确定 | 非 retained 且可确定 | B 忠实保留 A 的既有错误 | first_read |
| 非 retained 且可确定 | 非 retained 且可确定 | B 另引入明确偏差 | both |
| retained | 非 retained 且可确定 | 相关 A 字段未被画出 | round_trip，明确 render gap，不归给 B 或原图 |
| retained | 非 retained 且可确定 | 结构完整且图可核对 | round_trip，原因仍待复核，不自动归给 B |
| uncertain / 未确认 K | 任意 | 映射不足 | unresolved |
| 任意 | uncertain | 无足够证据 | unresolved |

非 retained 且可确定包括 partial/omitted/contradicted，必须保留具体 issue；不能仅按聚合状态假定两个错误相同。A→B 新增偏差由已对齐的事实/限定决定。

K 不是全图答案：B 中没对应某个 K 的内容不能据此叫幻觉；只有对齐 A 的完整已提取内容后，才能称“B 新增/未匹配断言”，仍需复核，不称已证伪。

完整保留数的分母显示全部已确认关键点数，同时展示 unresolved；不能丢掉不确定项后宣传成功率。不提供综合质量分。

### DirectCheckResult（独立验证产物）

```text
DirectCheckResult
  baseline_id, linked_run_id, created_at
  protocol: keypoint_aware_direct_check
  status: completed|failed
  input_asset_digest, intent_digest, settings_digest
  provider_model_id, prompt_version, request_id|null
  keypoint_results[]: keypoint_id, Judgment
  latency_ms, token_usage|null, cost_if_known|null
  attempts[], error_code|null
```

该结果写入独立 baseline 产物及索引，主报告只引用；失败不改变已完成主 run 的状态。费用单位和来源必须写明，未知不估造。批次汇总同时包括 baseline 失败/重试，不能只保留成功结果。主链路 manifest 不混入基线 stage，索引以 linked_run_id、hash 关联。

### RunManifest / RunSnapshot

```text
RunManifest
  run_id, created_at, completed_at|null
  mode: live|mock|replay
  status: queued|reading_a|reconstructing|reading_b|evaluating|
          completed|failed|interrupted
  failed_stage|null, error_code|null
  source_run_id|null, parent_run_id|null, comparison_group_id|null
  input_asset_digest, intent_digest, settings_digest
  reader_profile: default
  caption_mode: image_only
  model_config_ref, provider_model_id, prompt_versions, code_version
  schema_version, renderer_version
  stage_records[]: stage, started_at, ended_at, allowed_input_digests[],
                   request_id|null, attempt, token_usage|null, error_code|null
  artifacts: registered_asset_ids[]
```

API 密钥、完整请求头、认证信息不记录。审计保存允许字段的请求结构/摘要与资产 hash；如保存真实响应，仅留在私有 runs。`code_version` 在无 commit 时也必须用明确的源码摘要，不能伪造 commit SHA。

RunSnapshot 对前端只暴露状态、允许展示的产物、错误和报告；不暴露磁盘路径、密钥或保留集标准答案。完成后的 manifest/产物不可变；活动运行只按合法状态前进，重试创建新的 attempt/run 关联记录。

## 3. 函数边界（冻结后的公共导出）

```typescript
readOriginal(input: ReaderImageInput): Promise<MemoryRecord>
readReconstruction(input: ReaderImageInput): Promise<MemoryRecord>
projectForRender(memory: MemoryRecord): RenderInput
renderMemory(input: RenderInput): Promise<RenderArtifact>
normalizeIntents(input: IntentTextInput): Promise<IntentSet>
evaluate(input: EvaluationInput): Promise<EvaluationReport>
directCheck(input: DirectCheckInput): Promise<DirectCheckResult>
compareRuns(input: CompletedRunPair): ComparisonReport
startRun(input: RunRequest): Promise<RunSnapshot>
```

- `ReaderImageInput` 仅含像素、MIME 和冻结的读者配置；无 intent、路径、filename、caption、旧消息或 graph。两种 reader 必须使用独立请求消息。
- `EvaluationInput` 含已确认 IntentSet、A/B records、RenderArtifact，不含必须让比较器重新看图的隐式依赖。语义助手只做实体/表述对齐，不能改变作者声明或替模型补读图。
- `DirectCheckInput` 明确含原图和 IntentSet；direct-check 是独立基线，不能被 `readOriginal` 复用成带答案的 A。
- `CompletedRunPair` 检查 intent、模型、提示词、reader_profile、caption_mode、renderer/schema 等配置 digest；图片变化允许，其他差异列出并禁止标成同配置受控对比。

## 4. Renderer 语义映射（由强模型冻结）

| 记忆字段 | 固定表达 | 不能做的事 |
|---|---|---|
| promotes | 有向箭头+可见 promotes 标签 | 单靠绿色暗示 |
| inhibits | T 形抑制端点+可见 inhibits 标签 | 用普通促进箭头代替 |
| flows_to | 有向箭头+flow 标签 | 擅自解释成因果促进 |
| associated_with / undirected | 无箭头连线+association 标签 | 加方向 |
| unknown kind/direction | 可见问号或 unknown 标签；仅有已知部分用对应符号 | 默认补成 promotes/directed |
| dashed / solid | 对应线型 | 没图例就把 dashed 解释为假说 |
| hypothesized | 显式 hypothesized 标签 | 只依赖线型 |
| not_shown / unknown evidence | 可见区分状态，或在条目附简短限定 | 默认为 confirmed |
| group | 单层边框与标签 | 省略分组而报告审计通过 |
| condition | 邻近目标的可见条件标签，目标范围清楚 | 放图角落后宣称所有边均带该条件 |
| legend | 必要的图例含义以文字保留并映射到相关条目 | 盲目复制颜色而丢失含义 |
| uncertainty | 相关条目处标记 ? 并保留简短说明 | 静默抹掉不确定 |

`structural_audit=complete` 不等于视觉检查通过，更不证明人或 B 一定看得清。还需要 PNG 视觉正控、遮挡/截断检查；无法表达的字段必须 `incomplete/failed`，报告不得强行归为原图错误。

## 5. 首版 HTTP 边界

| 端点 | 行为 |
|---|---|
| `POST /api/intents` | 只归一化作者关键点；返回待确认结构，不调用 reader |
| `POST /api/runs` | multipart 图片+已确认 IntentSet+设置+可选 parent；校验后创建 run 返回 202；已有活动 run 返回 409 |
| `GET /api/runs/:id` | 获取可展示的 snapshot，由前端轮询阶段 |
| `GET /api/runs/:id/assets/:assetId` | 只读取该 run 注册的安全资产 ID；不接收任意文件路径 |
| `GET /api/runs/:id/report` | 下载 JSON/Markdown；默认过滤私有路径与内部敏感字段 |

比较可在客户端调用纯 `compareRuns`，首版无须再引入比较服务。direct-check 由显式验证选项或验证脚本触发，不阻塞主结果页；额外调用与失败单独显示。

后台任务首版仅支持持久在线 Node 进程与本地磁盘；不宣称能在无状态函数平台可靠后台运行。重启检测 running manifest 并标为 interrupted。最终运行方式由 T00 先做最小可用验证。

## 6. 出错与重试

- 上传校验包括类型、实际解码、体积/像素上限；重建由程序输出，不能把用户提交的任意 SVG 直接执行。
- JSON/引用/容量错误应明确失败，不把空输出算作科学信息遗漏。
- 自动重试仅限暂时网络/限流错误，最多 2 次且有退避；记录每次请求。解析/科学语义不合法不得无限改 prompt 刷通过。
- 某阶段失败保留已有产物，禁止静默用 mock、旧回放或手写 B 填补。
- 回放创建清楚的 replay 视图，链接原始真实 run，不能伪装成刚刚完成的 live。

## 7. 待 T00/T04 冻结的项目

容量上限与超时；实际依赖及版本；实际模型能力和 structured-output 约束；AtomicClaim 的 Zod 判别结构；digest 的稳定序列化；golden fixtures；隐私过滤字段；有限批次 API 预算。这些是脑力型决策，体力执行模型只能提出建议。
