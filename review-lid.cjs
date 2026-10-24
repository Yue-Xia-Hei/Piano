const {chromium}=require('C:/Users/ZML/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/main.js*',async route=>{const response=await route.fetch();let text=await response.text();text+='\nwindow.__modelReview={piano,casework,keys,noteToMesh,dimensions,scene,camera,renderer,keySpec,scorePage,deskBack,lidSpec,lidPanel,lidPivot,stand,deskEnvelope,lidProp,propBase,propTop,THREE,setView:(o,e,r)=>{orbit=o;elevation=e;radius=r;}};';await route.fulfill({response,body:text});});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
 await page.waitForTimeout(1500);
 if(errors.length) { await browser.close(); throw new Error(errors.join("\n")); }
 for(const [name,o,e,r] of [['perspective',.52,.38,10.6],['top',0,1.5,6.5],['rear',Math.PI,.3,10.6],['right',Math.PI/2,.27,10.6],['left',-Math.PI/2,.27,10.6],['front',0,.17,10.6]]){
  await page.evaluate(([o,e,r])=>window.__modelReview.setView(o,e,r),[o,e,r]);await page.waitForTimeout(300);await page.screenshot({path:`D:/Piano/refined-review-${name}.png`});
 }
 const clearance=await page.evaluate(()=>{
  const {THREE,piano,lidPanel,lidPivot,lidSpec,stand,lidProp,propBase,propTop}=window.__modelReview;
  piano.updateWorldMatrix(true,true);
  const desk=new THREE.Box3().setFromObject(stand);
  const samples=[];
  for(let angle=0;angle<=18;angle++){
   lidPivot.rotation.z=THREE.MathUtils.degToRad(angle);
   piano.updateWorldMatrix(true,true);
   const lid=new THREE.Box3().setFromObject(lidPanel);
   samples.push(desk.min.z-lid.max.z);
  }
  lidPivot.rotation.z=lidSpec.angle;
  piano.updateWorldMatrix(true,true);
  const prop=new THREE.Box3().setFromObject(lidProp);
  return {minimumLidDeskGap:Math.min(...samples),propDeskGap:desk.min.z-prop.max.z,angle:THREE.MathUtils.radToDeg(lidSpec.angle),propLength:propBase.distanceTo(propTop)};
 });
 if(clearance.minimumLidDeskGap<.10 || clearance.propDeskGap<.5) throw new Error('Insufficient clearance: '+JSON.stringify(clearance));
 console.log('PASS: lid clearance across 0-18 degrees '+JSON.stringify(clearance));

 const geometry=await page.evaluate(()=>{
  const {keys,keySpec,deskBack,scorePage,THREE}=window.__modelReview;
  const white=keys.filter(k=>k.userData.travel===keySpec.whiteTravel);
  const black=keys.filter(k=>k.userData.travel===keySpec.blackTravel);
  const top=k=>{k.geometry.computeBoundingBox();return k.position.y+k.geometry.boundingBox.max.y;};
  deskBack.geometry.computeBoundingBox();
  const rise=top(black[0])-top(white[0]);
  const paperGap=scorePage.position.z-deskBack.geometry.boundingBox.max.z;
  const bedGap=keySpec.whiteTop-keySpec.whiteHeight-keySpec.whiteTravel-(keySpec.whiteTop-keySpec.whiteHeight-.025);
  return {white:white.length,black:black.length,rise,paperGap,bedGap};
 });
 if(geometry.white!==52 || geometry.black!==36 || Math.abs(geometry.rise-.04)>1e-6 || geometry.paperGap<.005 || geometry.bedGap<.006) throw new Error('Geometry check failed '+JSON.stringify(geometry));
 console.log('PASS: key heights, depressed keybed gap, paper offset '+JSON.stringify(geometry));
 await page.keyboard.press('Digit1');
 if(!(await page.locator('#keyInfo').innerText()).includes('A0')) throw new Error('Keyboard mapping failed');
 await page.keyboard.press('Shift+Digit1');
 if(!(await page.locator('#keyInfo').innerText()).includes('F4')) throw new Error('Shift keyboard mapping failed');
 await page.evaluate(()=>window.__modelReview.setView(.52,.38,10.6));
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
 if(errors.length) throw new Error(errors.join('\n'));
 console.log('PASS: keyboard, Shift mapping, pointer picking, key animation reset');
 console.log(JSON.stringify({errors,model:await page.evaluate(()=>({keys:window.__modelReview.keys.length,notes:window.__modelReview.noteToMesh.size,caseScale:window.__modelReview.casework.scale.toArray(),drawCalls:window.__modelReview.renderer.info.render.calls}))}));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});


