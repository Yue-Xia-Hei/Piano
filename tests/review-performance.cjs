const {chromium}=require('C:/Users/ZML/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/main.js*',async route=>{const response=await route.fetch();let text=await response.text();text+='\nwindow.__performanceReview={loadPerformance,transcribeAudio,audioEngine,transport,codes,drawScore,scoreCanvas,stopMidi,get snapshot(){return {index:practiceIndex,pending:[...practicePending],held:[...heldKeys.values()].map(k=>({midi:k.midi,released:k.released})),raw:rawPerformanceNotes,notes:performanceNotes,events:practiceNotes,playing:midiPlaying}},setView:(o,e,r)=>{orbit=o;elevation=e;radius=r;}};';await route.fulfill({response,body:text});});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__performanceReview);
 const load=async(notes,title='回归练习')=>page.evaluate(({notes,title})=>window.__performanceReview.loadPerformance(title,notes,{source:'midi',duration:4}),{notes,title});
 const note=(midi,time=0,duration=.4)=>({midi,time,duration,velocity:.65});
 const snap=()=>page.evaluate(()=>window.__performanceReview.snapshot);
 const chord=[24,28,68,72]; // Digit4, Digit8, Shift+4, Shift+8 (44 keys per bank)
 const codes=await page.evaluate(()=>window.__performanceReview.codes);chord[2]=24+codes.length;chord[3]=28+codes.length;
 await load([...chord.map(m=>note(m)),note(60,1)]);
 await page.keyboard.press('Digit4');await page.keyboard.press('Digit8');assert.equal((await snap()).index,0);assert.equal((await snap()).pending.length,2);
 await page.keyboard.press('Shift+Digit4');await page.keyboard.press('Shift+Digit8');assert.equal((await snap()).index,1);
 // Releasing Shift before the note key must still release its original pitch.
 await page.keyboard.down('Shift');await page.keyboard.down('Digit4');await page.keyboard.up('Shift');await page.keyboard.up('Digit4');assert.equal((await snap()).held.length,0);
 // A button keeping focus must not swallow piano keys.
 await load([note(24),note(28,1)]);await page.locator('#restart').focus();await page.keyboard.press('Digit4');assert.equal((await snap()).index,1);
 // Simultaneous mode rejects long intervals and accepts a held chord.
 await page.locator('#scoreOptions').click();await page.selectOption('#chordMode','simultaneous');await page.locator('#closeScoreSettings').click();
 await load([note(24),note(28),note(60,1)]);await page.locator('#restart').focus();await page.keyboard.down('Digit4');await page.waitForTimeout(220);await page.keyboard.down('Digit8');assert.equal((await snap()).index,0);assert.match(await page.locator('#practiceStatus').textContent(),/180ms/);await page.keyboard.up('Digit4');await page.keyboard.up('Digit8');await page.keyboard.down('Digit4');await page.keyboard.down('Digit8');assert.equal((await snap()).index,1);await page.keyboard.up('Digit4');await page.keyboard.up('Digit8');
 await page.locator('#scoreOptions').click();await page.selectOption('#chordMode','collect');await page.locator('#closeScoreSettings').click();
 const dimensions=()=>page.locator('.practice-hud').boundingBox();
 await load([note(60)]);const simple=await dimensions();
 const dense=Array.from({length:12},(_,i)=>[48,52,55,60,64,67,72,76].map(m=>note(m,i*.14))).flat();
 await load(dense,'非常长的音频标题用于验证底部区域始终保持固定尺寸与琴谱标题不会覆盖副标题'.repeat(3));const complex=await dimensions();assert.equal(simple.height,complex.height);assert.equal(simple.width,complex.width);
 const raw=JSON.stringify((await snap()).raw);await page.locator('#scoreOptions').click();await page.selectOption('#practiceVersion','melody');await page.locator('#notationBpm').fill('80');await page.locator('#notationBpm').dispatchEvent('change');assert.equal(JSON.stringify((await snap()).raw),raw);await page.selectOption('#practiceVersion','full');await page.locator('#closeScoreSettings').click();
 await page.evaluate(()=>{const r=window.__performanceReview;r.setView(0,.48,9.8);});await page.waitForTimeout(300);
 await page.screenshot({path:'D:/Piano/performance-review.png'});
 await page.evaluate(()=>{const a=document.createElement('a');a.href=window.__performanceReview.scoreCanvas.toDataURL();a.download='';window.__scoreData=a.href;});fs.writeFileSync('D:/Piano/performance-score-review.png',Buffer.from((await page.evaluate(()=>window.__scoreData)).split(',')[1],'base64'));
 // Real local MP3 decoding, transport pause/seek/rate and resumed playback.
 await page.selectOption('#playbackMode','piano');await page.locator('#midiPlay').click();await page.waitForFunction(()=>window.__performanceReview.transport.playing);await page.waitForTimeout(350);await page.locator('#midiPlay').click();assert.equal((await snap()).playing,false);
 const paused=await page.evaluate(()=>window.__performanceReview.transport.position());await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__performanceReview.transport.position()),paused);
 await page.locator('#playbackSeek').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.selectOption('#midiSpeed','0.5');await page.locator('#midiPlay').click();await page.waitForFunction(()=>window.__performanceReview.transport.playing);await page.waitForTimeout(300);const pos=await page.evaluate(()=>window.__performanceReview.transport.position());assert.ok(pos>1&&pos<1.4);await page.locator('#midiStop').click();
 // Phone layout remains within the viewport and keeps stable height.
 await page.setViewportSize({width:390,height:844});await load([note(60)]);const phoneSimple=await dimensions();await load(dense,'手机端长标题'.repeat(25));const phoneComplex=await dimensions();assert.equal(phoneSimple.height,phoneComplex.height);assert.ok(phoneComplex.x>=0&&phoneComplex.x+phoneComplex.width<=390);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.screenshot({path:'D:/Piano/performance-mobile-review.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:'chord collect, simultaneous tolerance, Shift release, button focus, notation invariance, fixed desktop/mobile HUD, sampled playback/pause/seek/speed',desktop:simple,phone:phoneSimple,cachedSamples:await page.evaluate(()=>window.__performanceReview.audioEngine.buffers.size),errors}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
