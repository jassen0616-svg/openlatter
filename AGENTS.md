# AGENTS.md

本文件记录当前 `openlatter` 项目的关键信息、云服务连接方式和后续 agent 操作规范。进入本仓库后请先阅读本文件，再执行部署、数据库或域名相关操作。

## 项目概览

- 项目名称：`openlatter-next`
- 当前根目录：`D:\项目\openlatter`
- Git 根目录：`D:\项目\openlatter`
- 当前主分支：`main`
- 技术栈：Next.js `16.2.10`、React `19.2.7`、TypeScript、App Router
- 页面来源：Open Design 导出的 HTML/CSS/JS 落地页，已工程化迁移为 Next.js 项目
- 项目性质：静态落地页为主，邮箱绑定交互使用浏览器端状态和 `localStorage`
- UI 约束：不要重新设计页面；保持原始 Open Design 的颜色、字体、间距、布局、响应式和动效节奏

## 产品背景与定位

`openlatter` 是一个面向 AI 资讯阅读者的 newsletter 产品。当前网站的核心目标不是复杂的账号系统或内容平台，而是让访问者在首页提交自己的邮箱，成为订阅读者。

产品承诺：

- 用户只需要在首页输入邮箱并提交。
- 订阅后，团队每天定时向订阅用户发送 AI 最新资讯。
- 邮件内容不仅包含新闻摘要，还包含作者的个人观点、产品判断、趋势观察和行动建议。
- 信息风格应保持克制、清晰、有取舍，像一封写给读者的 AI 早报或产品备忘录。

当前落地页的转化目标：

```txt
访问首页 -> 理解 openlatter 的 AI newsletter 价值 -> 输入邮箱 -> 完成绑定/订阅
```

后续如果接入 Supabase 或其他后端，首要业务对象应围绕“订阅邮箱/订阅用户”设计，例如：

- 保存订阅邮箱
- 记录订阅时间、来源页面、订阅状态
- 支持取消订阅
- 支持每日定时发送 AI 资讯邮件
- 支持维护每日 newsletter 内容或发送任务

不要在没有明确需求时把产品扩展成泛内容社区、登录型 SaaS、博客系统或复杂仪表盘。

当前已完成的第一个业务功能：

- 首页邮箱表单会先校验邮箱格式。
- 校验通过后，请求本站服务端接口 `POST /api/subscribe`。
- 服务端接口会再次规范化并校验邮箱，然后写入 Supabase 的 `public.newsletter_subscribers` 表。
- 同一邮箱重复提交会被视为已订阅，不会重复创建记录。
- 订阅成功后，前端继续沿用原有成功提示和本地 `localStorage` 状态。

当前已完成的每日 newsletter 生成工作流：

- 线上触发接口：`GET /api/newsletter/daily`。
- 手动触发接口：`POST /api/newsletter/daily`。
- 触发接口必须携带 `Authorization: Bearer <CRON_SECRET>`。
- Vercel Cron 已配置为每天 UTC 00:00 触发，对应北京时间 08:00。
- 信息来源参考 `zarazhangrui/follow-builders.git`，默认读取 GitHub raw feed：
  - `feed-x.json`
  - `feed-podcasts.json`
  - `feed-blogs.json`
- 正文生成使用 AI Gateway 文本模型，并要求每日只输出 3 条 AI 热点。
- 邮件正文渲染前会做防乱码校验：
  - newsletter content 不能出现连续 `???`。
  - HTML 最终必须是 ASCII-only。
  - HTML 中文必须通过实体反解检查。
- 每篇生成出来的文章必须归档到 Supabase Storage，再进入发送步骤。
- 默认归档 bucket：`newsletter-archives`，通过 `NEWSLETTER_ARCHIVE_BUCKET` 可覆盖。
- 归档路径格式：
  - `daily/YYYY/MM/DD/YYYY-MM-DD-<run-timestamp>/content.json`
  - `daily/YYYY/MM/DD/YYYY-MM-DD-<run-timestamp>/content.md`
  - `daily/YYYY/MM/DD/YYYY-MM-DD-<run-timestamp>/email.html`
  - `daily/YYYY/MM/DD/YYYY-MM-DD-<run-timestamp>/metadata.json`
- 归档 bucket 默认私有，服务端使用 `SUPABASE_SERVICE_ROLE_KEY` 写入。
- 如果归档失败，不要继续发送邮件；避免出现“用户收到文章但后台没有存档”的状态。
- 邮件发送使用阿里云 DirectMail。
- 默认头图为 `https://jassen.asia/newsletter/openlatter-daily-default.png`。
- 如果后续要每次动态生图，需要补充稳定的公开图片存储，例如 Supabase Storage、OSS 或 Vercel Blob；不要使用本地 `public/` 动态写入作为线上运行时存储。

重要编码规则：

- 不要用 PowerShell 管道或 `node -` stdin 传递中文内容。
- 之前确认过：`PowerShell here-string -> node -` 会在 Windows 管道编码中把中文替换成 `?`，导致邮件正文乱码。
- 生成中文邮件内容时，只允许使用 UTF-8 文件、项目内 TypeScript/Node 源文件，或纯 Node/TS 运行时数据流。
- 发信前必须检查内容中没有连续 `???`，并确认 HTML 实体反解后仍能读到中文。

主要目录：

```txt
public/assets/          原始页面图片与素材
public/newsletter/      newsletter 邮件默认头图等公开素材
src/app/                Next.js App Router 入口、layout、globals.css
src/components/         页面组件与少量 client 交互组件
src/data/landing.ts     页面文案、导航、卡片、列表等结构化数据
src/lib/dailyNewsletter.ts  每日 AI newsletter 生成、渲染和发送工作流
```

原始设计交付物仍保留在本地根目录：

```txt
open-design-source/
Open-Design-落地页.zip
.codex/
```

这些目录/文件只用于本地追溯，已通过本地 Git exclude 或 `.vercelignore` 避免误提交/误上传。

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm run build
```

本地开发地址：

```txt
http://127.0.0.1:3000
```

如需启动本地开发服务：

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## Git 仓库

远端仓库：

```txt
https://github.com/jassen0616-svg/openlatter.git
```

远端名称：

```txt
origin
```

主分支：

```txt
main
```

常规提交流程：

```bash
git status --short --branch
git add .
git commit -m "说明本次变更"
git push
```

注意：

- 不要提交 `.next/`、`.vercel/`、`node_modules/`、原始 zip、`open-design-source/` 或 `.codex/`。
- 当前 `.gitignore` 已忽略 `.next`、`.vercel`、`node_modules` 等构建/本地目录。
- `.vercelignore` 已避免 Vercel CLI 上传本地原始设计包和 Codex 本地数据。

## Vercel 部署

当前项目已通过本地 Vercel CLI 部署成功。

Vercel CLI：

```txt
vercel 54.20.1
```

当前登录账号：

```txt
jassen0616-8792
```

Vercel 项目：

```txt
jassen0616-8792s-projects/openlatter
```

本地 `.vercel/project.json` 当前关联：

```txt
projectName: openlatter
```

生产部署命令：

```bash
vercel --prod --yes
```

部署前建议执行：

```bash
npm run lint
npm run build
```

当前线上地址：

```txt
https://openlatter-eight.vercel.app
```

最近一次部署地址：

```txt
https://openlatter-qmlhsr2pv-jassen0616-8792s-projects.vercel.app
```

最近一次 Vercel Inspect：

```txt
https://vercel.com/jassen0616-8792s-projects/openlatter/C9QtKfwU8Ah4R4XjuLk7fgq6W7Vi
```

重要状态：

- CLI 部署已成功。
- Vercel 尝试自动关联 GitHub 仓库时失败，原因是 Vercel 账号尚未添加 GitHub Login Connection。
- 这不影响手动 CLI 部署。
- 若要 GitHub push 自动触发 Vercel 部署，需要先在 Vercel 账号中连接 GitHub，再把仓库关联到项目。

## 域名

用户已购买域名：

```txt
jassen.asia
```

当前已知状态：

- 域名已购买于阿里云。
- Vercel 项目 `openlatter` 中目前只添加了 `jassen.asia`。
- `www.jassen.asia` 目前没有添加到 Vercel 项目中。
- 尚未在本仓库操作中确认 DNS 已完成解析到 Vercel。
- 不要假设 `jassen.asia` 已经生效；操作前应检查 Vercel Domains 和阿里云 DNS。

当前 Vercel 域名配置：

```txt
jassen.asia
```

可选后续配置：

如果希望用户访问 `www.jassen.asia` 也能进入同一个网站，需要再在 Vercel 项目 `openlatter` 中添加：

```txt
www.jassen.asia
```

在阿里云云解析 DNS 中添加：

```txt
主机记录: @
记录类型: A
记录值: 76.76.21.21
```

```txt
主机记录: www
记录类型: CNAME
记录值: 以 Vercel Domains 页面显示为准
```

常见 Vercel CNAME 记录值可能是：

```txt
cname.vercel-dns-0.com
```

但请始终以 Vercel 项目 Domains 页面给出的值为准。

验证命令：

```bash
nslookup -type=A jassen.asia
nslookup -type=CNAME www.jassen.asia
vercel domains inspect jassen.asia
```

域名操作规范：

- 添加或修改 DNS 记录前，先说明要改哪条记录。
- 删除旧记录前，确认它确实与 `@` 或 `www` 冲突。
- 配置后等待 DNS 生效，再确认 Vercel SSL 状态为 Ready。
- 当前只要求 `jassen.asia` 作为项目域名；不要擅自添加 `www.jassen.asia`，除非用户明确要求。
- 如果后续添加 `www.jassen.asia`，推荐将 `jassen.asia` 设为 Primary Domain，并让 `www.jassen.asia` 跳转到根域名。

## Supabase MCP

当前项目已配置本地 Codex MCP：

```bash
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=inmshbmejdjlgqpkklwt"
codex mcp login supabase
```

MCP 名称：

```txt
supabase
```

MCP URL：

```txt
https://mcp.supabase.com/mcp?project_ref=inmshbmejdjlgqpkklwt
```

认证方式：

```txt
OAuth
```

Supabase project ref：

```txt
inmshbmejdjlgqpkklwt
```

测试结果：

```txt
get_project_url -> https://inmshbmejdjlgqpkklwt.supabase.co
list_tables(public) -> public.newsletter_subscribers
```

当前 Supabase 表：

```txt
public.newsletter_subscribers
```

字段概览：

```txt
id uuid primary key
email text unique not null
status text default 'subscribed'
source text default 'homepage'
user_agent text
created_at timestamptz
updated_at timestamptz
```

RLS 状态：

- 已启用 RLS。
- 允许 `anon` 和 `authenticated` 执行 INSERT。
- INSERT policy 要求 `status = 'subscribed'` 且 `source = 'homepage'`。
- 没有添加 SELECT policy，因此公开客户端不能读取订阅邮箱列表。

说明：

- MCP 配置保存在本地 Codex 环境中，不属于项目代码仓库。
- 当前对话可能不会热加载新 MCP；新开的 Codex 会话或 `codex exec` 可以正常调用。
- 调用 Supabase 前优先做只读探测，例如获取项目 URL、列出 schema/table。
- 写入数据库、改 schema、改 Edge Functions、改 secrets 或 storage policy 前必须明确说明影响范围。

只读连接测试示例：

```bash
codex exec --cd "D:\项目\openlatter" --sandbox read-only "Use the configured MCP server named supabase. Perform a read-only connectivity test for project_ref inmshbmejdjlgqpkklwt by listing available tools/resources or listing database tables/schemas if available. Do not modify anything. Return a concise summary of the MCP call result."
```

## 云服务调用规范

### Vercel

- 优先使用本地 Vercel CLI。
- 部署前运行 `npm run lint` 和 `npm run build`。
- 部署命令使用 `vercel --prod --yes`。
- 部署后用线上 URL 做 HTTP 200 验证。
- 如果 Vercel CLI 生成 `.vercel/`，不要提交该目录。
- 如果 GitHub 自动关联失败，说明账号连接问题，不代表部署失败。
- Vercel Cron 通过 `vercel.json` 配置，当前每日北京时间 08:00 触发 `/api/newsletter/daily`。
- Cron 接口必须校验 `CRON_SECRET`，Vercel 会把它作为 `Authorization: Bearer <CRON_SECRET>` 自动发送。

### Supabase

- 优先使用配置好的 `supabase` MCP。
- 默认先只读检查。
- 不要把 Supabase access token、service role key、JWT secret、数据库密码写入仓库。
- `public.newsletter_subscribers` 没有 SELECT policy；线上每日群发如果要读取订阅者列表，必须只在服务端使用 `SUPABASE_SERVICE_ROLE_KEY`。
- 不要为了读取订阅邮箱而给 `anon` 添加公开 SELECT policy。
- Supabase Storage 归档同样使用 `SUPABASE_SERVICE_ROLE_KEY`，不要使用 `SUPABASE_PUBLISHABLE_KEY` 写私有归档。
- 归档 bucket 不存在时，服务端工作流会尝试创建私有 bucket；如果 service role key 缺失或权限不足，工作流应失败并停止发送。

### AI Gateway

- AI 文本生成通过 `src/lib/aiGateway.ts`。
- 默认文本模型：`gpt-5.4-mini`。
- 默认生图模型：`gemini-3.1-flash-image-preview`。
- API Key 只能存在本地环境变量或 Vercel 环境变量中，不要写进仓库。
- 生成 newsletter 正文后必须经过 `src/lib/emailEncoding.ts` 的防乱码校验，再进入阿里云发信流程。

### 阿里云 DNS

- DNS 修改应通过阿里云控制台完成，或在明确授权的情况下使用阿里云 CLI/API。
- 本项目当前只记录 DNS 目标，不保存阿里云凭据。
- 当前只配置根域名时，使用 A 记录将 `jassen.asia` 指向 Vercel。
- 只有在后续添加 `www.jassen.asia` 时，才需要为 `www` 添加 CNAME 指向 Vercel 给定目标。

## 实现注意事项

- 页面主体优先保持 Server Component。
- 只有需要浏览器 API、事件、状态或 `localStorage` 的组件使用 `"use client"`。
- 不要在 Server Component 中使用 `window`、`document`、`localStorage`、`navigator`。
- 不要把整个页面改成 Client Component。
- 不要引入大型 UI 框架或 Tailwind，除非用户明确要求。
- 保留原始视觉风格，不新增营销文案或装饰元素。
- 如果 Next 构建自动修改 `next-env.d.ts`，提交前检查差异；如只是 `.next/dev/types` 与 `.next/types` 自动切换，可恢复后再提交。

## 当前部署与仓库状态快照

最后确认过的状态：

```txt
Git branch: main
Git remote: https://github.com/jassen0616-svg/openlatter.git
Vercel production: https://openlatter-eight.vercel.app
Supabase project URL: https://inmshbmejdjlgqpkklwt.supabase.co
Supabase subscription table: public.newsletter_subscribers
Custom domain target: jassen.asia
Vercel custom domains added: jassen.asia only
```
