import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Navegacion principal">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            GA
          </span>
          <span>GzAccess</span>
        </div>
        <nav>
          <a className="active" href="#operacion">
            <span className="nav-dot" aria-hidden="true" />
            Operacion
          </a>
          <a href="#edificios">
            <span className="nav-dot" aria-hidden="true" />
            Edificios
          </a>
        </nav>
      </aside>
      <section className="workspace" id="operacion">
        <header>
          <p>Fase 0</p>
          <h1>Base operativa GzAccess</h1>
        </header>
        <div className="status-grid">
          <article>
            <span>API</span>
            <strong>/api/v1/health</strong>
            <p>Endpoint inicial listo para monitoreo.</p>
          </article>
          <article>
            <span>Edge</span>
            <strong>Simulador primero</strong>
            <p>Contratos multimarca sin acoplarse a fabricantes.</p>
          </article>
          <article>
            <span>Datos</span>
            <strong>PostgreSQL + Prisma</strong>
            <p>Modelo multi-tenant inicial con auditoria.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
