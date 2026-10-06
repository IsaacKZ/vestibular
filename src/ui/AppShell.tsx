import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useStudy } from "./AppContext";
import { Notice } from "./FormControls";
import { UpdatePrompt } from "./UpdatePrompt";
const links = [
  { to: "/", label: "Hoje", icon: "today" },
  { to: "/questions", label: "Questões", icon: "questions" },
  { to: "/notebook", label: "Caderno", icon: "notebook" },
  { to: "/progress", label: "Progresso", icon: "progress" },
];
function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    today: "M4 5h16v15H4z M7 2v6 M17 2v6 M4 10h16 M8 14h3 M8 17h6",
    questions: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
    notebook:
      "M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z M14 7a3 3 0 0 1 3-3h3v15h-3a3 3 0 0 0-3 2",
    progress: "M4 3v17h17 M8 16v-4 M13 16V8 M18 16V5",
  };
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function AppShell() {
  const app = useStudy();
  const [online, setOnline] = useState(navigator.onLine);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
    };
  }, []);
  const sessionActive = app.history.sessions.some(
    (s) =>
      s.status === "active" &&
      (s.mode === "assessment" ||
        s.questions.some(
          (q) =>
            !app.history.attempts.some(
              (a) => a.sessionId === s.id && a.questionId === q.id,
            ),
        )),
  );
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <span>
            Caderno <strong>UDESC</strong>
          </span>
        </NavLink>
        <p className="sidebar-caption">Estudo, tentativa e retorno.</p>
        <nav className="main-nav" aria-label="Navegação principal">
          {links.map((link) => (
            <NavLink end={link.to === "/"} key={link.to} to={link.to}>
              <NavIcon name={link.icon} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink className="settings-link" to="/settings">
          Configurações e backup
        </NavLink>
        <p className="local-note">
          Dados neste dispositivo
          <br />
          <span>
            {!online
              ? "Você está offline"
              : import.meta.env.DEV
                ? "Ambiente de desenvolvimento"
                : offlineReady || navigator.serviceWorker?.controller
                  ? "Disponível offline"
                  : "Preparando acesso offline"}
          </span>
        </p>
      </aside>
      <div className="content-wrap">
        <header className="mobile-header">
          <NavLink to="/" className="brand">
            Caderno <strong>UDESC</strong>
          </NavLink>
          <NavLink to="/settings" aria-label="Configurações e backup">
            Configurações
          </NavLink>
        </header>
        <main id="main-content" tabIndex={-1}>
          {!online && (
            <Notice>
              Modo offline. Seu histórico continua neste dispositivo.
            </Notice>
          )}
          {app.error && <Notice kind="error">{app.error}</Notice>}
          {app.loading ? (
            <p role="status">Carregando acervo e dados locais…</p>
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="app-footer">
          Caderno pessoal · acervo parcial das cinco matérias
        </footer>
      </div>
      {needRefresh && (
        <UpdatePrompt
          sessionActive={sessionActive}
          onApply={() => void updateServiceWorker(true)}
        />
      )}
    </div>
  );
}
