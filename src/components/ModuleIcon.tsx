import { contentModules } from "@/data/landing";

type ModuleIconName = (typeof contentModules)[number]["icon"];

export function ModuleIcon({ name }: { name: ModuleIconName }) {
  return (
    <div className="module-icon" aria-hidden="true">
      {name === "news" ? (
        <svg viewBox="0 0 24 24">
          <path d="M5 5h14v14H5z" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      ) : name === "analysis" ? (
        <svg viewBox="0 0 24 24">
          <path d="M4 17l5-5 4 4 7-9" />
          <path d="M4 20h16" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24">
          <path d="M12 3v18M5 10l7-7 7 7" />
          <path d="M6 21h12" />
        </svg>
      )}
    </div>
  );
}
