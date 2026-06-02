// Top bar: prompt menu, UNT logo, title, settings, notification bell (port of iOS headerBar).
import { useState } from "react";

export interface PromptItem {
  label: string;
  prompt: string;
}

interface Props {
  promptItems: PromptItem[];
  notificationCount: number;
  onSelectPrompt: (item: PromptItem) => void;
  onOpenSettings: () => void;
  onOpenMissingAssignments: () => void;
}

const UNT_HOME = "https://www.unt.edu/";

export function Header({
  promptItems,
  notificationCount,
  onSelectPrompt,
  onOpenSettings,
  onOpenMissingAssignments,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header-bar">
      <div className="menu-wrap">
        <button
          className="icon-button"
          aria-label="Prompts menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>
        {menuOpen && (
          <>
            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="menu-popover">
              {promptItems.map((item) => (
                <button
                  key={item.label}
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onSelectPrompt(item);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <a href={UNT_HOME} target="_blank" rel="noreferrer" className="logo-link" aria-label="UNT website">
        <img src="/unt-logo.svg" alt="UNT" className="logo" />
      </a>

      <div className="spacer" />

      <span className="app-title">myUNT</span>

      <button className="icon-button" aria-label="Settings" onClick={onOpenSettings}>
        ⚙️
      </button>

      <button className="icon-button bell" aria-label="Missing assignments" onClick={onOpenMissingAssignments}>
        🔔
        {notificationCount > 0 && <span className="badge">{Math.min(notificationCount, 99)}</span>}
      </button>
    </header>
  );
}
