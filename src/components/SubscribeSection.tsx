import { SubscribeForm } from "./SubscribeForm";

export function SubscribeSection() {
  return (
    <section className="section section-light" id="subscribe" data-od-id="subscribe-section">
      <div className="container">
        <div className="closing-card">
          <p className="eyebrow" data-od-id="subscribe-eyebrow">
            JOIN OPENLATTER
          </p>
          <h2 className="display-lg" data-od-id="subscribe-title">
            把邮箱绑定到 openlatter。
          </h2>
          <p
            className="lead"
            style={{ margin: "var(--space-4) auto 0" }}
            data-od-id="subscribe-lead"
          >
            绑定后，你会默认成为 openlatter
            的用户。每天上午，我会把最新 AI 资讯和个人分析发到你的邮箱。
          </p>
          <SubscribeForm
            formId="subscribe-email-form"
            inputId="footer-email"
            odId="subscribe-email-form"
            inputOdId="subscribe-email-input"
            buttonOdId="subscribe-bind-button"
            noteOdId="subscribe-form-note"
            placeholder="name@company.com"
            defaultNote="不会发送无关营销内容。"
          />
        </div>
      </div>
    </section>
  );
}
