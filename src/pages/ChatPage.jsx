import { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { C, LOGO_PATH, loadHistory, saveHistory, loadPrefs, savePrefs } from '../shared';
import MessageActions from '../utils/MessageActions';

/* ─── MARKDOWN COMPONENTS (react-markdown + remark-gfm) ─────── */
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

function sanitizeMd(text) {
  if (!text) return '';
  let t = text;
  t = t.replace(/([^\n])(#{1,6} )/g, '$1\n\n$2');
  t = t.replace(/(#{1,6} [^\n]+)(\n)(?!\n)/g, '$1\n\n');
  t = t.replace(/([^\n])(\d+\. )/g, '$1\n$2');
  t = t.replace(/([^\n])(- )/g, '$1\n$2');
  t = t.replace(/([^\n])(> )/g, '$1\n\n$2');
  t = t.replace(/([^\n])(\*{2}[A-Z])/g, '$1\n\n$2');
  t = t.replace(/^(\*{2})([^*\n]+:)\s*$/gm, '$1$2$1');
  t = t.replace(/([^*])(\*{1,2})\s*$/gm, '$1');
  t = t.replace(/^\s*(\*{1,2}|_{1,2})\s*$/gm, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t;
}

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
function MessageBubble({ msg, isNew, onEdit, onRetry, fetchTTS }) {
  const isUser     = msg.role === 'user';
  const isThinking = msg.thinking;
  const [hovered,    setHovered]    = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [editText,   setEditText]   = useState('');
  const [bubbleSize, setBubbleSize] = useState({ width: 0, height: 0 });
  const bubbleRef   = useRef(null);
  const textareaRef = useRef(null);
  const leaveTimer  = useRef(null);
  // phase: 'idle' | 'loading' | 'playing' | 'paused' | 'ready'
  // 'ready' = audio finished but cached, ready to replay without API call
  const [audioState, setAudioState] = useState({ phase: 'idle' });
  const audioRef  = useRef(null);  // Audio object
  const cachedUrl = useRef(null);  // blob URL — never revoked, persists for replay

  async function handleLocalAudio() {
    if (audioState.phase === 'loading') return;

    if (audioState.phase === 'playing') {
      audioRef.current?.pause();
      setAudioState({ phase: 'paused' });
      return;
    }

    if (audioState.phase === 'paused') {
      audioRef.current?.play();
      setAudioState({ phase: 'playing' });
      return;
    }

    // 'ready' or 'idle' with cached url — replay without API call
    if (cachedUrl.current) {
      const audio = new Audio(cachedUrl.current);
      audioRef.current = audio;
      audio.onended = () => setAudioState({ phase: 'ready' });
      audio.onerror = () => setAudioState({ phase: 'ready' });
      setAudioState({ phase: 'playing' });
      audio.play();
      return;
    }

    // first time — fetch
    setAudioState({ phase: 'loading' });
    try {
      const url = await fetchTTS(msg.content);
      cachedUrl.current = url;           // cache forever, never revoke
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setAudioState({ phase: 'ready' });
      audio.onerror = () => setAudioState({ phase: 'ready' });
      setAudioState({ phase: 'playing' });
      audio.play();
    } catch (e) {
      console.error('TTS error:', e);
      setAudioState({ phase: 'idle' });
    }
  }

  function handleMouseEnter() { clearTimeout(leaveTimer.current); setHovered(true); }
  function handleMouseLeave() { leaveTimer.current = setTimeout(() => setHovered(false), 150); }

  function startEdit() {
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      setBubbleSize({ width: rect.width, height: rect.height });
    }
    setEditText(msg.content);
    setEditing(true);
    setHovered(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }, 20);
  }

  function submitEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== msg.content) onRetry?.(trimmed);
    setEditing(false);
  }

  function handleEditKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); }
    if (e.key === 'Escape') setEditing(false);
  }

  const sharedBubbleStyle = {
    maxWidth: isUser ? 'min(600px, 78%)' : 'min(820px, 92%)',
    padding: '12px 16px',
    borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
    background: isUser ? `linear-gradient(135deg, ${C.userBubble}, #1e40af)` : isThinking ? `linear-gradient(135deg, ${C.thinkingDim}, #1a1035)` : C.aiBubble,
    color: C.textPrim, lineHeight: '1.65', fontSize: '14.5px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', animation: isNew ? 'fadeUp 0.3s ease forwards' : 'none', gap: '4px', position: 'relative' }}>
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

      <div
        style={{ display: 'inline-flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: '4px', position: 'relative' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Normal bubble — hidden (not unmounted) while editing so we can always measure it */}
        <div
          ref={bubbleRef}
          style={{
            ...sharedBubbleStyle,
            border: `1px solid ${isUser ? '#2563eb66' : isThinking ? C.thinking + '55' : C.border}`,
            boxShadow: isUser ? `0 4px 16px ${C.accent}22` : `0 4px 12px rgba(0,0,0,0.3)`,
            display: editing ? 'none' : undefined,
          }}
        >
          {msg.image && (
            <div style={{ marginBottom: '10px' }}>
              <img src={msg.image} alt="uploaded" style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '10px', border: `1px solid ${C.border}`, display: 'block' }} />
            </div>
          )}
          <div style={{ textAlign: 'left' }}>
            <MD>{msg.content}</MD>
          </div>
        </div>

        {/* Edit textarea — locked to the bubble's exact pixel size */}
        {editing && (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={handleEditKey}
            style={{
              ...sharedBubbleStyle,
              width: bubbleSize.width || undefined,
              minWidth: bubbleSize.width || undefined,
              minHeight: bubbleSize.height || undefined,
              border: `1px solid ${C.accentGlow}`,
              boxShadow: `0 0 0 2px ${C.accentGlow}33`,
              opacity: 0.85,
              outline: 'none',
              resize: 'none',
              fontFamily: 'DM Sans, sans-serif',
              cursor: 'text',
              boxSizing: 'border-box',
              display: 'block',
              overflow: 'hidden',
            }}
          />
        )}

        {!editing && (hovered || audioState.phase === 'playing' || audioState.phase === 'loading') && (
          <div style={{ position: 'absolute', bottom: '-32px', [isUser ? 'right' : 'left']: '0', zIndex: 10 }}>
            <MessageActions
              isUser={isUser}
              msgId={msg.id}
              content={msg.content}
              onEdit={startEdit}
              onRetry={onRetry}
              audioPhase={audioState.phase}
              onAudio={handleLocalAudio}
            />
          </div>
        )}
      </div>

      {!isUser && msg.sources && <SourcesPanel sources={msg.sources} />}
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

/* ─── MAIN CHAT ───────────────────────────────────────────────── */
export default function ChatPage({ onLogout, onNavigate }) {
  const prefs = loadPrefs();
  const [messages, setMessages]         = useState(() => {
    const h = loadHistory();
    return h.length ? h : [{ role: 'assistant', content: 'Hello! I am your **DEFTXR Anatomy Tutor**. Ask me anything about anatomy.\n\nI\'m ready to help you learn.', time: now(), id: 0 }];
  });
  const [input, setInput]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [streaming, setStreaming]       = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [thinkingMode, setThinkingMode] = useState(prefs.thinkingMode ?? false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [showSummary, setShowSummary]   = useState(false);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const nextId      = useRef(messages.length);

  async function fetchTTS(content) {
    const res = await fetch('http://localhost:8000/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

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
        response = await fetch('http://localhost:8000/ask', {
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
          if (payload.startsWith('[ERROR]')) { acc += `\n\n ${payload.slice(7)}`; setStreaming(acc); continue; }
          try { acc += JSON.parse(payload); } catch { acc += payload; }
          setStreaming(acc);
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: acc, sources, thinking: thinkingMode, thinkingContent: thinkingAcc || null, time: now(), id: ++nextId.current }]);
      setStreaming('');
      setStreamingThinking('');
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
    setIsLoading(true); setStreaming(''); setStreamingThinking('');
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
  const editMessage = useCallback((content) => {
    setInput(content);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const retryMessage = useCallback(async (content) => {
    if (isLoading) return;
    setInput('');
    setIsLoading(true); setStreaming(''); setStreamingThinking('');
    setMessages(prev => [...prev, { role: 'user', content, time: now(), id: ++nextId.current }]);
    try {
      let response;
      try {
        response = await fetch('http://localhost:8000/ask', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: content, thinking: thinkingMode, history: messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-10).map(m => ({ role: m.role, content: m.content })) }),
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
          if (!payload || payload === '[DONE]') continue;
          if (payload.startsWith('[SOURCES]')) { try { sources = JSON.parse(payload.slice(9).trim()); } catch {} continue; }
          if (payload.startsWith('[THINKING]')) { thinkingAcc += payload.slice(10); setStreamingThinking(thinkingAcc); continue; }
          try { acc += JSON.parse(payload); } catch { acc += payload; }
          setStreaming(acc);
        }
      }
      setMessages(prev => [...prev, { role: 'assistant', content: acc, sources, thinking: thinkingMode, thinkingContent: thinkingAcc || null, time: now(), id: ++nextId.current }]);
      setStreaming(''); setStreamingThinking('');
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err?.message === 'CONNECTION_REFUSED'
          ? ' **Cannot reach the backend.**\n\nMake sure the server is running:\n```\nuvicorn server:app --reload --port 8000\n```'
          : ` **Request failed:** ${err?.message ?? 'Unknown error'}`,
        time: now(), id: ++nextId.current,
      }]);
      setStreaming(''); setStreamingThinking('');
    } finally { setIsLoading(false); }
  }, [isLoading, thinkingMode, messages]);

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
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif', marginBottom: '10px' }}>PAGES</div>
            <button onClick={() => { setSidebarOpen(false); onNavigate && onNavigate('cadavier'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s', textAlign: 'left', width: '100%', marginBottom: '8px' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHov; e.currentTarget.style.color = C.textPrim; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSec; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
              <span>Cadavier</span>
            </button>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '16px', marginTop: '0' }}>
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif', marginBottom: '10px' }}>THINKING MODE</div>
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
              : <MessageBubble key={msg.id ?? i} msg={msg} isNew={i === messages.length - 1 && !isLoading} onEdit={editMessage} onRetry={retryMessage} fetchTTS={fetchTTS} />
          ))}
          {isLoading && !streaming && !streamingThinking && <TypingIndicator isThinking={thinkingMode} />}          {isLoading && !streaming && streamingThinking && <StreamingBubble text="" thinkingText={streamingThinking} isThinking={thinkingMode} />}
          {streaming && <StreamingBubble text={streaming} thinkingText={streamingThinking} isThinking={thinkingMode} />}
          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div style={{ padding: '16px 20px', background: C.surface, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', background: C.bg, border: `1px solid ${thinkingMode ? C.thinking + '77' : C.border}`, borderRadius: '14px', padding: '10px 10px 10px 16px', transition: 'border-color 0.2s' }}>
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