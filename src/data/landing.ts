export const siteMetadata = {
  title: "openlatter - 每天上午送达的 AI 资讯与个人分析",
  description:
    "openlatter 是一封每天上午送达的 AI newsletter：整理最新 AI 资讯，并附上个人判断、产品观察和行动建议。"
};

export const navItems = [
  { label: "内容", href: "#digest", odId: "nav-digest" },
  { label: "样刊", href: "#issues", odId: "nav-issues" },
  { label: "方法", href: "#method", odId: "nav-method" }
];

export const images = {
  hero: "/assets/hero.png",
  work: "/assets/work-1.png"
};

export const digestPreviewItems = [
  {
    tag: "模型",
    odId: "digest-preview-models",
    text: "重要模型与能力更新，过滤掉噪音，只保留值得跟进的变化。"
  },
  {
    tag: "产品",
    odId: "digest-preview-products",
    text: "AI 应用、开发者工具和工作流的真实产品信号。"
  },
  {
    tag: "分析",
    odId: "digest-preview-analysis",
    text: "我会写下自己的判断：这件事为什么重要，接下来该观察什么。"
  }
];

export const contentModules = [
  {
    icon: "news",
    odId: "module-news",
    title: "最新 AI 资讯",
    body: "模型发布、产品功能、开源项目、平台政策和行业动向会被压缩成可快速扫描的摘要。"
  },
  {
    icon: "analysis",
    odId: "module-analysis",
    title: "个人分析",
    body: "我会补充自己的产品视角：哪些变化只是热闹，哪些变化值得进入路线图或研究清单。"
  },
  {
    icon: "actions",
    odId: "module-actions",
    title: "可行动清单",
    body: "每封信都会留下少量下一步：值得试用的工具、要观察的指标、适合转给团队讨论的问题。"
  }
] as const;

export const sampleIssues = [
  {
    odId: "issue-row-1",
    category: "模型观察",
    title: "新模型能力发布后，产品经理应该先看哪三个信号？",
    body: "从能力边界、价格变化和生态接口判断它是否值得纳入产品实验。",
    label: "早报主题"
  },
  {
    odId: "issue-row-2",
    category: "工具工作流",
    title: "AI 编程工具的更新，什么时候会真的改变团队交付方式？",
    body: "把“演示很强”和“团队可落地”拆开看，避免把噪音带进流程。",
    label: "产品分析"
  },
  {
    odId: "issue-row-3",
    category: "开源生态",
    title: "一个开源项目突然流行，应该跟进、观望，还是直接忽略？",
    body: "用维护强度、集成成本和真实场景来判断，而不是只看讨论热度。",
    label: "判断框架"
  }
];

export const methodSteps = [
  {
    odId: "method-step-filter",
    number: "01",
    title: "筛选",
    body: "先过滤重复发布、营销话术和缺少产品信号的信息。"
  },
  {
    odId: "method-step-context",
    number: "02",
    title: "归因",
    body: "把每条变化放回模型、产品、生态或商业化上下文里。"
  },
  {
    odId: "method-step-judgment",
    number: "03",
    title: "判断",
    body: "写下我个人认为值得行动、值得观察或暂时不重要的原因。"
  }
];
