---
name: replay-failure
description: >
  Week3 课堂演示工具：按需 checkout failure 分支并引导复现 Week 3 课件中的四个经典 failure 场景。
  触发词：演示 bug、replay failure、复现问题、failure 分支、failure/serialize、failure/fs-rename、
  failure/str-replace、failure/mismatched-api、演示 serialize、演示 rename、演示 str_replace、
  演示 contract、演示 API 合同、课堂演示、week3 演示、切到 failure、跑 failure 场景。
  也用于用户说"下一个分支"、"next branch"、"切回 main"、"演示完了"时。
  用户说"原理"、"原理图"、"git branch 原理"、"底层原理" → 打开 week3-demo-principles.html。
---

## 工作流

用户说"演示 <场景>" → 切对应分支 → 启动 dev server → 给出复现步骤 + 预期现象 + 知识点对照 → 等用户说"下一个" → 停 server → 切下一个分支或 main。

## 分支映射表

| 用户关键词 | 分支 | 章节 |
|-----------|------|------|
| serialize / 序列化 / 格式变更 | `failure/serialize-array-format` | 二、Git 护栏 |
| rename / 重命名 / fs / 文件系统 | `failure/fs-renamesync-on-vfs` | 三、CLAUDE.md |
| str_replace / 返回值 / return | `failure/str-replace-return-format` | 四、测试 |
| api / contract / 合同 / mismatch | `failure/mismatched-api-contracts` | 七、多 Agent |

## 演示工具清单

| 工具 | 用途 |
|------|------|
| 浏览器 `http://localhost:3000` | 主演示界面 |
| 终端（dev server 输出） | 观察服务端错误日志 |
| admin/admin 账号 | 登录进入持久化路径触发 bug |
| Chrome DevTools（可选） | 查看 Network 面板的错误响应 |
| `npm run build`（str_replace 分支） | 展示 TS 类型错误 |
| `docs/coursewares/week3-demo-principles.html` | 原理图解：分支拓扑、Git 三区域、VFS 中枢、类型安全网、Contract-First |

## 原理图解页面

当用户说"原理"、"原理图"、"git branch 原理"、"底层原理"时，用浏览器打开原理图解页面：

```
open docs/coursewares/week3-demo-principles.html
```

页面包含 7 个板块：
1. Git 分支拓扑（4 failure 分支 + main 关系图）
2. Git 三区域模型（为什么 checkout 是「一秒恢复」）
3. VFS 数据中枢传导（Hub-and-Spoke 架构 + 代码对比）
4. CLAUDE.md 规则外化（一句话省三轮对话）
5. 类型系统安全网（改 A 炸 B 的传导链）
6. Contract-First（三 Agent 合同对比表）
7. 总结：四条防线的协同

---

## 分支 1：failure/serialize-array-format

### 第一步：切分支 + 启动
```bash
git checkout failure/serialize-array-format
pkill -f "next dev" 2>/dev/null; npm run dev &
```

### 第二步：复现步骤
1. 浏览器 `http://localhost:3000` → 右上角 Sign In → 输入 `admin` / `admin`
2. 聊天框输入"创建一个按钮" → 等 AI 生成完
3. **按 F5 刷新页面**

### 第三步：预期现象
- 左侧文件树路径变成 `/0`, `/1`, `/2`...（不再是 `/App.jsx`）
- 右侧预览白屏（找不到入口文件 `/App.jsx`）

### 根因
`serialize()` 返回 `FileNode[]` 替代 `Record<string, FileNode>` → 存 DB → 刷新时 `deserializeFromNodes()` 把 `Object.keys(["0","1"])` 当成文件路径 → VFS 结构完全损坏。

### 知识点对照（draft 二、Git 护栏）
1. **L57 的 50 分钟翻车** — 这就是作者亲历的场景
2. **L53-55 数据中枢传导** — VFS 是橙色中枢，四条路径同时依赖，改一个方法炸三个模块
3. **L57-58 checkpoint 30 秒 vs 50 分钟** — 演示完 `git checkout main` 一秒恢复，配合三区域模型讲解
4. **L61-64 Harness 三原则** — 外化规则 + 治理工具 + 建立反馈

### 踩坑记录
- 匿名用户无持久化路径，`serialize()` 的 Array 不会被 `deserializeFromNodes()` 消费 → 预览正常 → **必须登录后刷新**
- 上一个 serialize 分支演示会污染 DB → 后续分支演示前建议点"New Design"开干净项目
- Turbopack 不做严格类型检查 → `npm run dev` 编译通过 → 用 `npm run build` 或 `npm test` 展示类型/测试错误

---

## 分支 2：failure/fs-renamesync-on-vfs

### 第一步：切分支 + 启动
```bash
git checkout failure/fs-renamesync-on-vfs
pkill -f "next dev" 2>/dev/null; npm run dev &
```

### 第二步：复现步骤
1. 浏览器 `http://localhost:3000` → 登录 admin/admin → 点 **New Design**（开干净项目，避免 VFS 脏数据）
2. 聊天框输入"把 App.jsx 重命名为 Main.jsx"
3. 回车发送

### 第三步：预期现象
聊天窗口直接显示 **红色 "API Error"** 错误：

```
ENOENT: no such file or directory, rename '/App.jsx' -> '/Main.jsx'

Root cause: file-manager.ts uses Node fs.renameSync() instead of
VirtualFileSystem.rename().
VFS is an IN-MEMORY filesystem — paths like /App.jsx don't exist on disk.
Fix: add 'VirtualFileSystem: In-memory filesystem, no disk writes' to CLAUDE.md.
```

同时终端输出醒目的 ASCII 错误块。

### 错误如何到达浏览器
`route.ts` 入口检测到用户消息含"重命名"/"rename" → 直接返回 HTTP 500 + JSON error → `useChat` hook 将 error 渲染为红色消息。

**关键代码链**：
```
route.ts 检测 rename 关键字 → 500 响应
    ↓
useChat hook 收到 error → 红色 "API Error" 消息
    ↓
终端 console.error 输出 ASCII 错误块（双屏对照）
```

### 根因
`file-manager.ts` 调了 Node 的 `fs.renameSync("/App.jsx", "/Main.jsx")`。VFS 数据在内存 Map 里，`fs.renameSync` 去磁盘找 `/App.jsx`，当然找不到。CLAUDE.md 里少了一句"VirtualFileSystem 是纯内存实现，不写磁盘"。

### 知识点对照（draft 三、CLAUDE.md）
1. **L327-339 的案例** — "对 AI 说'给文件管理器加重命名功能'，AI 直接加了 `fs.renameSync()`。来回三轮对话才搞定"
2. **L307-318 规则外化** — 把"每次都要强调"的规范写进 CLAUDE.md：`VirtualFileSystem: In-memory filesystem, no disk writes`
3. **一句话省三轮对话** — CLAUDE.md 最有价值的是反直觉的设计决策

### 踩坑记录
- **AI SDK 框架层自动 catch tool execute 的 throw** — 工具函数内 throw Error 不会到达浏览器，而是被转成 tool result error 返回给模型
- **模型会自己绕过错误** — 模型看到 `{ success: false, error: "ENOENT..." }` 后自动换 create+delete 方案，用户看到"已完成"
- **解决方案**：不在 tool 层拦截，在 route 层入口检测 rename 关键字 → 直接返回 500 → 浏览器看到红色错误
- **MockLanguageModel 不会调 file_manager** — 需要用真实 API key 或手动 curl 触发。当前方案（route 层拦截）不依赖模型选工具
- **ES module 禁止 reassign imported binding** — `export let x` 在 import 方不能被 `x = newValue`。用 `export const state = { x: null }` + `state.x = ...` 绕过
- 演示前务必点 **New Design** — 否则 VFS 脏数据（来自 serialize 分支演示）会导致文件路径显示 `/3`, `/5`, `/7`
- 终端错误块 + 浏览器红色错误 **双屏对照** 是最佳上课效果

---

## 分支 3：failure/str-replace-return-format

### 第一步：切分支
```bash
git checkout failure/str-replace-return-format
```
不需要启动 dev server——Turbopack 不报类型错误。

### 第二步：复现
```bash
npm run build 2>&1 | grep "error TS\|Type error"
```

### 第三步：预期现象
**1 个 TS 类型错误**在 `src/app/api/chat/route.ts:60`：

```
Type error: Property 'error' does not exist on type 'Omit<StepResult<...>>'
```

### 根因
`str-replace.ts` 的 `execute()` 返回 `{ content, changed }` 替代 string → AI SDK 的 `StepResult` 类型跟随变化 → `route.ts` 的 `onFinish` 回调里 `error` 字段消失。**改一行工具代码，炸了遥远的路由文件**。

### 为什么错误不在 file-system-context.tsx
Turbopack 不做严格类型检查所以 dev 不报错。`file-system-context.tsx` 的 `handleToolCall` 直接调 VFS 方法（不走 tool execute），所以运行时预览正常。错误躲在 AI SDK 的类型推断链中，只有 `npm run build`（tsc 严格模式）才能暴露。

### 知识点对照（draft 四、测试）
1. **L523-524 回归案例** — "AI 改了 str_replace 返回值格式，PreviewFrame 白屏。但 str-replace.ts 本身的单元测试是通过的，问题出在下游消费者"
2. **L577 向后兼容检查** — 测试不只是"测新功能"，更是"守旧契约"
3. **L581 AI 写测试闭环** — 先写测试 → 改代码 → 跑测试 → 修失败

### 踩坑记录
- Turbopack 不报 TS 类型错误 → 必须用 `npm run build`（production build + tsc）
- 错误位置不是改动处（str-replace.ts），而是远端的 route.ts → 这是"改 A 炸 B"的完美演示
- `handleToolCall` 绕过了 tool execute → 客户端预览正常 → 只有 AI 服务端受影响

---

## 分支 4：failure/mismatched-api-contracts

### 第一步：切分支 + 启动
```bash
git checkout failure/mismatched-api-contracts
pkill -f "next dev" 2>/dev/null; npm run dev &
```

### 第二步：复现步骤
1. 浏览器 `http://localhost:3000` → 登录 admin/admin（登录后自动进入项目页，projectId 即生效）
2. 点击 Header 右侧的 **"Share Component"** 按钮

### 第三步：预期现象（一次点击展示全部 3 个错误）

点击 Share 后，按钮下方自动出现 3 张红色错误卡片（级联重试，每步间隔 800ms）：

| Step | 标签 | 请求 | 结果 |
|------|------|------|------|
| ✗ 1 | URL 不匹配 | `POST /api/shares` + `{ project_id }` | **404 Not Found** |
| ✗ 2 | 字段名不匹配 | `POST /api/share` + `{ project_id }` | **400 Bad Request** — `project_id_required` |
| ✗ 3 | 响应字段不匹配 | `POST /api/share` + `{ projectId }` | **200** 但 `URL: undefined` — 后端返回 `shareId/shareUrl`，前端读 `id/url` |

学生无需手动修代码，一次点击就能看到全部 3 处合同不匹配。

### 根因
三个 Agent 各干各的，没对齐接口合同。ShareButton 用级联重试展示完整的集成调试过程。

### 知识点对照（draft 七、多 Agent 管理）
1. **L1000-1001 痛点** — "三个 AI 各自干活，A 做完了等审查，B 卡住了等决策，C 调的 API 路径和 B 定义的不一样"
2. **L1006-1031 合同优先** — Contract-First：定义 API 请求/响应格式 → 三个 Agent 对着合同独立工作
3. **L1033-1039 任务粒度** — 15-30 分钟一个任务，每个有明确验收标准

### 踩坑记录
- **启动即 build error**：`HeaderActions.tsx` 导入了不存在的 `createExportHTML`（已在 commit `f68aebb` 修复）
- ShareButton 组件需要 `projectId` → 只对登录用户显示 → 确保演示前已登录
- 登录后进入任意项目页即可看到 Share 按钮，无需先生成组件
- 级联重试：每步间隔 800ms，让学生看清每步变化。最后显示总结语"三个 Agent 各自工作，API 合同没对齐"

---

## 顺序遍历模式

如果用户说"全部演示"或"开始演示"，从 1 开始逐个演示。每完成一个，问"下一个？"。

1. failure/serialize-array-format
2. failure/fs-renamesync-on-vfs
3. failure/str-replace-return-format
4. failure/mismatched-api-contracts
5. main（结束）

## 重要约束

- 切换分支前必须先停掉当前的 dev server：`pkill -f "next dev"`
- admin 账号已预置在 SQLite 中（admin/admin），无需再次 seed
- 分支上如果有未提交改动（`.claude/prompt-counter.txt` 等），不用管
- **serialize 分支演示完后**，DB 中的项目数据已被污染 → 后续演示务必点 **New Design** 开干净项目
- `str-replace` 分支不需要 dev server，直接用 `npm run build`
- `fs-renamesync` 分支不需要真实 AI 模型——route 层拦截 rename 请求，mock 也能触发
- 所有分支演示完毕后 `git checkout main` 恢复
