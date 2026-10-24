// All sources use AudioContext time. Timers only keep the scheduling window full.
export class PerformanceTransport {
  constructor(engine, { onFrame = () => {}, onEnd = () => {} } = {}) {
    this.engine = engine; this.onFrame = onFrame; this.onEnd = onEnd;
    this.notes = []; this.duration = 0; this.offset = 0; this.rate = 1; this.playing = false; this.voices = new Set();
  }
  load(notes, duration, original = null) {
    this.stop(); this.notes = notes; this.duration = duration; this.original = original;
  }
  position() { return this.playing ? Math.min(this.duration, this.offset + Math.max(0, this.engine.context.currentTime - this.anchor) * this.rate) : this.offset; }
  start(mode = 'piano') {
    if (!this.duration || this.playing) return;
    if (this.offset >= this.duration) this.offset = 0;
    this.mode = mode; this.anchor = this.engine.context.currentTime + .035; this.playing = true;
    this.cursor = this.notes.findIndex(n => n.time >= this.offset - .0001);
    if (this.cursor < 0) this.cursor = this.notes.length;
    if (mode === 'original' && this.original && this.offset < this.original.duration) {
      this.originalVoice = this.engine.playOriginal(this.original, this.anchor, this.offset, this.rate);
    } else if (mode !== 'original') {
      // Resume sustained notes at their elapsed sample position; do not retrigger attacks.
      for (const n of this.notes) if (n.time < this.offset - .0001 && n.time + n.duration > this.offset) this.schedule(n, this.anchor, this.offset - n.time);
    }
    this.tick(); if (this.playing) this.timer = setInterval(() => this.tick(), 20);
  }
  schedule(note, when, elapsed = 0) {
    const voice = this.engine.note(note.midi, { when, duration: (note.duration - elapsed) / this.rate, velocity: note.velocity, elapsed, speed: this.rate });
    this.voices.add(voice); voice.onended = () => this.voices.delete(voice);
  }
  tick() {
    if (!this.playing) return;
    const time = this.position(), horizon = time + .15 * this.rate;
    if (this.mode !== 'original') while (this.cursor < this.notes.length && this.notes[this.cursor].time <= horizon) {
      const note = this.notes[this.cursor++];
      const when = this.anchor + (note.time - this.offset) / this.rate;
      const late = Math.max(0, this.engine.context.currentTime - when);
      if (late * this.rate < note.duration) this.schedule(note, Math.max(when, this.engine.context.currentTime), late * this.rate);
    }
    this.onFrame(time);
    if (time >= this.duration) { this.pause(); this.offset = this.duration; this.onEnd(); }
  }
  pause() {
    this.offset = this.position(); this.playing = false; clearInterval(this.timer);
    for (const voice of this.voices) voice.stop(); this.voices.clear();
    this.originalVoice?.stop(); this.originalVoice = null;
  }
  stop() { this.pause(); this.offset = 0; }
  seek(time) { const running = this.playing, mode = this.mode; this.pause(); this.offset = Math.max(0, Math.min(this.duration, time)); if (running) this.start(mode); else this.onFrame(this.offset); }
  setRate(rate) { const running = this.playing, mode = this.mode; this.pause(); this.rate = rate; if (running) this.start(mode); }
}
