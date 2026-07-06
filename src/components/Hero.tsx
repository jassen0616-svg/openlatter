/* eslint-disable @next/next/no-img-element */
import { digestPreviewItems, images } from "@/data/landing";
import { SubscribeForm } from "./SubscribeForm";

export function Hero() {
  return (
    <section className="section section-dark hero" data-od-id="hero-section">
      <div className="container grid-2">
        <div className="hero-copy">
          <p className="eyebrow" data-od-id="hero-eyebrow">
            AI NEWSLETTER / DAILY BRIEF
          </p>
          <h1 className="display-xl" data-od-id="hero-title">
            每天上午，把 AI 的变化讲清楚。
          </h1>
          <p className="lead" data-od-id="hero-lead">
            openlatter 会把最新 AI
            资讯、产品更新、开源动态和我的个人分析整理成一封信。你输入邮箱并点击绑定后，就默认成为读者。
          </p>
          <div className="signup-panel reveal" data-od-id="hero-signup-panel">
            <div className="signup-card">
              <p className="meta" data-od-id="signup-kicker">
                下一封会在上午送达
              </p>
              <SubscribeForm
                formId="hero-email-form"
                inputId="hero-email"
                odId="hero-email-form"
                inputOdId="hero-email-input"
                buttonOdId="hero-bind-button"
                noteOdId="hero-form-note"
                placeholder="you@example.com"
                defaultNote="只用于发送 openlatter；你可以随时取消订阅。"
              />
              <div className="digest-preview" data-od-id="hero-digest-preview">
                <header>
                  <p className="meta">今日结构</p>
                  <h2 className="display-md" style={{ marginTop: "var(--space-2)" }}>
                    资讯摘要 + 个人判断
                  </h2>
                </header>
                <div className="digest-list">
                  {digestPreviewItems.map((item) => (
                    <article className="digest-item" data-od-id={item.odId} key={item.odId}>
                      <span className="digest-tag">{item.tag}</span>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="visual-stack reveal" data-od-id="hero-visual">
          <figure className="orbital-card primary" data-od-id="hero-image-primary">
            <img src={images.hero} alt="openlatter 的抽象 AI 资讯封面视觉" />
          </figure>
          <figure className="orbital-card secondary" data-od-id="hero-image-secondary">
            <img src={images.work} alt="一组围绕 AI 观察与写作的视觉卡片" />
          </figure>
          <aside className="floating-brief" data-od-id="floating-brief">
            <p className="meta">openlatter / 上午版</p>
            <h2 className="display-md" style={{ marginTop: "var(--space-2)" }}>
              今天值得读的三件事
            </h2>
            <div className="brief-lines" aria-hidden="true">
              <span className="brief-line" />
              <span className="brief-line" />
              <span className="brief-line short" />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
