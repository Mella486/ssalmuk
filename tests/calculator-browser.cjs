// Run with PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE set when browsers are not installed locally.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),key='ssalmuk_records_v1';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 let checks=0;const requests=[];
 async function context(options={}){const c=await browser.newContext(options);await c.route('**/*',route=>{const url=route.request().url();requests.push(url);if(!url.startsWith(base+'/'))return route.abort();return route.continue();});return c;}
 async function open(c){const p=await c.newPage();p.on('dialog',d=>d.accept());await p.goto(base+'/calculator.html');return p;}
 async function sample(p,game){await p.locator('#exampleBtn').click();await p.locator('#game').fill(game);}
 async function settled(p){await p.waitForFunction(()=>!document.getElementById('saveBtn').disabled);}
 async function stored(p){return p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),key);}
 try{
  const c=await context(),a=await open(c),b=await open(c),errors=[];
  a.on('pageerror',e=>errors.push(e.message));b.on('pageerror',e=>errors.push(e.message));
  assert.equal(await a.locator('#calculatorFields').evaluate(el=>el.disabled),false);
  await sample(a,'활동 A');assert.match(await a.locator('#calcStatus').innerText(),/순증가 8,000 골드.*5,333.33/);
  await sample(b,'활동 B');await Promise.all([a.locator('#saveBtn').click(),b.locator('#saveBtn').click()]);await Promise.all([settled(a),settled(b)]);
  assert.equal((await stored(a)).length,1);
  const conflict=(await a.locator('#calcStatus').innerText()).includes('다른 탭')?a:b;
  assert.match(await conflict.locator('#calcStatus').innerText(),/덮어쓰지 않았습니다/);
  await conflict.locator('#saveBtn').click();await settled(conflict);assert.equal((await stored(a)).length,2);checks++;
  await Promise.all([a.reload(),b.reload()]);
  await a.getByRole('button',{name:/활동 A 기록 삭제/}).click();await settled(a);assert.deepEqual((await stored(a)).map(r=>r.game),['활동 B']);
  await b.getByRole('button',{name:/활동 B 기록 삭제/}).click();await settled(b);assert.equal((await stored(b)).length,1);assert.match(await b.locator('#calcStatus').innerText(),/다른 탭/);
  await b.getByRole('button',{name:/활동 B 기록 삭제/}).click();await settled(b);assert.equal((await stored(b)).length,0);checks++;
  await sample(b,'보존할 기록');await b.locator('#saveBtn').click();await settled(b);
  await b.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('quota');};});await sample(b,'저장 실패 기록');await b.locator('#saveBtn').click();await settled(b);
  assert.match(await b.locator('#calcStatus').innerText(),/저장하지 못했습니다/);assert.equal((await stored(b)).length,1);checks++;
  await b.locator('#minutes').fill('0.001');await b.locator('#active').fill('0');await b.locator('#saveBtn').click();assert.match(await b.locator('#calcStatus').innerText(),/0.01분/);assert.equal(await b.locator('#result').isVisible(),false);checks++;
  assert.deepEqual(errors,[]);await c.close();
  for(const failure of ['no-js','calculator-core.js','calculator.js']){
   const broken=await context({javaScriptEnabled:failure!=='no-js'});
   if(failure!=='no-js')await broken.route('**/assets/'+failure,r=>r.abort());
   const p=await open(broken);assert.equal(await p.locator('#calculatorFields').evaluate(el=>el.disabled),true);
   assert.equal(await p.locator('#recordForm input, #recordForm select, #recordForm button').evaluateAll(els=>els.every(e=>e.matches(':disabled'))),true);
   assert.equal(new URL(p.url()).search,'');await broken.close();checks++;
  }
  const corrupt=await context();await corrupt.addInitScript(k=>localStorage.setItem(k,'{invalid'),key);const p=await open(corrupt);
  assert.match(await p.locator('#calcStatus').innerText(),/읽지 못했습니다/);await sample(p,'보존');await p.locator('#saveBtn').click();assert.match(await p.locator('#calcStatus').innerText(),/변경하지 않았습니다/);assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),'{invalid');await corrupt.close();checks++;
  const unsupported=await context();await unsupported.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));const u=await open(unsupported);
  await sample(u,'저장 미지원');await u.locator('#saveBtn').click();assert.match(await u.locator('#calcStatus').innerText(),/안전하게 저장/);assert.equal((await stored(u)).length,0);await unsupported.close();checks++;
  assert(requests.every(url=>url.startsWith(base+'/')&&!new URL(url).search));
  console.log(JSON.stringify({checks,externalRequests:0,recordQueries:0,passed:true}));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
