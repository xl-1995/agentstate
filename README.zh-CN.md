<div align="center">

# AgentState

### Agent 有记忆,却没有状态。

**一个开源的、受治理的「状态层」,坐在所有 agent 框架的下面——**
**让 agent 的动作不只是「更聪明」,而是「更可信」。**
模型只负责*提议*;一个确定性引擎负责*裁决*;每一次改变都是一条事件。

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933.svg?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg?logo=typescript&logoColor=white)](tsconfig.json)
[![MCP](https://img.shields.io/badge/MCP-compatible-7C3AED.svg)](https://modelcontextprotocol.io)
[![Status](https://img.shields.io/badge/status-v0%20alpha-orange.svg)](docs/ROADMAP.md)

[快速开始](docs/quickstart.md) · [宣言](docs/manifesto.md) · [架构](docs/ARCHITECTURE.md) · [路线图](docs/ROADMAP.md) · [English](README.md)

▶ **[观看 36 秒演示视频](https://github.com/xl-1995/agentstate/releases/download/v0.0.1/agentstate-promo.mp4)** &nbsp;·&nbsp; 源文件:[`media/promo`](media/promo)

</div>

---

## 瓶颈早就不是「聪明」,而是「可信」

模型在变得越来越聪明。但拦住你把一个 agent 放上真金白银、真实记录、真实客户的,从来不是它不够聪明——而是你**没法信任**它会做什么,也**没法证明**它做过什么。

再聪明的模型,依然回答不了「这件事到底发生过没有」,依然没有一条它越不过去的红线,依然不留一条你能审计的记录。**「智能」和「可信」是两个不同的维度**,而整个生态几乎只优化了前一个。

> ### AgentState 不让模型变得更聪明。它让 agent 变得可信。

它的做法,是把少数几个真正会「改变世界」的操作,从自由文本的推理里抽出来,变成有类型、受治理的**动作(Action)**——每一个都要过对象状态、角色额度、风险规则的裁决,每一个都落进一本只增不改的账本。模型只*提议*;一个确定性引擎来*裁决*;每一次改变都是一条能回放的事件。它**不是又一个 agent 框架**——它是那个「聪明的部分」赖以运行的**可信底座**。

---

## 「更聪明」 vs 「更可信」

这是两件不同的事。AgentState 负责后一件。

| | 模型的活 | **AgentState 的活** |
|---|---|---|
| 提供的是 | **智能**——理解、规划、起草、决定*要提议什么* | **可信**——治理、设限、并记录*什么被允许发生* |
| 靠什么变好 | 换一个更大/更强的模型 | 把边界定义得更清楚 |
| 消除的失败 | 「它没看懂」 | **「它做了不该做的事——而且没人说得清为什么」** |
| 「这事发生过没?」 | 从记忆里猜一个 | **从状态里读一个权威值** |
| 「这事为什么发生?」 | 回去翻聊天记录 | **账本里的一行** |
| 「它有没有可能做出 Y?」 | 但愿 prompt 拦得住 | **一条让 Y 根本不可能的前置条件** |

能力,你花钱升级模型就能买到。**可信,你必须把它「架构」出来。** AgentState 就是这套架构——而且因为它是确定性的,不管上面坐的是今天还是明年的模型,这些保证都一样成立。

---

## 记忆 ≠ 状态

LLM 的「记忆」,是一摞每一轮都要重读、可能读串、没有唯一权威「现状」的笔记。这套东西适合记录*说过什么*,却恰恰是*什么是真的*这件事最糟糕的载体。

|            | **记忆 Memory** | **状态 State** |
|------------|-----------------|----------------|
| 回答的问题  | 「说过什么?」 | 「什么是真的——这笔钱到账没?这单发货没?」 |
| 形态        | 只增的笔记,被召回、被摘要 | 每个对象一个唯一权威值 |
| 谁能改      | 模型,随意改 | 只有受治理的动作,经裁决后才改 |
| 失败方式    | 会忘、会重复、会读串 | ——(同一件事它做不了两次) |
| 存在哪      | 聊天记录里 | 状态层里 |

今天大多数 agent 栈把这两者混为一谈,放任模型直接写真实世界——可信,恰恰就是在这里漏掉的。AgentState 把对话留在它该在的聊天记录里,而给**世界**单独一层。

---

## 模型:四个原语

**语法**跨行业是同一套,变的只是**词汇**。

| 原语 | 是什么 |
|------|--------|
| **对象 Object** | 一条有类型、持久化的记录,描述「此刻的现状」(`Order`、`Ticket`),用 `(type, id)` 标识 |
| **动作 Action** | 一等公民、受治理的操作——改变状态的*唯一*途径,带 `前置条件 → 权限 → 风险守卫 → 效果` |
| **事件 Event** | 只增账本里的一条:谁、基于什么状态、为什么放行、结果如何 |
| **投影 Projection** | 当前状态是事件的累加结果——`replay()` 能仅凭事件把它重建出来 |

```mermaid
flowchart TB
    subgraph CONTROL["🟠 控制层 — 红海,不是我们的战场"]
        A["LangGraph · Dify · 你自己的 agent 循环"]
    end

    subgraph AGENTSTATE["🟣 AgentState — 受治理的状态层"]
        direction TB
        MCP["MCP 服务<br/>get_object · list_available_actions<br/>request_action · get_audit_trail"]
        ENG["引擎 Engine<br/><i>提议 → 裁决</i>"]
        subgraph GUARDS["动作(一等公民)"]
            direction LR
            P1["前置条件<br/><i>对象状态</i>"] --> P2["权限<br/><i>角色 × 额度</i>"] --> P3["风险守卫<br/><i>派生事实</i>"] --> EF["效果<br/><i>写入 + 事件</i>"]
        end
        LED[("只增的<br/>事件账本<br/>(唯一真相源)")]
        PROJ[("当前状态<br/>投影<br/>(可重建的缓存)")]
    end

    A -->|"request_action"| MCP --> ENG --> GUARDS
    ENG -->|"追加"| LED
    LED -.->|"replay()"| PROJ
    ENG -->|"更新"| PROJ
```

动作把守卫**声明**出来,而不是埋进一堆 if-else:

```ts
export const issueRefund: ActionDef = {
  name: "issue_refund",
  input: z.object({ order_id: z.string(), amount: z.number().positive(), reason: z.string().min(1) }),

  precondition(ctx) {                       // 绑在对象状态上的不变量
    const o = ctx.get("Order", ctx.input.order_id);
    if (!o) deny("order_not_found", "...");
    if (ctx.input.amount > o.amount - o.refunded_amount)
      deny("refund_exceeds_remaining", "...");      // 重复退款在结构上不可能
  },
  permission(ctx) {                         // 绑在角色 × 金额上的授权
    if (ctx.input.amount > REFUND_LIMIT[ctx.actor.role]) requireApproval("...", "senior");
  },
  riskGuard(ctx) {                          // 绑在派生事实上的滥用守卫(90 天累计)
    /* 累加该客户过往的 RefundIssued 事件 → 超阈值转审批 */
  },
  effect(ctx) {                             // 状态改变 + 要记录的事件
    return { writes: [updatedOrder], event: { type: "RefundIssued", /* ... */ } };
  },
};
```

LLM 永远碰不到 `effect`。它只能 `request_action`;引擎跑完守卫,自己裁决。完整的请求生命周期见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

---

## 用一个例子看清楚

仓库里只带**一个打磨过的例子**,把这件事讲具体——它恰好是客服,但重点是那套**语法**,不是这个行业。一个普通 agent 直接调 API,重复付款;同一个 agent 经过 AgentState,第二次被当场拒绝,还留下凭据:

```text
# 普通 agent,没有状态层
💸 在一笔 $150 的订单上付出去 $300 —— 没记录,也不知道自己重复付了

# 同一个 agent,经过 AgentState
✅ 通过        退款 $150                  → RefundIssued
⛔ 拒绝        再次退款 $150              → 已退过(靠状态实现幂等)
✋ 需审批      $800 超出角色额度          → 自动升级给主管
✅ 通过        …主管审批后               → RefundIssued,审批落在账本上
```

它不是变得**更聪明**——两次模型提议的是同一件事;它是变得**更可信**——第二个世界不让它发生,而且说得清为什么。自己跑一遍:

```bash
git clone https://github.com/xl-1995/agentstate && cd agentstate
npm install
npm run demo      # 普通 agent vs 受治理 agent,左右对照
npm test          # 四条保证:通过 / 拒绝 / 需审批 / 账本可回放
```

---

## 在 MCP 客户端里用(Claude Desktop 等)

AgentState 以 [Model Context Protocol](https://modelcontextprotocol.io) 服务的形态发布,只暴露四个工具:

`get_object` · `list_available_actions` · `request_action` · `get_audit_trail`

```bash
npm run mcp        # 以 stdio 形式跑起客服示例
```

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "agentstate": {
      "command": "npx",
      "args": ["tsx", "examples/customer-support/mcp.ts"],
      "cwd": "/绝对路径/agentstate"
    }
  }
}
```

然后让 Claude 给同一笔订单退两次款——它在物理上做不到,而 `get_audit_trail` 会把原因一条条摆给你看。

---

## 它和谁不一样

| | 占住的是 | AgentState 与它的关系 |
|---|---|---|
| **LangGraph / Dify / OpenClaw** | 控制层:路由、编排 | 坐在它们**下面**——它们来调 `request_action` |
| **Palantir Foundry** | 企业级的「对象+动作+审计」 | 同一个思路,但重、封闭、贵。AgentState 是那个薄的、开源的、自有数据就能跑的版本 |
| **Temporal / 持久化执行** | 工作流的*可靠执行* | 互补——AgentState 治理的是*什么被允许改变*,不是工作流怎么跑 |
| **Postgres + 几个校验函数** | 存储 + 临时校验 | 那是你每个项目手搓一遍的东西。AgentState 把这套治理语法变成一个可复用的原语 |

完整对比见 [`docs/comparison.md`](docs/comparison.md)。

---

## 当前状态

`v0` —— 刻意做到最小:核心运行时 + MCP 服务 + 一个打磨过的示例 + 那个对照演示。没有 Studio、没有界面、没有多租户、还没有连接器。v0 的全部意义,就是**一条命令跑起来、当场让一个受治理的 agent 把普通 agent 比下去**。路线图里写清楚了接下来做什么,以及——同样重要——我们*不急着*做什么。见 [`docs/ROADMAP.md`](docs/ROADMAP.md)。

## 许可证

[Apache-2.0](LICENSE) —— 含专利授权、企业可安心使用。这套语法想成为一个标准;你的词汇,建在它之上。
