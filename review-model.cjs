const {chromium}=require('C:/Users/ZML/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/main.js*',async route=>{const response=await route.fetch();let text=await response.text();text+='\nwindow.__modelReview={piano,casework,keys,noteToMesh,dimensions,scene,camera,renderer,setView:(o,e,r)=>{orbit=o;elevation=e;radius=r;}};';await route.fulfill({response,body:text});});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 await page.waitForTimeout(1500);
 for(const [name,o,e,r] of [['perspective',.52,.34,9.4],['top',0,1.5,2.5],['rear',Math.PI,.3,9.4],['right',Math.PI/2,.27,9.4],['front',0,.17,9.4]]){
  await page.evaluate(([o,e,r])=>window.__modelReview.setView(o,e,r),[o,e,r]);await page.waitForTimeout(300);await page.screenshot({path:`D:/Piano/model-review-${name}.png`});
 }
 await page.keyboard.press('Digit1');
 if(!(await page.locator('#keyInfo').innerText()).includes('A0')) throw new Error('Keyboard mapping failed');
 await page.keyboard.press('Shift+Digit1');
 if(!(await page.locator('#keyInfo').innerText()).includes('F4')) throw new Error('Shift keyboard mapping failed');
 await page.evaluate(()=>window.__modelReview.setView(.52,.34,9.4));
 await page.waitForTimeout(300);
 const keyPoint=await page.evaluate(()=>{
   const {noteToMesh,camera,renderer}=window.__modelReview;
   const key=noteToMesh.get(60);
   const point=key.localToWorld(key.position.clone().set(0,.05,.29)).project(camera);
   const rect=renderer.domElement.getBoundingClientRect();
   return {x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2};
 });
 await page.mouse.click(keyPoint.x,keyPoint.y);
 if(!(await page.locator('#keyInfo').innerText()).includes('C4')) throw new Error('Pointer key picking failed');
 await page.waitForTimeout(200);
 const restored=await page.evaluate(()=>{const key=window.__modelReview.noteToMesh.get(60);return key.position.y===key.userData.baseY;});
 if(!restored) throw new Error('Key animation did not reset');
 console.log('PASS: keyboard, Shift mapping, pointer picking, key animation reset');
 console.log(JSON.stringify({errors,model:await page.evaluate(()=>({keys:window.__modelReview.keys.length,notes:window.__modelReview.noteToMesh.size,caseScale:window.__modelReview.casework.scale.toArray(),drawCalls:window.__modelReview.renderer.info.render.calls}))}));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});


