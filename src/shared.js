/* ─── DESIGN TOKENS ───────────────────────────────────────────── */
export const C = {
  bg:           '#0d1117',
  surface:      '#161b22',
  surfaceHov:   '#1c2230',
  border:       '#21293a',
  borderLit:    '#2d3f5a',
  accent:       '#2563eb',
  accentGlow:   '#3b82f6',
  accentDim:    '#1e3a6b',
  userBubble:   '#57679c',
  aiBubble:     '#1a2236',
  textPrim:     '#e6edf3',
  textSec:      '#8b98a9',
  textMuted:    '#4a5568',
  white:        '#ffffff',
  error:        '#ef4444',
  success:      '#22c55e',
  thinking:     '#1d2051',
  thinkingDim:  '#879ff0',
  book:         '#f59e0b',
  playlist:     '#22c55e',
  summarize:    '#7c3aed',
  summarizeGlow:'#a78bfa',
};

export const LOGO_PATH   = '/DEFTXR LOGO BLACK BACKGROUND.png';
export const STORAGE_KEY = 'deftxr_chat_history';
export const PREFS_KEY   = 'deftxr_prefs';

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
export function saveHistory(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
}
export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}
export function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
}

/* ─── GLOBAL STYLES ───────────────────────────────────────────── */
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${C.bg};
    color: ${C.textPrim};
    font-family: 'DM Sans', sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: ${C.borderLit}; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 8px ${C.accentGlow}44; }
    50% { box-shadow: 0 0 20px ${C.accentGlow}88; }
  }
  @keyframes thinkingPulse {
    0%, 100% { box-shadow: 0 0 8px ${C.thinking}44; }
    50% { box-shadow: 0 0 20px ${C.thinking}88; }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes modalIn {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
`;