import { contentModules } from "@/data/landing";
import { ModuleIcon } from "./ModuleIcon";

export function DigestSection() {
  return (
    <section className="section section-light" id="digest" data-od-id="digest-section">
      <div className="container stack">
        <div className="row-between">
          <div style={{ maxWidth: 560 }}>
            <p className="eyebrow" data-od-id="digest-eyebrow">
              WHAT YOU RECEIVE
            </p>
            <h2 className="display-lg" data-od-id="digest-title">
              不是新闻堆叠，而是一封可以直接进入判断的早报。
            </h2>
          </div>
          <p className="lead" data-od-id="digest-lead">
            openlatter
            的重点不是“发生了什么”，而是“这对产品、团队和个人判断意味着什么”。
          </p>
        </div>
        <div className="grid-3" data-od-id="module-grid">
          {contentModules.map((module) => (
            <article className="module-card reveal" data-od-id={module.odId} key={module.odId}>
              <ModuleIcon name={module.icon} />
              <h3>{module.title}</h3>
              <p className="muted">{module.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
