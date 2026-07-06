import { methodSteps } from "@/data/landing";

export function MethodSection() {
  return (
    <section className="section section-dark" id="method" data-od-id="method-section">
      <div className="container grid-2">
        <div className="stack">
          <p className="eyebrow" data-od-id="method-eyebrow">
            EDITORIAL METHOD
          </p>
          <h2 className="display-lg" data-od-id="method-title">
            我会把 AI 新闻处理成更适合决策的材料。
          </h2>
          <p className="lead" data-od-id="method-lead">
            openlatter
            的语气会更像一个产品同事写给你的内部备忘录：克制、明确、有取舍，而不是信息流转述。
          </p>
        </div>
        <div className="method-panel reveal" data-od-id="method-panel">
          <p className="meta">处理路径</p>
          <div className="method-steps">
            {methodSteps.map((step) => (
              <article className="method-step" data-od-id={step.odId} key={step.odId}>
                <span className="step-num">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p className="muted">{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
