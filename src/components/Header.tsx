import { navItems } from "@/data/landing";

export function Header() {
  return (
    <header className="topnav" data-od-id="topnav">
      <div className="container topnav-inner">
        <a className="brand" href="#top" data-od-id="nav-brand" aria-label="openlatter 首页">
          <span className="brand-mark" aria-hidden="true" />
          <span>openlatter</span>
        </a>
        <nav aria-label="主导航" data-od-id="nav-links">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} data-od-id={item.odId}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="nav-action" href="#subscribe" data-od-id="nav-subscribe">
          绑定邮箱
        </a>
      </div>
    </header>
  );
}
