import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNotes, cleanAudioNotes, groupNotes, makePracticeBars, segmentBar } from '../src/performance.js';
import { PerformanceTransport } from '../src/transport.js';
const note=(midi,time,duration=1,extra={})=>({midi,time,duration,velocity:.7,...extra});
function setup(notes,duration=5){
 const calls=[],voices=[],engine={context:{currentTime:10},note(midi,options){calls.push({midi,...options});const v={stopped:false,stop(){this.stopped=true;}};voices.push(v);return v;},playOriginal(...args){calls.push({original:args});return {stop(){}};}};
 let ended=0;const transport=new PerformanceTransport(engine,{onEnd(){ended++;}});transport.load(normalizeNotes(notes),duration);
 return {engine,transport,calls,voices,get ended(){return ended;}};
}
test('20ms attacks, unequal chord lengths and velocities keep their independent timing',()=>{
 const t=setup([note(60,0,.4),note(64,0,1.2,{velocity:.3}),note(67,.02,.6)]);t.transport.start();t.transport.pause();
 assert.equal(t.calls.length,3);assert.ok(Math.abs(t.calls[2].when-t.calls[0].when-.02)<1e-8);assert.deepEqual(t.calls.map(n=>n.duration),[.4,1.2,.6]);assert.equal(t.calls[1].velocity,.3);
});
test('leading silence stays silent until the lookahead reaches the first note',()=>{
 const t=setup([note(60,1)]);t.transport.start();assert.equal(t.calls.length,0);t.engine.context.currentTime=10.9;t.transport.tick();assert.equal(t.calls.length,1);assert.ok(Math.abs(t.calls[0].when-11.035)<1e-8);t.transport.pause();
});
test('pause cancels both sounding and future scheduled voices; resume retains elapsed sustain',()=>{
 const t=setup([note(60,0,2),note(64,.1)]);t.transport.start();t.engine.context.currentTime=10.535;t.transport.pause();assert.ok(t.voices.every(v=>v.stopped));assert.equal(t.transport.position(),.5);
 t.transport.start();const resumed=t.calls.slice(2);assert.equal(resumed.length,2);assert.equal(resumed[0].elapsed,.5);assert.equal(resumed[0].duration,1.5);t.transport.pause();
});
test('seek, speed and final release tail share the same clock',()=>{
 const t=setup([note(60,0,1),note(64,1,1)],2.2);t.transport.seek(.5);t.transport.setRate(.5);t.transport.start();assert.equal(t.calls[0].duration,1);assert.equal(t.calls[0].elapsed,.5);
 t.engine.context.currentTime=13.4;t.transport.tick();assert.equal(t.transport.playing,true);t.engine.context.currentTime=13.5;t.transport.tick();assert.equal(t.transport.playing,false);assert.equal(t.ended,1);assert.equal(t.transport.offset,2.2);
});
test('original audio does not play piano notes or restart beyond source end',()=>{
 const t=setup([note(60,0)],2.2);t.transport.original={duration:2};t.transport.start('original');assert.equal(t.calls.length,1);assert.ok(t.calls[0].original);t.transport.pause();t.calls.length=0;t.transport.seek(2.1);t.transport.start('original');assert.equal(t.calls.length,0);t.transport.pause();
});
test('notation and simplified practice never change performance time, duration or voices',()=>{
 const raw=normalizeNotes([note(60,.3,.4),note(64,.305,1),note(67,.36,.2),note(72,3,.4)]),before=JSON.stringify(raw),events=groupNotes(raw);
 assert.equal(events.length,3);assert.equal(events[0].voices[1].time,.305);const bars=makePracticeBars(events,{bpm:120,meter:[3,4],firstBeat:.3,melody:true});assert.deepEqual(bars[0][0].notes,[64]);assert.equal(JSON.stringify(raw),before);assert.equal(bars[1][0].time,3);
});
test('cleaning removes weak fragments and preserves deliberate repeated attacks',()=>{
 const raw=[note(60,0,.3),note(60,.31,.3,{attackStrength:.1}),note(60,.62,.3,{attackStrength:.9}),note(70,.2,.04),note(71,.3,.08,{strength:.2})];const copy=JSON.stringify(raw),clean=cleanAudioNotes(raw);assert.equal(clean.length,2);assert.ok(Math.abs(clean[0].duration-.61)<1e-8);assert.equal(clean[1].time,.62);assert.equal(JSON.stringify(raw),copy);
});
test('dense eight-note chords are split into readable three-event segments',()=>{
 const events=Array.from({length:13},(_,i)=>({time:i*.1,notes:[48,52,55,60,64,67,72,76]}));const parts=segmentBar(events);assert.equal(parts.length,5);assert.ok(parts.every(p=>p.end-p.start<=3));assert.equal(parts.at(-1).end,13);
});

test('resume and immediate pause preserve the seek position before the audio anchor',()=>{
 const t=setup([note(60,0,2)]);t.transport.seek(1);t.transport.start();
 assert.equal(t.transport.position(),1);t.engine.context.currentTime=10.02;assert.equal(t.transport.position(),1);
 t.transport.pause();assert.equal(t.transport.offset,1);
 t.transport.start();t.engine.context.currentTime=10.155;assert.ok(Math.abs(t.transport.position()-1.1)<1e-8);t.transport.pause();
});
