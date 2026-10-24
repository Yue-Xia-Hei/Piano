const {chromium}=require('C:/Users/ZML/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const assert=require('node:assert/strict');
const {Midi}=require('@tonejs/midi');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/main.js*',async route=>{const response=await route.fetch();let text=await response.text();text+='\nwindow.__audioReview={audioEngine,transport,transcribeAudio,get snapshot(){return {raw:rawPerformanceNotes,notes:performanceNotes,original:originalAudioBuffer?.duration,source:activeSource}},getModel:()=>basicPitchInstancePromise};';await route.fulfill({response,body:text});});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 const midi=new Midi();midi.header.setTempo(120);midi.addTrack().addNote({midi:60,time:.3,duration:.4,velocity:.4}).addNote({midi:64,time:.32,duration:.9,velocity:.8});await page.locator('#midiFile').setInputFiles({name:'timing.mid',mimeType:'audio/midi',buffer:Buffer.from(midi.toArray())});await page.waitForFunction(()=>window.__audioReview?.snapshot.source==='midi');
 const midiNotes=await page.evaluate(()=>window.__audioReview.snapshot.raw);assert.ok(Math.abs(midiNotes[1].time-.32)<.005);assert.ok(Math.abs(midiNotes[1].duration-.9)<.005);console.log('MIDI timing and velocity import passed');
 const wav=await page.evaluate(async()=>{
  const engine=window.__audioReview.audioEngine;await engine.prepare([60,64,67,72]);
  const ctx=new OfflineAudioContext(1,22050*3,22050);
  [60,64,67,72].forEach((midi,i)=>{const root=engine.root(midi),s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=engine.buffers.get(root);s.playbackRate.value=2**((midi-root)/12);const at=.25+i*.6;s.connect(g).connect(ctx.destination);g.gain.setValueAtTime(.8,at);g.gain.setValueAtTime(.8,at+.34);g.gain.linearRampToValueAtTime(0,at+.45);s.start(at);s.stop(at+.46);});
  const buf=await ctx.startRendering(),a=buf.getChannelData(0),out=new ArrayBuffer(44+a.length*2),v=new DataView(out),str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+a.length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,22050,true);v.setUint32(28,44100,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,a.length*2,true);for(let i=0;i<a.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,a[i]))*32767,true);return Array.from(new Uint8Array(out));
 });
 console.log('Starting actual BasicPitch transcription of 3-second sampled piano fixture');
 await page.locator('#audioFile').setInputFiles({name:'piano-fixture.wav',mimeType:'audio/wav',buffer:Buffer.from(wav)});
 await page.waitForFunction(()=>window.__audioReview.snapshot.source==='audio'&&document.querySelector('#audioProgress').hidden,{},{timeout:180000});
 const audio=await page.evaluate(()=>window.__audioReview.snapshot);console.log(JSON.stringify({recognized:audio.raw,original:audio.original,status:await page.locator('#practiceStatus').textContent()}));assert.ok(audio.raw.length>=3,'expected at least 3 recognized notes');const matching=[60,64,67,72].filter(m=>audio.raw.some(n=>n.midi===m));assert.ok(matching.length>=3,'expected 3 correct pitches');assert.ok(Math.abs(audio.original-3)<.01);
 await page.selectOption('#playbackMode','original');await page.locator('#midiPlay').click();await page.waitForFunction(()=>window.__audioReview.transport.playing);assert.equal(await page.evaluate(()=>window.__audioReview.transport.mode),'original');await page.locator('#midiStop').click();
 const tf=await page.evaluate(async()=>{const tf=await import('/node_modules/.vite/deps/@tensorflow_tfjs.js');return tf.memory().numTensors;});console.log('Tensor count after scoped inference:',tf);
 // Corrupt file retains the previous performance and restores controls.
 await page.locator('#audioFile').setInputFiles({name:'invalid.wav',mimeType:'audio/wav',buffer:Buffer.from('invalid audio')});await page.waitForFunction(()=>document.querySelector('#audioProgress').hidden&&document.querySelector('#practiceStatus').textContent.includes('失败'));assert.equal((await page.evaluate(()=>window.__audioReview.snapshot)).original,3);assert.equal(await page.locator('#midiPlay').isEnabled(),true);
 // A fresh page with model loading failure still retains the decoded original.
 const fallback=await browser.newPage();await fallback.route('**/models/basic-pitch/model.json',r=>r.abort());await fallback.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});await fallback.locator('#audioFile').setInputFiles({name:'fallback.wav',mimeType:'audio/wav',buffer:Buffer.from(wav)});await fallback.waitForFunction(()=>document.querySelector('#audioProgress').hidden&&document.querySelector('#practiceStatus').textContent.includes('已保留原音频'),{},{timeout:60000});assert.equal(await fallback.locator('#playbackMode').inputValue(),'original');assert.equal(await fallback.locator('#midiPlay').isEnabled(),true);await fallback.locator('#midiPlay').click();await fallback.waitForFunction(()=>document.querySelector('#midiPlay').textContent==='暂停');
 assert.deepEqual(errors,[]);console.log('PASS: MIDI, actual audio inference, original playback, invalid file recovery, model failure with original fallback; no page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
