import { useRef, useState, useCallback } from 'react';

const STT_PARAMS = {
  language_code: 'auto',
  model: 'saaras:v3-realtime',
  stream_type: 'balanced',
  endpointing: 'vad',
  encoding: 'linear16',
  sample_rate: '16000',
};

export default function useSarvamSTT() {
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [finalText, setFinalText] = useState('');

  const wsRef = useRef(null);
  const ctxRef = useRef(null);
  const workletRef = useRef(null);
  const streamRef = useRef(null);
  const chunkCountRef = useRef(0);

  const cleanup = useCallback(() => {
    console.log('[STT] cleanup() called');
    workletRef.current?.disconnect();
    ctxRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        console.log('[STT] → sending {event:"end"}');
        wsRef.current.send(JSON.stringify({ event: 'end' }));
      }
      wsRef.current.close();
    }
    wsRef.current = ctxRef.current = workletRef.current = streamRef.current = null;
    chunkCountRef.current = 0;
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    console.log('[STT] ▶ startRecording() called');
    if (wsRef.current) { console.log('[STT] already recording, abort'); return; }

    try {
      console.log('[STT] step 1: getUserMedia…');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('[STT] ✅ mic granted, tracks:', stream.getAudioTracks().map(t => t.label));

      console.log('[STT] step 2: AudioContext(16000)…');
      const ctx = new AudioContext({ sampleRate: 16000 });
      ctxRef.current = ctx;
      console.log('[STT] ✅ ctx.sampleRate =', ctx.sampleRate, 'state =', ctx.state);

      console.log('[STT] step 3: audioWorklet.addModule…');
      await ctx.audioWorklet.addModule('/pcm-processor.js');
      const worklet = new AudioWorkletNode(ctx, 'pcm-processor');
      workletRef.current = worklet;
      console.log('[STT] ✅ AudioWorklet ready');

      const src = ctx.createMediaStreamSource(stream);
      src.connect(worklet);
      worklet.connect(ctx.destination);
      console.log('[STT] ✅ graph connected: mic → worklet → destination');

      console.log('[STT] step 4: opening WebSocket…');
      const qs = new URLSearchParams(STT_PARAMS).toString();
      const wsUrl = `ws://localhost:8000/ws/stt?${qs}`;
      console.log('[STT] ws url:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onerror = (e) => {
        console.error('[STT] ❌ WebSocket error event:', e);
        cleanup();
      };
      ws.onclose = (e) => {
        console.log('[STT] ⛔ WebSocket closed — code:', e.code, 'reason:', e.reason, 'clean:', e.wasClean);
        if (wsRef.current) cleanup();
      };

      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch {
          console.log('[STT] ← non-JSON frame:', String(ev.data).slice(0, 120));
          return;
        }
        console.log('[STT] ←', msg.event, msg.text ?? msg.message ?? '');
        if (msg.event === 'session.begin') {
          console.log('[STT] ✅ Sarvam session started, config:', msg.config);
        } else if (msg.event === 'vad.speech_start') {
          console.log('[STT] 🎙 speech detected');
        } else if (msg.event === 'vad.speech_end') {
          console.log('[STT] 🔇 speech ended');
        } else if (msg.event === 'transcript.partial') {
          setLiveText(msg.text || '');
        } else if (msg.event === 'transcript.final') {
          console.log('[STT] ✅ FINAL:', msg.text);
          setFinalText(msg.text || '');
          setLiveText('');
          cleanup();
        } else if (msg.event === 'error') {
          console.error('[STT] ❌ Sarvam error:', msg);
          cleanup();
        }
      };

      ws.onopen = () => {
        console.log('[STT] ✅ WebSocket OPEN — piping PCM chunks');
        worklet.port.onmessage = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const i16 = e.data;
          const bytes = new Uint8Array(i16.buffer);
          let bin = '';
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          ws.send(JSON.stringify({ event: 'audio_input', audio: btoa(bin) }));
          chunkCountRef.current++;
          if (chunkCountRef.current % 10 === 0)
            console.log(`[STT] → sent ${chunkCountRef.current} audio chunks (last ${bytes.length} bytes)`);
        };
      };

      setIsRecording(true);
      console.log('[STT] ✅ isRecording = true');
    } catch (err) {
      console.error('[STT] ❌ startRecording failed:', err);
    }
  }, [cleanup]);

  const stopRecording = useCallback(() => {
    console.log('[STT] ⏹ stopRecording() called');
    cleanup();
  }, [cleanup]);

  const reset = useCallback(() => {
    console.log('[STT] reset()');
    setLiveText('');
    setFinalText('');
  }, []);

  return { isRecording, liveText, finalText, startRecording, stopRecording, reset };
}
