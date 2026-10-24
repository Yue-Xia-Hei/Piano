const SAMPLE_MIDIS = [21, ...Array.from({ length: 28 }, (_, i) => 24 + i * 3), 108];
const sampleName = midi => ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'][midi % 12] + (Math.floor(midi / 12) - 1);
export class PianoAudio {
  constructor() { this.buffers = new Map(); this.pending = new Map(); this.volume = .55; this.tone = 'grand'; }
  async ready() {
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.volume;
      const compressor = this.context.createDynamicsCompressor(); compressor.threshold.value = -12; compressor.ratio.value = 4;
      this.master.connect(compressor).connect(this.context.destination);
      this.originalGain = this.context.createGain(); this.originalGain.gain.value = this.volume; this.originalGain.connect(this.context.destination);
    }
    await this.context.resume();
  }
  root(midi) { return SAMPLE_MIDIS.reduce((a, b) => Math.abs(a - midi) <= Math.abs(b - midi) ? a : b); }
  async prepare(notes) {
    await this.ready();
    await Promise.all([...new Set(notes.map(n => this.root(typeof n === 'number' ? n : n.midi)))].map(root => {
      if (this.buffers.has(root)) return;
      if (!this.pending.has(root)) this.pending.set(root, (async () => {
        const response = await fetch(`${import.meta.env.BASE_URL}audio/salamander/${sampleName(root)}.mp3`);
        if (!response.ok) throw new Error(`钢琴采样加载失败：${sampleName(root)}`);
        this.buffers.set(root, await this.context.decodeAudioData(await response.arrayBuffer()));
      })().finally(() => this.pending.delete(root)));
      return this.pending.get(root);
    }));
  }
  note(midi, { when = this.context.currentTime, duration = null, velocity = .7, elapsed = 0, speed = 1 } = {}) {
    const root = this.root(midi), buffer = this.buffers.get(root);
    if (!buffer) throw new Error('钢琴采样尚未加载');
    const source = this.context.createBufferSource(), gain = this.context.createGain(), filter = this.context.createBiquadFilter();
    const pitchRate = 2 ** ((midi - root) / 12);
    source.buffer = buffer; source.playbackRate.value = pitchRate;
    filter.type = 'lowpass'; filter.frequency.value = (this.tone === 'soft' ? 1800 : 3800) + velocity * 10000;
    const level = .8 * Math.pow(velocity, 1.5);
    gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(level, when + .006);
    source.connect(filter).connect(gain).connect(this.master);
    const offset = Math.min(Math.max(0, elapsed * pitchRate), Math.max(0, buffer.duration - .02));
    source.start(when, offset);
    let stopped = false;
    const releaseAt = at => { if (stopped) return; const start = Math.max(this.context.currentTime, at); gain.gain.cancelAndHoldAtTime(start); gain.gain.linearRampToValueAtTime(0, start + .075); }; const voice = { onended: null, endTime: 0, stop: () => { if (stopped) return; stopped = true; try { source.stop(); } catch {} }, releaseAt, release: () => {
      if (stopped) return;
      const at = this.context.currentTime; releaseAt(at);
      try { source.stop(at + .09); } catch {}
    } };
    if (duration !== null) {
      const end = when + Math.max(.012, duration);
      gain.gain.setValueAtTime(level, Math.max(when + .006, end)); gain.gain.linearRampToValueAtTime(0, end + .18 / speed);
      source.stop(end + .19 / speed);
    }
    source.onended = () => { stopped = true; source.disconnect(); gain.disconnect(); filter.disconnect(); voice.onended?.(); };
    return voice;
  }
  playOriginal(buffer, when, offset, rate) {
    const source = this.context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate;
    source.connect(this.originalGain); source.start(when, offset);
    let stopped = false;
    source.onended = () => { stopped = true; source.disconnect(); };
    return { stop() { if (!stopped) { stopped = true; try { source.stop(); } catch {} } } };
  }
  setVolume(value) { this.volume = value; if (this.master) { this.master.gain.setTargetAtTime(value, this.context.currentTime, .015); this.originalGain.gain.setTargetAtTime(value, this.context.currentTime, .015); } }
}
