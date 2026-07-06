import { sampleIssues } from "@/data/landing";

export function IssuesSection() {
  return (
    <section className="section" id="issues" data-od-id="issues-section">
      <div className="container">
        <div className="row-between" style={{ marginBottom: "var(--space-8)" }}>
          <div style={{ maxWidth: 560 }}>
            <p className="eyebrow" data-od-id="issues-eyebrow">
              SAMPLE ISSUES
            </p>
            <h2 className="display-lg" data-od-id="issues-title">
              样刊会围绕真实工作问题展开。
            </h2>
          </div>
          <p className="meta" data-od-id="issues-meta">
            每天上午 / 邮箱送达 / 中文阅读
          </p>
        </div>
        <div className="issue-list" data-od-id="issue-list">
          {sampleIssues.map((issue) => (
            <article className="issue-row reveal" data-od-id={issue.odId} key={issue.odId}>
              <span className="meta">{issue.category}</span>
              <div>
                <h3>{issue.title}</h3>
                <p className="muted" style={{ marginTop: "var(--space-2)" }}>
                  {issue.body}
                </p>
              </div>
              <span className="meta">{issue.label}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
