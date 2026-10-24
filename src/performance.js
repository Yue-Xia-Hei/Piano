export function normalizeNotes(notes) {
  return notes.filter(n => Number.isInteger(n.midi) && n.midi >= 21 && n.midi <= 108 && Number.isFinite(n.time) && Number.isFinite(n.duration) && n.duration > 0)
    .map(n => ({ ...n, time: Math.max(0, n.time), velocity: Math.max(.05, Math.min(1, n.velocity ?? n.strength ?? .7)) }))
    .sort((a, b) => a.time - b.time || a.midi - b.midi);
}

// Strength is model activation, not a calibrated probability of correctness.
export function cleanAudioNotes(notes) {
  const result = [], lastByPitch = new Map();
  for (const note of normalizeNotes(notes)) {
    if (note.duration < .065 || (note.strength ?? 1) < .16 || (note.duration < .11 && (note.strength ?? 1) < .3)) continue;
    const previous = lastByPitch.get(note.midi);
    const gap = previous ? note.time - previous.time - previous.duration : Infinity;
    // Only repair fragments when onset evidence is weak. Preserve repeated strikes.
    if (previous && gap >= -.03 && gap <= .025 && note.attackStrength !== undefined && note.attackStrength < .2) {
      previous.duration = Math.max(previous.duration, note.time + note.duration - previous.time);
    } else { const copy = { ...note }; result.push(copy); lastByPitch.set(note.midi, copy); }
  }
  return result;
}

export function groupNotes(notes, tolerance = .012) {
  const events = [];
  for (const note of notes) {
    let event = events.at(-1);
    if (!event || note.time - event.time > tolerance || event.notes.includes(note.midi)) {
      event = { time: note.time, notes: [], voices: [], duration: 0 }; events.push(event);
    }
    event.notes.push(note.midi); event.voices.push(note);
    event.duration = Math.max(event.duration, note.time + note.duration - event.time);
  }
  return events;
}

export function estimateTempo(notes) {
  const events = groupNotes(notes, .03);
  if (events.length < 8) return { bpm: 100, reliable: false };
  const times = events.map(e => e.time), candidates = [];
  for (let bpm = 55; bpm <= 180; bpm++) {
    const beat = 60 / bpm;
    let score = 0, count = 0;
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap < .1 || gap > 2) continue;
      const units = gap / beat * 2;
      score += Math.exp(-Math.pow((units - Math.round(units)) / .13, 2)); count++;
    }
    if (count) candidates.push({ bpm, score: score / count });
  }
  candidates.sort((a, b) => b.score - a.score || Math.abs(a.bpm - 100) - Math.abs(b.bpm - 100));
  const best = candidates[0];
  return { bpm: best?.bpm ?? 100, reliable: (best?.score ?? 0) > .82, score: best?.score ?? 0 };
}

export function makePracticeBars(events, { bpm = 100, meter = [4, 4], firstBeat = 0, melody = false } = {}) {
  const quarter = 60 / bpm, measure = meter[0] * 4 / meter[1], bars = [];
  for (const event of events) {
    const measureAt = Math.max(0, Math.floor(((event.time - firstBeat) / quarter + .00001) / measure));
    while (bars.length <= measureAt) bars.push([]);
    const notes = melody ? [Math.max(...event.notes)] : [...event.notes];
    bars[measureAt].push({ ...event, notes, beats: Math.max(.25, Math.round(event.duration / quarter * 4) / 4) });
  }
  return bars.length ? bars : [[]];
}

export function segmentBar(events) {
  const segments = []; let start = 0;
  while (start < events.length) {
    let end = start, capacity = 6;
    while (end < events.length && end - start < capacity) {
      const count = (events[end].notes ?? [events[end][0]]).length;
      const nextCapacity = count > 6 ? 3 : count > 3 ? 4 : 6;
      if (end > start && end - start >= Math.min(capacity, nextCapacity)) break;
      capacity = Math.min(capacity, nextCapacity); end++;
    }
    segments.push({ start, end }); start = end;
  }
  return segments.length ? segments : [{ start: 0, end: 0 }];
}

export function eventAtTime(events, time) {
  let low = 0, high = events.length;
  while (low < high) { const mid = (low + high) >>> 1; if (events[mid].time <= time + .001) low = mid + 1; else high = mid; }
  return Math.max(0, low - 1);
}
