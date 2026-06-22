/**
 * MessageActions.jsx
 * Props:
 *   isUser      {bool}
 *   msgId       {number}   used to persist like/dislike in localStorage
 *   content     {string}
 *   onEdit      {fn}
 *   onRetry     {fn}
 *   onAudio     {fn}
 *   playing     {bool}     controlled by parent (global audio state)
 */

import { useState } from 'react';
import { C } from '../shared';

const LIKES_KEY = 'deftxr_likes';

function getLikes() {
  try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); } catch { return {}; }
}
function setLikes(obj) {
  localStorage.setItem(LIKES_KEY, JSON.stringify(obj));
}

/* ── tiny icon button ─────────────────────────────────────────── */
function ActionBtn({ title, onClick, children, danger, active, activeColor }) {
  const [hov, setHov] = useState(false);
  const col = danger
    ? (hov ? '#ef4444' : C.textMuted)
    : active
    ? (activeColor || C.accentGlow)
    : (hov ? C.textPrim : C.textMuted);

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '5px', padding: '4px 8px',
        background: active ? `${activeColor || C.accentGlow}18` : hov ? C.surfaceHov : 'transparent',
        border: `1px solid ${active ? (activeColor || C.accentGlow) + '66' : hov ? C.borderLit : 'transparent'}`,
        borderRadius: '7px', cursor: 'pointer', color: col,
        fontSize: '11px', fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.04em', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function IconCopy({ done }) {
  return done
    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}
function IconEdit() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconRetry() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>;
}
function IconAudio({ phase }) {
  if (phase === 'loading')
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>;
  if (phase === 'playing')
    // pause icon
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
  if (phase === 'paused' || phase === 'ready')
    // play triangle
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
  // idle — speaker icon
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>;
}
function IconLike() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>;
}
function IconDislike() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>;
}

/* ── main export ──────────────────────────────────────────────── */
export default function MessageActions({ isUser, msgId, content, onEdit, onRetry, onAudio, audioPhase = 'idle' }) {
  const [copied, setCopied] = useState(false);
  const [tick,   setTick]   = useState(0); // forces re-read of localStorage

  // like/dislike from localStorage
  const likes    = getLikes();
  const liked    = likes[msgId] === 'like';
  const disliked = likes[msgId] === 'dislike';

  function handleCopy() {
    navigator.clipboard.writeText(content || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleLike() {
    const l = getLikes();
    if (l[msgId] === 'like') delete l[msgId]; else l[msgId] = 'like';
    setLikes(l);
    setTick(t => t + 1);
  }

  function handleDislike() {
    const l = getLikes();
    if (l[msgId] === 'dislike') delete l[msgId]; else l[msgId] = 'dislike';
    setLikes(l);
    setTick(t => t + 1);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px',
      padding: '3px 4px', background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: '10px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
      animation: 'fadeUp 0.15s ease forwards',
    }}>
      <ActionBtn title={copied ? 'Copied!' : 'Copy'} onClick={handleCopy} active={copied} activeColor='#22c55e'>
        <IconCopy done={copied} />
      </ActionBtn>

      {isUser ? (
        <>
          <ActionBtn title="Edit message" onClick={() => onEdit?.(content)}>
            <IconEdit />
          </ActionBtn>
          <ActionBtn title="Re-send this message" onClick={() => onRetry?.(content)}>
            <IconRetry />
          </ActionBtn>
        </>
      ) : (
        <>
          <ActionBtn title={audioPhase === 'playing' ? 'Pause' : (audioPhase === 'paused' || audioPhase === 'ready') ? 'Resume' : 'Read aloud'} onClick={() => onAudio?.()} active={audioPhase === 'playing' || audioPhase === 'paused' || audioPhase === 'ready'} activeColor={C.accentGlow}>
            <IconAudio phase={audioPhase} />
          </ActionBtn>
          <ActionBtn title="Good response" onClick={handleLike} active={liked} activeColor="#22c55e">
            <IconLike />
          </ActionBtn>
          <ActionBtn title="Bad response" onClick={handleDislike} active={disliked} activeColor="#ef4444" danger={!disliked}>
            <IconDislike />
          </ActionBtn>
        </>
      )}
    </div>
  );
}