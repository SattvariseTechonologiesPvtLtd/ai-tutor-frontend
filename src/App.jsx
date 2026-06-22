import { useState, useEffect } from 'react';
import { C, GLOBAL_CSS } from './shared';
import LoginPage from './utils/login';
import ChatPage from './pages/ChatPage';
import CadavierPage from './pages/CadavierPage';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState('chat');

  useEffect(() => {
    const id = 'deftxr-global-styles';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style');
      tag.id = id;
      tag.textContent = GLOBAL_CSS + `
        /* ── Code ── */
        .code-block { background: #0d1117; border: 1px solid ${C.border}; border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 10px 0; font-size: 13px; font-family: 'JetBrains Mono','Fira Code',monospace; color: #a8dadc; white-space: pre; }
        .inline-code { background: ${C.border}; border-radius: 4px; padding: 2px 6px; font-size: 13px; font-family: monospace; color: #93c5fd; }

        /* ── Headings ── */
        .md-h1, .md-h2, .md-h3 { font-family: 'Inter', sans-serif; color: ${C.white}; text-align: left; }
        .md-h1 { font-size: 18px; font-weight: 700; margin: 18px 0 8px; }
        .md-h2 { font-size: 16px; font-weight: 700; margin: 16px 0 6px; border-bottom: 1px solid ${C.border}; padding-bottom: 5px; }
        .md-h3 { font-size: 14px; font-weight: 600; margin: 12px 0 5px; color: #c9d3e0; }

        /* ── Lists ── */
        .md-ul, .md-ol { padding-left: 20px; margin: 6px 0 8px; text-align: left; }
        .md-ul { list-style: none; }
        .md-ul > li { position: relative; padding-left: 14px; }
        .md-ul > li::before { content: '–'; position: absolute; left: 0; color: ${C.accentGlow}; font-weight: 600; }
        .md-ol { list-style: decimal; }
        .md-li { margin: 5px 0; line-height: 1.7; font-size: 14px; }
        .md-li > .md-p { margin: 0; }
        .md-li + .md-li { margin-top: 6px; }

        /* ── Paragraph ── */
        .md-p { margin: 6px 0; text-align: left; line-height: 1.75; font-size: 14.5px; }

        /* ── Blockquote ── */
        .md-blockquote { border-left: 3px solid ${C.accentGlow}; margin: 12px 0; padding: 8px 14px; background: ${C.accent}0f; border-radius: 0 8px 8px 0; color: ${C.textPrim}; font-style: normal; font-size: 14px; line-height: 1.7; }
        .md-blockquote .md-p { margin: 0; font-size: 14px; }

        /* ── Table ── */
        .md-table-wrap { overflow-x: auto; margin: 10px 0; border-radius: 8px; border: 1px solid ${C.border}; opacity: 0.85; }
        .md-table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .md-th { background: #1c2230; color: ${C.textPrim}; font-weight: 600; padding: 8px 12px; border-bottom: 1px solid ${C.borderLit}; border-right: 1px solid ${C.border}; text-align: left; font-size: 12px; white-space: nowrap; }
        .md-th:last-child { border-right: none; }
        .md-td { padding: 7px 12px; border-bottom: 1px solid ${C.border}; border-right: 1px solid ${C.border}; color: ${C.textPrim}; vertical-align: top; line-height: 1.55; }
        .md-td:last-child { border-right: none; }
        .md-table tbody tr:last-child .md-td { border-bottom: none; }
        .md-table tbody tr:nth-child(even) .md-td { background: #161b2233; }
      `;
      document.head.appendChild(tag);
    }
  }, []);

  return loggedIn
    ? (page === 'cadavier'
        ? <div style={{ display: 'flex', height: '100vh' }}><CadavierPage onNavigate={setPage} onLogout={() => setLoggedIn(false)} /></div>
        : <ChatPage onLogout={() => setLoggedIn(false)} onNavigate={setPage} />)
    : <LoginPage onLogin={() => setLoggedIn(true)} />;
}