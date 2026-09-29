/**
 * pcm-processor.js — AudioWorklet processor
 * Runs on the audio thread (not main thread), zero UI jank.
 * Reads Float32 mic samples, converts to 16-bit PCM, posts to main thread.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Int16Array(4096);
    this._pos = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const floats = input[0]; // mono channel

    for (let i = 0; i < floats.length; i++) {
      // Float32 [-1,1] → Int16 [-32768,32767]
      const s = Math.max(-1, Math.min(1, floats[i]));
      this._buffer[this._pos++] = s < 0 ? s * 0x8000 : s * 0x7FFF;

      // Flush in 4096-sample chunks (~256ms at 16kHz)
      if (this._pos >= this._buffer.length) {
        this.port.postMessage(this._buffer.subarray(0, this._pos));
        this._pos = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
