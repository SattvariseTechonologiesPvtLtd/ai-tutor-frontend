import { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ─── DESIGN TOKENS ───────────────────────────────────────────── */
const C = {
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

/* ─── GLOBAL STYLES ───────────────────────────────────────────── */
const GLOBAL_CSS = `
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

const LOGO_PATH   = '/DEFTXR LOGO BLACK BACKGROUND.png';
const STORAGE_KEY = 'deftxr_chat_history';
const PREFS_KEY   = 'deftxr_prefs';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveHistory(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
}
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}
function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
}

/* ─── MARKDOWN COMPONENTS (react-markdown + remark-gfm) ─────── */
/*
  We pass a `components` map so every element gets our design-system
  styling instead of bare browser defaults.
*/
const MD_COMPONENTS = {
  h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
  p:  ({ children }) => <p  className="md-p" >{children}</p>,
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children }) => <li className="md-li">{children}</li>,
  code: ({ inline, children }) =>
    inline
      ? <code className="inline-code">{children}</code>
      : <pre className="code-block"><code>{children}</code></pre>,
  /* ── Table elements ── */
  table:   ({ children }) => (
    <div className="md-table-wrap">
      <table className="md-table">{children}</table>
    </div>
  ),
  thead:   ({ children }) => <thead>{children}</thead>,
  tbody:   ({ children }) => <tbody>{children}</tbody>,
  tr:      ({ children }) => <tr>{children}</tr>,
  th:      ({ children }) => <th className="md-th">{children}</th>,
  td:      ({ children }) => <td className="md-td">{children}</td>,
  strong:  ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  em:      ({ children }) => <em>{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="md-blockquote">{children}</blockquote>
  ),
};

/* Clean stray markdown artifacts before rendering */
/* ─── MARKDOWN NORMALIZER ─────────────────────────────────────── */
/*
  The server sometimes sends markdown with collapsed newlines, so block
  syntax like ###, -, 1. runs inline with surrounding text.
  We restore the line-breaks react-markdown needs, then strip cosmetic
  artifacts like a lone ** at the end of a heading.
*/
function sanitizeMd(text) {
  if (!text) return '';
  let t = text;

  // 1. Ensure headings start on their own line (inject newline BEFORE)
  t = t.replace(/([^\n])(#{1,6} )/g, '$1\n\n$2');

  // 1b. Ensure a blank line AFTER a heading line
  t = t.replace(/(#{1,6} [^\n]+)(\n)(?!\n)/g, '$1\n\n');

  // 2. Ensure numbered list items start on their own line
  t = t.replace(/([^\n])(\d+\. )/g, '$1\n$2');

  // 3. Ensure dash bullets (- ) start on their own line
  t = t.replace(/([^\n])(- )/g, '$1\n$2');

  // 3b. Ensure blockquotes (>) start on their own line
  t = t.replace(/([^\n])(> )/g, '$1\n\n$2');

  // 3c. Ensure bold-labels used as sub-headings start on their own line
  //     e.g. "...artery [1].**Indirect inguinal hernia:**"
  t = t.replace(/([^\n])(\*{2}[A-Z])/g, '$1\n\n$2');

  // 4. Fix unclosed bold markers at START of a line used as labels
  //    e.g. "**Tracts Affected:" → "**Tracts Affected:**"
  //    Pattern: line starts with ** then text then : with no closing **
  t = t.replace(/^(\*{2})([^*\n]+:)\s*$/gm, '$1$2$1');

  // 5. Strip stray trailing ** or __ that are NOT part of a bold pair
  //    i.e. lines ending with ** that started with ** (already handled above),
  //    or truly orphan trailing markers after non-bold content
  t = t.replace(/([^*])(\*{1,2})\s*$/gm, '$1');

  // 6. Remove lines that are only ** or __ (pure orphan markers)
  t = t.replace(/^\s*(\*{1,2}|_{1,2})\s*$/gm, '');

  // 7. Collapse 3+ blank lines to 2
  t = t.replace(/\n{3,}/g, '\n\n');

  return t;
}

/* Wrapper used everywhere — keeps call sites clean */
function MD({ children }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
      {sanitizeMd(children)}
    </Markdown>
  );
}

/* ─── PDF HELPERS ─────────────────────────────────────────────── */
function downloadTextAsPdf(filename, content) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${filename}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; line-height: 1.7; color: #1a1a2e; padding: 40px 48px; background: #fff; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
  .subtitle { font-size: 11px; color: #64748b; margin-bottom: 28px; letter-spacing: 0.06em; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
  .msg { margin-bottom: 18px; page-break-inside: avoid; }
  .role { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 4px; }
  .role.user { color: #2563eb; } .role.ai { color: #7c3aed; }
  .bubble { background: #f8fafc; border-left: 3px solid #e2e8f0; padding: 10px 14px; border-radius: 0 8px 8px 0; }
  .bubble.user { border-left-color: #2563eb22; background: #eff6ff; }
  .bubble.ai   { border-left-color: #7c3aed22; background: #faf5ff; }
  pre { background: #0f172a; color: #a8dadc; padding: 10px; border-radius: 6px; font-size: 11px; overflow-x: auto; margin: 8px 0; white-space: pre-wrap; }
  p { margin: 4px 0; } ul,ol { padding-left: 18px; margin: 4px 0; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th { background: #f1f5f9; font-weight: 600; padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left; }
  td { padding: 5px 10px; border: 1px solid #e2e8f0; }
  strong { font-weight: 600; } em { font-style: italic; }
  .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>${content}</body>
</html>`);
  doc.close();
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 500);
}

function buildChatHistoryHtml(messages) {
  const date = new Date().toLocaleString();
  let body = `<h1>DEFTXR Anatomy Tutor — Chat History</h1><div class="subtitle">Session exported: ${date}</div><hr>`;
  const relevant = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  for (const msg of relevant) {
    const isUser = msg.role === 'user';
    const time = msg.time ? ` · ${msg.time}` : '';
    // For PDF we just use the raw text (markdown renders fine in print CSS)
    body += `<div class="msg"><div class="role ${isUser ? 'user' : 'ai'}">${isUser ? 'YOU' : 'DEFTXR AI'}${time}</div><div class="bubble ${isUser ? 'user' : 'ai'}">${(msg.content || '').replace(/\n/g, '<br>')}</div></div>`;
  }
  body += `<div class="footer">Generated by DEFTXR Anatomy Tutor · ${date}</div>`;
  return body;
}

function buildSummaryHtml(summaryText) {
  const date = new Date().toLocaleString();
  return `<h1>DEFTXR Anatomy Tutor — Session Summary</h1><div class="subtitle">Generated: ${date}</div><hr>${(summaryText || '').replace(/\n/g, '<br>')}<div class="footer">Generated by DEFTXR Anatomy Tutor · ${date}</div>`;
}

/* ─── SUMMARY MODAL ───────────────────────────────────────────── */
function SummaryModal({ messages, onClose }) {
  const [summary, setSummary]     = useState('');
  const [streaming, setStreaming] = useState('');
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [streaming, summary, done]);

  useEffect(() => {
    let cancelled = false;
    async function fetchSummary() {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));
      try {
        const res = await fetch('http://localhost:8000/summarize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '', acc = '';
        while (true) {
          const { done: d, value } = await reader.read();
          if (d) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split('\n\n'); buf = events.pop();
          for (const event of events) {
            const payload = event.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
            if (!payload) continue;
            if (payload === '[DONE]') { if (!cancelled) { setSummary(acc); setStreaming(''); setDone(true); } return; }
            if (payload.startsWith('[ERROR]')) { if (!cancelled) setError(payload.slice(7)); return; }
            acc += payload;
            if (!cancelled) setStreaming(acc);
          }
        }
        if (!cancelled) { setSummary(acc); setStreaming(''); setDone(true); }
      } catch (e) { if (!cancelled) setError(e.message); }
    }
    fetchSummary();
    return () => { cancelled = true; };
  }, []);

  const displayText = summary || streaming;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: '720px', maxHeight: '85vh', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', animation: 'modalIn 0.3s cubic-bezier(0.4,0,0.2,1) forwards' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `linear-gradient(135deg, ${C.summarize}, ${C.summarizeGlow})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '15px', color: C.white }}>Session Summary</div>
              <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.06em' }}>{done ? 'Ready to download' : 'Generating…'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.error; e.currentTarget.style.color = C.error; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSec; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error ? (
            <div style={{ color: C.error, fontSize: '14px' }}> {error}</div>
          ) : displayText ? (
            <>
              <div style={{ color: C.textPrim, lineHeight: '1.75', fontSize: '14px' }}>
                <MD>{displayText}</MD>
              </div>
              {!done && <span style={{ animation: 'blink 1s ease infinite', display: 'inline-block', width: '2px', height: '14px', background: C.summarizeGlow, verticalAlign: 'middle', marginLeft: '2px' }} />}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: C.textSec, fontSize: '14px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.summarizeGlow} strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
              Analysing your conversation…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Download Buttons */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={() => downloadTextAsPdf('DEFTXR_Session_Summary', buildSummaryHtml(summary || streaming))} disabled={!done}
            style={{ flex: 1, minWidth: '140px', padding: '10px 16px', background: done ? `linear-gradient(135deg, ${C.summarize}, ${C.summarizeGlow})` : C.surfaceHov, border: 'none', borderRadius: '10px', color: done ? C.white : C.textMuted, cursor: done ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '12px', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', transition: 'all 0.2s' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            DOWNLOAD SUMMARY PDF
          </button>
          <button onClick={() => downloadTextAsPdf('DEFTXR_Chat_History', buildChatHistoryHtml(messages))}
            style={{ flex: 1, minWidth: '140px', padding: '10px 16px', background: 'transparent', border: `1px solid ${C.borderLit}`, borderRadius: '10px', color: C.textSec, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '12px', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentGlow; e.currentTarget.style.color = C.textPrim; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderLit;  e.currentTarget.style.color = C.textSec; }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            DOWNLOAD FULL HISTORY PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── FIGURE THUMBNAIL ────────────────────────────────────────── */
function FigureThumbnail({ img }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div onClick={() => setExpanded(true)} title={img.caption}
        style={{ cursor: 'zoom-in', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${C.border}`, flexShrink: 0 }}>
        <img src={img.url} alt={img.fig_label}
          style={{ width: '158px', height: '105px', objectFit: 'cover', display: 'block' }} />
        <div style={{ padding: '2px 5px', fontSize: '9px', fontFamily: 'Inter, sans-serif', color: C.textMuted, background: C.surface, letterSpacing: '0.04em' }}>
          {img.fig_label}
        </div>
      </div>
      {expanded && (
        <div onClick={() => setExpanded(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', cursor: 'zoom-out' }}>
          <img src={img.url} alt={img.fig_label}
            style={{ maxWidth: '90vw', maxHeight: '75vh', borderRadius: '10px', border: `1px solid ${C.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} />
          <div style={{ marginTop: '12px', color: C.textSec, fontSize: '12px', fontFamily: 'DM Sans, sans-serif', maxWidth: '680px', textAlign: 'center', lineHeight: '1.6' }}>
            <span style={{ color: C.book, fontWeight: '600', fontFamily: 'Inter, sans-serif' }}>{img.fig_label} </span>
            {img.caption.split('\n').slice(1, 2).join('')}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── YOUTUBE STATUS BUBBLE ───────────────────────────────── */
function YouTubeStatusBubble({ status }) {
  if (!status) return null;
  const isObj = typeof status === 'object';
  const isFetching = status === 'fetching';
  const isSearching = status === 'searching';
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '0 4px' }}>
      <div style={{ background: '#0f2027', border: '1px solid #22c55e44', borderRadius: '12px', padding: '10px 16px', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isSearching && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#22c55e', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}> Searching VB Anatomy channel…</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
          </div>
        )}
        {(isObj || isFetching) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#22c55e', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
               Found: {isObj ? status.title : status.foundTitle}
            </span>
            {isObj && status.url && (
              <a href={status.url} target="_blank" rel="noreferrer"
                style={{ fontSize: '11px', color: '#3b82f6', textDecoration: 'none', whiteSpace: 'nowrap', border: '1px solid #3b82f644', borderRadius: '6px', padding: '2px 8px' }}>
                ↗ YouTube
              </a>
            )}
          </div>
        )}
        {isFetching && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#22c55e', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}> Fetching…</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── SOURCES PANEL ───────────────────────────────────────────── */
function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{ marginTop: '8px', maxWidth: 'min(820px, 92%)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: C.textSec, fontSize: '12px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em', transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderLit; e.currentTarget.style.color = C.textPrim; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;    e.currentTarget.style.color = C.textSec; }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        {sources.length} SOURCE{sources.length > 1 ? 'S' : ''}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '5px', animation: 'fadeUp 0.2s ease forwards' }}>
          {sources.map(s => (
            <div key={s.index} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '12.5px' }}>
              <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: '600', letterSpacing: '0.06em', flexShrink: 0, marginTop: '1px', background: s.source === 'youtube' ? '#ef444422' : s.source === 'playlist' ? `${C.playlist}22` : `${C.book}22`, color: s.source === 'youtube' ? '#ef4444' : s.source === 'playlist' ? C.playlist : C.book, border: `1px solid ${s.source === 'youtube' ? '#ef444444' : s.source === 'playlist' ? C.playlist + '44' : C.book + '44'}` }}>
                {s.source === 'youtube' ? 'YOUTUBE' : s.source === 'playlist' ? 'LECTURE' : 'BOOK'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.textPrim, fontWeight: '500', lineHeight: '1.4' }}>
                  {s.source === 'youtube' && s.url
                    ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>[{s.index}] {s.title} ↗</a>
                    : <>[{s.index}] {s.title}</>}
                </div>
                {s.section && <div style={{ color: C.textMuted, fontSize: '11.5px', marginTop: '2px' }}>{s.section}</div>}
              </div>
              <span style={{ fontSize: '10px', color: C.textMuted, fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
                {(s.score * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── THINKING BLOCK ──────────────────────────────────────────── */
function ThinkingBlock({ text, streaming = false }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div style={{ maxWidth: 'min(820px, 92%)', marginBottom: '4px' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: open ? `${C.thinking}22` : 'transparent', border: `1px solid ${open ? C.thinking + '66' : C.border}`, borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: open ? C.thinkingDim : C.textSec, fontSize: '12px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em', transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.thinking + '88'; e.currentTarget.style.color = C.thinkingDim; }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSec; } }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
        {streaming ? 'Thinking…' : 'Chain of Thought'}
        {streaming && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.thinkingDim, animation: 'pulse 1s ease infinite', display: 'inline-block', marginLeft: '2px' }} />}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '2px' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ marginTop: '6px', padding: '12px 14px', background: `${C.thinking}14`, border: `1px solid ${C.thinking}44`, borderRadius: '10px', fontSize: '13px', color: C.thinkingDim, lineHeight: '1.7', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word', animation: 'fadeUp 0.2s ease forwards', maxHeight: '320px', overflowY: 'auto' }}>
          {text}
          {streaming && <span style={{ animation: 'blink 1s ease infinite', display: 'inline-block', width: '2px', height: '12px', background: C.thinkingDim, verticalAlign: 'middle', marginLeft: '2px' }} />}
        </div>
      )}
    </div>
  );
}

/* ─── CLARIFY CARD ────────────────────────────────────────────── */
function ClarifyCard({ msg, onSubmit }) {
  // answers[qid] = { selected: Set of option ids, custom: string, skipped: bool }
  const init = () => Object.fromEntries(msg.mcq.questions.map(q => [q.id, { selected: new Set(), custom: '', skipped: false }]));
  const [answers, setAnswers] = useState(init);

  const toggleOption = (qid, oid) => setAnswers(prev => {
    const a = { ...prev[qid], skipped: false };
    const s = new Set(a.selected);
    s.has(oid) ? s.delete(oid) : s.add(oid);
    return { ...prev, [qid]: { ...a, selected: s } };
  });

  const setCustom = (qid, val) => setAnswers(prev => ({
    ...prev, [qid]: { ...prev[qid], custom: val, skipped: false }
  }));

  const toggleSkip = (qid) => setAnswers(prev => ({
    ...prev, [qid]: { ...prev[qid], skipped: !prev[qid].skipped, selected: new Set(), custom: '' }
  }));

  // Each question needs at least one selection, custom text, or be skipped
  const isAnswered = (a) => a.skipped || a.selected.size > 0 || a.custom.trim().length > 0;
  const allAnswered = msg.mcq.questions.every(q => isAnswered(answers[q.id]));

  const handleSubmit = () => {
    if (!allAnswered) return;
    const lines = msg.mcq.questions.map(q => {
      const a = answers[q.id];
      if (a.skipped) return null;
      const parts = [];
      if (a.selected.size > 0) {
        const labels = q.options.filter(o => a.selected.has(o.id)).map(o => o.label);
        parts.push(labels.join(', '));
      }
      if (a.custom.trim()) parts.push(a.custom.trim());
      return parts.length ? `${q.question} → ${parts.join(' + ')}` : null;
    }).filter(Boolean);
    const refined = `${msg.originalQuestion}\n\nSpecifically:\n${lines.join('\n')}`;
    onSubmit(refined);
  };

  const S = {
    card: { maxWidth: 'min(820px, 92%)', background: C.surface, border: `1px solid ${C.borderLit}`, borderRadius: '4px 16px 16px 16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '18px' },
    qBlock: { display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '14px', borderBottom: `1px solid ${C.border}` },
    qLabel: { fontSize: '13.5px', color: C.textPrim, fontWeight: '600', fontFamily: 'Inter, sans-serif' },
    chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    customInput: { marginTop: '4px', width: '100%', padding: '7px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrim, fontSize: '12.5px', fontFamily: 'DM Sans, sans-serif', outline: 'none' },
    skipBtn: (skipped) => ({ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em', cursor: 'pointer', border: `1px solid ${skipped ? C.accentGlow + '66' : C.border}`, background: skipped ? `${C.accent}22` : 'transparent', color: skipped ? C.accentGlow : C.textMuted, transition: 'all 0.15s' }),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', animation: 'fadeUp 0.3s ease forwards' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.surface, border: `1px solid ${C.border}`, overflow: 'hidden', flexShrink: 0 }}>
          <img src={LOGO_PATH} alt="DEFTXR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <span style={{ fontSize: '11px', color: C.textMuted, fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>DEFTXR AI · {msg.time}</span>
      </div>
      <div style={S.card}>
        <div style={{ fontSize: '13px', color: C.textSec, fontFamily: 'Inter, sans-serif' }}>
          That's a broad topic — help me focus. You can pick multiple, type your own, or skip.
        </div>

        {msg.mcq.questions.map((q, qi) => {
          const a = answers[q.id];
          return (
            <div key={q.id} style={{ ...S.qBlock, ...(qi === msg.mcq.questions.length - 1 ? { borderBottom: 'none', paddingBottom: 0 } : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={S.qLabel}>{q.question}</div>
                <button onClick={() => toggleSkip(q.id)} style={S.skipBtn(a.skipped)}>
                  {a.skipped ? '↩ unskip' : 'skip'}
                </button>
              </div>
              {!a.skipped && (
                <>
                  <div style={S.chips}>
                    {q.options.map(o => {
                      const sel = a.selected.has(o.id);
                      return (
                        <button key={o.id} onClick={() => toggleOption(q.id, o.id)}
                          style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', transition: 'all 0.15s', background: sel ? `${C.accent}33` : 'transparent', border: `1px solid ${sel ? C.accentGlow : C.border}`, color: sel ? C.accentGlow : C.textSec }}>
                          {sel && <span style={{ marginRight: '5px', fontSize: '10px' }}>✓</span>}{o.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    placeholder="Or type your own…"
                    value={a.custom}
                    onChange={e => setCustom(q.id, e.target.value)}
                    style={S.customInput}
                  />
                </>
              )}
            </div>
          );
        })}

        <button onClick={handleSubmit} disabled={!allAnswered}
          style={{ alignSelf: 'flex-start', padding: '8px 20px', borderRadius: '10px', fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: '700', letterSpacing: '0.06em', cursor: allAnswered ? 'pointer' : 'not-allowed', border: 'none', background: allAnswered ? `linear-gradient(135deg, ${C.accent}, ${C.accentGlow})` : C.surfaceHov, color: allAnswered ? C.white : C.textMuted, transition: 'all 0.2s' }}>
          SEARCH →
        </button>
      </div>
    </div>
  );
}

/* ─── MESSAGE BUBBLE ──────────────────────────────────────────── */
function MessageBubble({ msg, isNew, onDelete }) {
  const isUser     = msg.role === 'user';
  const isThinking = msg.thinking;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', animation: isNew ? 'fadeUp 0.3s ease forwards' : 'none', gap: '4px', position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: isUser ? 'row-reverse' : 'row' }}>
        {isUser ? (
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}, ${C.accentGlow})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: C.white, flexShrink: 0 }}>U</div>
        ) : (
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.surface, border: `1px solid ${isThinking ? C.thinking : C.border}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={LOGO_PATH} alt="DEFTXR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <span style={{ fontSize: '11px', color: C.textMuted, fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
          {isUser ? 'You' : isThinking ? 'Deep Thinking' : 'DEFTXR AI'} · {msg.time}
        </span>
      </div>

      {!isUser && msg.thinkingContent && <ThinkingBlock text={msg.thinkingContent} />}

      {/* Figures strip — shown above the bubble when book sources have images */}
      {!isUser && msg.sources && (() => {
        const seen = new Set();
        const allImgs = (msg.sources || []).flatMap(s => s.images || []).filter(img => {
          if (seen.has(img.fig_label)) return false;
          seen.add(img.fig_label);
          return true;
        });
        if (!allImgs.length) return null;
        return (
          <div style={{ maxWidth: 'min(820px, 92%)', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
            {allImgs.map((img, idx) => <FigureThumbnail key={idx} img={img} />)}
          </div>
        );
      })()}

      {/* Bubble */}
      <div style={{
        maxWidth: isUser ? 'min(600px, 78%)' : 'min(820px, 92%)',
        padding: '12px 16px',
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        background: isUser ? `linear-gradient(135deg, ${C.userBubble}, #1e40af)` : isThinking ? `linear-gradient(135deg, ${C.thinkingDim}, #1a1035)` : C.aiBubble,
        border: `1px solid ${isUser ? '#2563eb66' : isThinking ? C.thinking + '55' : C.border}`,
        color: C.textPrim, lineHeight: '1.65', fontSize: '14.5px',
        boxShadow: isUser ? `0 4px 16px ${C.accent}22` : `0 4px 12px rgba(0,0,0,0.3)`,
      }}>
        {msg.image && (
          <div style={{ marginBottom: '10px' }}>
            <img src={msg.image} alt="uploaded" style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '10px', border: `1px solid ${C.border}`, display: 'block' }} />
          </div>
        )}
        <div style={{ textAlign: 'left' }}>
          <MD>{msg.content}</MD>
        </div>
      </div>

      {!isUser && msg.sources && <SourcesPanel sources={msg.sources} />}
      {hovered && onDelete && msg.id !== undefined && (
        <button
          onClick={() => onDelete(msg.id)}
          title="Delete message"
          style={{ position: 'absolute', top: '0', [isUser ? 'left' : 'right']: '-32px', width: '24px', height: '24px', borderRadius: '6px', background: 'transparent', border: `1px solid ${C.border}`, cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.error; e.currentTarget.style.color = C.error; e.currentTarget.style.background = `${C.error}11`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = 'transparent'; }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      )}
    </div>
  );
}

/* ─── TYPING INDICATOR ────────────────────────────────────────── */
function TypingIndicator({ isThinking }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeUp 0.3s ease forwards' }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.surface, border: `1px solid ${isThinking ? C.thinking : C.border}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={LOGO_PATH} alt="DEFTXR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ padding: '10px 16px', background: isThinking ? `linear-gradient(135deg, ${C.thinkingDim}, #1a1035)` : C.aiBubble, border: `1px solid ${isThinking ? C.thinking + '55' : C.border}`, borderRadius: '4px 16px 16px 16px', display: 'flex', gap: '5px', alignItems: 'center', animation: isThinking ? 'thinkingPulse 2s ease infinite' : 'glow 2s ease infinite' }}>
        {[0,1,2].map(i => <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: isThinking ? C.thinking : C.accentGlow, animation: `pulse 1.2s ease ${i * 0.2}s infinite`, display: 'block' }} />)}
        {isThinking && <span style={{ fontSize: '11px', color: C.thinking, marginLeft: '6px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em' }}>thinking deeply…</span>}
      </div>
    </div>
  );
}

/* ─── STREAMING BUBBLE ────────────────────────────────────────── */
function StreamingBubble({ text, thinkingText, isThinking }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', animation: 'fadeUp 0.3s ease forwards' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.surface, border: `1px solid ${isThinking ? C.thinking : C.border}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={LOGO_PATH} alt="DEFTXR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <span style={{ fontSize: '11px', color: C.textMuted, fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>DEFTXR AI · now</span>
      </div>

      {thinkingText && <ThinkingBlock text={thinkingText} streaming={!text} />}

      {text && (
        <div style={{ maxWidth: 'min(820px, 92%)', padding: '12px 16px', borderRadius: '4px 16px 16px 16px', background: C.aiBubble, border: `1px solid ${C.border}`, color: C.textPrim, lineHeight: '1.65', fontSize: '14.5px', boxShadow: `0 4px 12px rgba(0,0,0,0.3)` }}>
          <div style={{ textAlign: 'left' }}>
            <MD>{text}</MD>
          </div>
          <span style={{ animation: 'blink 1s ease infinite', display: 'inline-block', width: '2px', height: '14px', background: C.accentGlow, verticalAlign: 'middle', marginLeft: '2px' }} />
        </div>
      )}
    </div>
  );
}

/* ─── LOGIN PAGE ──────────────────────────────────────────────── */
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const VALID_USER = 'deftxr';
  const VALID_PASS = 'deftxr@1234';

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (username === VALID_USER && password === VALID_PASS) { onLogin(); }
      else { setError('Invalid credentials. Please try again.'); setLoading(false); }
    }, 600);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(${C.border}33 1px, transparent 1px), linear-gradient(90deg, ${C.border}33 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
      <div style={{ position: 'absolute', top: '20%', left: '30%', width: '400px', height: '400px', borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}18 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: '400px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '40px', boxShadow: `0 24px 64px rgba(0,0,0,0.5)`, position: 'relative', animation: 'fadeUp 0.5s ease forwards' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
          <div style={{ width: '88px', height: '88px', borderRadius: '20px', overflow: 'hidden', border: `2px solid ${C.border}`, boxShadow: `0 0 24px ${C.accent}33`, flexShrink: 0 }}>
            <img src={LOGO_PATH} alt="DEFTXR" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '26px', fontWeight: '800', color: C.white }}>DEFTXR</h1>
            <p style={{ fontSize: '13px', color: C.textSec, marginTop: '4px', letterSpacing: '0.12em', fontFamily: 'Inter, sans-serif' }}>ANATOMY TUTOR</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {['username','password'].map(field => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: '11px', color: C.textMuted, fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', marginBottom: '6px' }}>{field.toUpperCase()}</label>
              <input type={field === 'password' ? 'password' : 'text'} value={field === 'username' ? username : password}
                onChange={e => field === 'username' ? setUsername(e.target.value) : setPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', color: C.textPrim, fontSize: '14px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
            </div>
          ))}
          {error && <p style={{ fontSize: '13px', color: C.error, textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ marginTop: '8px', padding: '12px', width: '100%', background: `linear-gradient(135deg, ${C.accent}, ${C.accentGlow})`, border: 'none', borderRadius: '10px', color: C.white, fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '14px', letterSpacing: '0.08em', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Signing in…' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── THINKING TOGGLE ─────────────────────────────────────────── */
function ThinkingToggle({ value, onChange, sidebar }) {
  return (
    <button onClick={() => onChange(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: value ? C.thinkingDim : C.bg, border: `1px solid ${value ? C.thinking : C.border}`, borderRadius: sidebar ? '10px' : '8px', padding: sidebar ? '10px 12px' : '6px 12px', cursor: 'pointer', transition: 'all 0.2s', width: sidebar ? '100%' : 'auto', boxShadow: value ? `0 0 12px ${C.thinking}33` : 'none' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={value ? C.thinking : C.textSec} strokeWidth="2"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill={value ? C.thinking : C.textSec}/></svg>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', color: value ? C.thinking : C.textSec }}>{value ? 'THINKING ON' : 'THINKING OFF'}</span>
      <div style={{ width: '28px', height: '16px', background: value ? C.thinking : C.border, borderRadius: '8px', position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: sidebar ? 'auto' : '0' }}>
        <div style={{ position: 'absolute', top: '2px', left: value ? '14px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: C.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>
    </button>
  );
}


/* ─── YOUTUBE TOGGLE ──────────────────────────────────────── */
function YouTubeToggle({ value, onChange, sidebar }) {
  return (
    <button onClick={() => onChange(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: value ? '#ef444418' : C.bg, border: `1px solid ${value ? '#ef4444' : C.border}`, borderRadius: sidebar ? '10px' : '8px', padding: sidebar ? '10px 12px' : '6px 12px', cursor: 'pointer', transition: 'all 0.2s', width: sidebar ? '100%' : 'auto', boxShadow: value ? '0 0 12px #ef444433' : 'none' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={value ? '#ef4444' : C.textSec} strokeWidth="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill={value ? '#ef4444' : C.textSec} stroke="none"/></svg>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', color: value ? '#ef4444' : C.textSec }}>{value ? 'YT SEARCH ON' : 'YT SEARCH OFF'}</span>
      <div style={{ width: '28px', height: '16px', background: value ? '#ef4444' : C.border, borderRadius: '8px', position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: sidebar ? 'auto' : '0' }}>
        <div style={{ position: 'absolute', top: '2px', left: value ? '14px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: C.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>
    </button>
  );
}

/* ─── MAIN CHAT ───────────────────────────────────────────────── */
function ChatPage({ onLogout }) {
  const prefs = loadPrefs();
  const [messages, setMessages]         = useState(() => {
    const h = loadHistory();
    return h.length ? h : [{ role: 'assistant', content: 'Hello! I am your **DEFTXR Anatomy Tutor**. Ask me anything about anatomy.\n\nI\'m ready to help you learn.', time: now(), id: 0 }];
  });
  const [input, setInput]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [ytStatus, setYtStatus]         = useState(null);
  const [streaming, setStreaming]       = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [thinkingMode, setThinkingMode] = useState(prefs.thinkingMode ?? false);
  const [ytSearchMode, setYtSearchMode] = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [showSummary, setShowSummary]   = useState(false);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const nextId      = useRef(messages.length);

  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming, isLoading]);
  useEffect(() => { saveHistory(messages); }, [messages]);
  useEffect(() => { savePrefs({ thinkingMode }); }, [thinkingMode]);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) });
        setServerOnline(res.ok);
      } catch { setServerOnline(false); }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [input]);

  const send = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const question = input.trim();
    const history  = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, { role: 'user', content: question, time: now(), id: ++nextId.current }]);
    setInput('');
    setIsLoading(true);
    setStreaming('');
    setStreamingThinking('');

    try {
      let response;
      try {
        response = await fetch(ytSearchMode ? 'http://localhost:8000/ask-youtube' : 'http://localhost:8000/ask', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, thinking: thinkingMode, history }),
        });
      } catch { throw new Error('CONNECTION_REFUSED'); }

      if (!response.ok) throw new Error(`HTTP_ERROR_${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '', acc = '', thinkingAcc = '', sources = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n'); buf = events.pop();
        for (const event of events) {
          const payload = event.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
          if (!payload) continue;
          if (payload === '[DONE]') continue;
          if (payload.startsWith('[CLARIFY]')) {
            try {
              const mcq = JSON.parse(payload.slice(9).trim());
              setMessages(prev => [...prev, { role: 'clarify', mcq, originalQuestion: question, time: now(), id: ++nextId.current }]);
            } catch {}
            setStreaming(''); setStreamingThinking(''); setIsLoading(false);
            return;
          }
          if (payload.startsWith('[SOURCES]')) { try { sources = JSON.parse(payload.slice(9).trim()); } catch {} continue; }
          if (payload.startsWith('[THINKING]')) { thinkingAcc += payload.slice(10); setStreamingThinking(thinkingAcc); continue; }
          if (payload === '[SEARCHING_YT]') { setYtStatus('searching'); continue; }
          if (payload.startsWith('[VIDEO_FOUND]')) { try { setYtStatus(JSON.parse(payload.slice(13).trim())); } catch {} continue; }
          if (payload === '[FETCHING_YT]') { setYtStatus('fetching'); continue; }
          if (payload.startsWith('[ERROR]')) { acc += `\n\n ${payload.slice(7)}`; setStreaming(acc); continue; }
          try { acc += JSON.parse(payload); } catch { acc += payload; }
          setStreaming(acc);
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: acc, sources, thinking: thinkingMode, thinkingContent: thinkingAcc || null, time: now(), id: ++nextId.current }]);
      setStreaming('');
      setStreamingThinking('');
      setYtStatus(null);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err?.message === 'CONNECTION_REFUSED'
          ? ' **Cannot reach the backend.**\n\nMake sure the server is running:\n```\nuvicorn server:app --reload --port 8000\n```'
          : ` **Request failed:** ${err?.message ?? 'Unknown error'}`,
        time: now(), id: ++nextId.current,
      }]);
      setStreaming('');
      setStreamingThinking('');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, thinkingMode, messages]);

  const sendRefined = useCallback(async (refinedQuestion) => {
    setMessages(prev => [...prev, { role: 'user', content: refinedQuestion, time: now(), id: ++nextId.current }]);
    setIsLoading(true); setStreaming(''); setStreamingThinking(''); setYtStatus(null);
    try {
      let response;
      try {
        response = await fetch('http://localhost:8000/ask', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: refinedQuestion, thinking: thinkingMode, history: [], refined: true }),
        });
      } catch { throw new Error('CONNECTION_REFUSED'); }
      if (!response.ok) throw new Error(`HTTP_ERROR_${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '', acc = '', thinkingAcc = '', sources = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n'); buf = events.pop();
        for (const event of events) {
          const payload = event.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
          if (!payload) continue;
          if (payload === '[DONE]') continue;
          if (payload.startsWith('[SOURCES]')) { try { sources = JSON.parse(payload.slice(9).trim()); } catch {} continue; }
          if (payload.startsWith('[THINKING]')) { thinkingAcc += payload.slice(10); setStreamingThinking(thinkingAcc); continue; }
          try { acc += JSON.parse(payload); } catch { acc += payload; }
          setStreaming(acc);
        }
      }
      setMessages(prev => [...prev, { role: 'assistant', content: acc, sources, thinking: thinkingMode, thinkingContent: thinkingAcc || null, time: now(), id: ++nextId.current }]);
      setStreaming(''); setStreamingThinking('');
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: ` **Request failed:** ${err?.message ?? 'Unknown error'}`, time: now(), id: ++nextId.current }]);
      setStreaming(''); setStreamingThinking('');
    } finally { setIsLoading(false); }
  }, [thinkingMode]);

  const handleKey    = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const clearHistory = () => {
    const fresh = [{ role: 'assistant', content: 'Chat cleared. How can I help?', time: now(), id: ++nextId.current }];
    setMessages(fresh); saveHistory(fresh);
  };
  const deleteMessage = useCallback((id) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const hasConversation = messages.some(m => m.role === 'user') || messages.filter(m => m.role === 'assistant').length > 1;

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, overflow: 'hidden' }}>

      {showSummary && <SummaryModal messages={messages} onClose={() => setShowSummary(false)} />}

      {/* SIDEBAR */}
      <div style={{ width: sidebarOpen ? '260px' : '0', minWidth: sidebarOpen ? '260px' : '0', overflow: 'hidden', background: C.surface, borderRight: sidebarOpen ? `1px solid ${C.border}` : 'none', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${C.border}`, flexShrink: 0 }}>
            <img src={LOGO_PATH} alt="DEFTXR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '14px', color: C.white }}>DEFTXR</div>
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.08em' }}>ANATOMY TUTOR</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif', marginBottom: '4px' }}>QUICK ACTIONS</div>
          <button onClick={() => { if (hasConversation) { setSidebarOpen(false); setShowSummary(true); } }} disabled={!hasConversation}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: hasConversation ? `${C.summarize}18` : 'transparent', border: `1px solid ${hasConversation ? C.summarize + '55' : C.border}`, borderRadius: '10px', color: hasConversation ? C.summarizeGlow : C.textMuted, cursor: hasConversation ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
            onMouseEnter={e => { if (hasConversation) { e.currentTarget.style.background = `${C.summarize}30`; e.currentTarget.style.borderColor = C.summarizeGlow; } }}
            onMouseLeave={e => { if (hasConversation) { e.currentTarget.style.background = `${C.summarize}18`; e.currentTarget.style.borderColor = C.summarize + '55'; } }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Summarise Chat</span>
          </button>
          <button onClick={clearHistory}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
            onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHov; e.currentTarget.style.color = C.textPrim; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSec; }}>
            <span>Clear History</span>
          </button>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '16px', marginTop: '8px' }}>
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif', marginBottom: '10px' }}>THINKING MODE</div>
            <YouTubeToggle value={ytSearchMode} onChange={setYtSearchMode} sidebar />
            <ThinkingToggle value={thinkingMode} onChange={setThinkingMode} sidebar />
          </div>
        </div>
        <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={onLogout}
            style={{ width: '100%', padding: '10px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.error; e.currentTarget.style.color = C.error; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSec; }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '60px', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setSidebarOpen(o => !o)}
              style={{ width: '36px', height: '36px', borderRadius: '8px', background: sidebarOpen ? C.surfaceHov : 'transparent', border: `1px solid ${sidebarOpen ? C.borderLit : 'transparent'}`, cursor: 'pointer', color: C.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${C.border}`, flexShrink: 0 }}>
                <img src={LOGO_PATH} alt="DEFTXR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '15px', color: C.white }}>DEFTXR</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.textMuted, marginLeft: '6px', letterSpacing: '0.1em' }}>ANATOMY TUTOR</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {hasConversation && (
              <button onClick={() => setShowSummary(true)} title="Summarise this chat session"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: `${C.summarize}18`, border: `1px solid ${C.summarize}55`, borderRadius: '8px', color: C.summarizeGlow, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '11px', letterSpacing: '0.07em', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = `${C.summarize}30`; e.currentTarget.style.borderColor = C.summarizeGlow; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${C.summarize}18`; e.currentTarget.style.borderColor = C.summarize + '55'; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                SUMMARISE
              </button>
            )}
            <YouTubeToggle value={ytSearchMode} onChange={setYtSearchMode} />
            <ThinkingToggle value={thinkingMode} onChange={setThinkingMode} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: serverOnline ? C.success : C.error, display: 'block', animation: serverOnline ? 'pulse 2s ease infinite' : 'none' }} />
              <span style={{ fontSize: '12px', color: C.textSec, fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}>{serverOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px', background: C.bg }}>
          {messages.map((msg, i) => (
            msg.role === 'clarify'
              ? <ClarifyCard key={msg.id ?? i} msg={msg} onSubmit={sendRefined} />
              : <MessageBubble key={msg.id ?? i} msg={msg} isNew={i === messages.length - 1 && !isLoading} onDelete={deleteMessage} />
          ))}
          <YouTubeStatusBubble status={ytStatus} />
          {isLoading && !streaming && !streamingThinking && !ytStatus && <TypingIndicator isThinking={thinkingMode} />}
          {isLoading && !streaming && streamingThinking && <StreamingBubble text="" thinkingText={streamingThinking} isThinking={thinkingMode} />}
          {streaming && <StreamingBubble text={streaming} thinkingText={streamingThinking} isThinking={thinkingMode} />}
          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div style={{ padding: '16px 20px', background: C.surface, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', background: C.bg, border: `1px solid ${ytSearchMode ? '#ef444477' : thinkingMode ? C.thinking + '77' : C.border}`, borderRadius: '14px', padding: '10px 10px 10px 16px', transition: 'border-color 0.2s' }}>
            <textarea ref={textareaRef} value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={thinkingMode ? 'Ask a complex anatomy question…' : 'Ask about anatomy…'}
              disabled={isLoading} rows={1}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.textPrim, fontSize: '14.5px', lineHeight: '1.5', resize: 'none', fontFamily: 'DM Sans, sans-serif', padding: '2px 0', maxHeight: '140px', overflowY: 'auto' }} />
            <button onClick={send} disabled={isLoading || !input.trim()}
              style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0, background: (isLoading || !input.trim()) ? C.surfaceHov : `linear-gradient(135deg, ${C.accent}, ${C.accentGlow})`, border: 'none', cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              {isLoading
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              }
            </button>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: C.textMuted, fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}>
              DEFTXR AI · Anatomy Tutor · Enter to send, Shift+Enter for new line
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ROOT APP ────────────────────────────────────────────────── */
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

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

        /* ── Blockquote — used for clinical pearls ── */
        .md-blockquote { border-left: 3px solid ${C.accentGlow}; margin: 12px 0; padding: 8px 14px; background: ${C.accent}0f; border-radius: 0 8px 8px 0; color: ${C.textPrim}; font-style: normal; font-size: 14px; line-height: 1.7; }
        .md-blockquote .md-p { margin: 0; font-size: 14px; }

        /* ── Table — fallback only, model is instructed not to generate tables ── */
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
    ? <ChatPage onLogout={() => setLoggedIn(false)} />
    : <LoginPage onLogin={() => setLoggedIn(true)} />;
}