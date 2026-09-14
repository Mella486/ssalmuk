const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),C=require('../assets/calculator-core.js');
const sample={game:'활동 A',date:'2026-09-11',unit:'골드',basis:'actual',revenue:10000,fee:500,cost:1500,minutes:90,active:60,memo:''};
test('gross and already-settled inputs agree without charging fees twice',()=>{const a=C.calculate(sample),b=C.calculate({...sample,revenue:9500,fee:0});assert.equal(a.net,8000);assert.equal(a.hourly,8000/1.5);assert.equal(a.net,b.net);assert.equal(a.activeHourly,8000);});
test('negative results survive and zero active minutes are not infinity',()=>{const r=C.calculate({...sample,revenue:0,active:0});assert.equal(r.net,-2000);assert.equal(r.activeHourly,null);});
test('invalid amounts, missing inputs, impossible dates and times are rejected',()=>{for(const update of [{minutes:0},{active:91},{revenue:Infinity},{cost:NaN},{fee:-1},{revenue:''},{minutes:undefined},{date:'2026-02-30'},{game:' '},{unit:'USD'},{basis:'verified'}])assert.throws(()=>C.calculate({...sample,...update}),JSON.stringify(update));});
test('minute precision and derived rates stay within the supported numeric range',()=>{
 for(const update of [{minutes:1e-300,active:0,revenue:1e15},{minutes:0.001,active:0},{minutes:1.001,active:0},{active:0.001},{active:1.001},{revenue:' '},{fee:false},{cost:[]}])assert.throws(()=>C.calculate({...sample,...update}),JSON.stringify(update));
 for(const update of [{minutes:0.01,active:0},{minutes:1.01,active:0.01},{minutes:1e15,active:1e15,revenue:1e15}]){
  const r=C.calculate({...sample,...update});assert(Number.isFinite(r.net));assert(Number.isFinite(r.hourly));assert(r.activeHourly===null||Number.isFinite(r.activeHourly));
 }
});
test('unsupported currencies cannot be combined as a generic other unit',()=>{
 assert(!C.units.includes('기타 게임 재화'));
 for(const unit of ['기타 게임 재화','원석','모라'])assert.throws(()=>C.calculate({...sample,unit}),/CSV/);
});
test('period rate uses total time and preserves game/unit/example boundaries',()=>{const rows=[{...sample,revenue:100,fee:0,cost:0,minutes:10,active:10},{...sample,revenue:100,fee:0,cost:0,minutes:50,active:50},{...sample,game:'활동 B'},{...sample,unit:'메소'},{...sample,basis:'example'}];const groups=C.aggregate(rows);assert.equal(groups.length,4);assert.equal(groups[0].hourly,200);assert.equal(groups[0].count,2);assert.equal(groups[0].min,120);assert.equal(groups[0].max,600);});
test('CSV distinguishes examples, quotes multiline text and neutralizes spreadsheet formulas',()=>{const csv=C.toCSV([{...sample,game:'=HYPERLINK("bad")',memo:' @SUM(1,2)\n메모',basis:'example'}]);assert(csv.startsWith('\uFEFF'));assert(csv.includes("'=HYPERLINK"));assert(csv.includes("' @SUM"));assert(csv.includes('계산 예시'));assert(csv.includes('""bad""'));});
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name.startsWith('.')?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const pages=walk(root).filter(p=>p.endsWith('.html'));
test('every public page has unique metadata, one H1, truthful verification and no tracking dependencies',()=>{
 const titles=new Set();assert.equal(pages.length,27);
 for(const file of pages){const html=fs.readFileSync(file,'utf8');assert.equal((html.match(/<h1\b/g)||[]).length,1,file);const title=html.match(/<title>(.*?)<\/title>/)?.[1];assert(title&&!titles.has(title),file);titles.add(title);assert.match(html,/<meta name="description" content="[^"]+"/);assert.match(html,/<meta name="google-adsense-account" content="ca-pub-3692243854038260"/);assert.doesNotMatch(html,/user-scalable=no|firebase.*\.js|googletagmanager|adsbygoogle\.js|<ins\b|onSnapshot|seedDaily/);for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){if(m[1].includes('application/ld+json'))JSON.parse(m[2]);else if(m[2].trim())new vm.Script(m[2]);}}
});
test('internal URLs and fragment links resolve; sitemap lists all indexable pages',()=>{
 const sitemap=fs.readFileSync(root+'/sitemap.xml','utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,26);
 for(const file of pages){const html=fs.readFileSync(file,'utf8');for(const m of html.matchAll(/(?:href|src)="([^"<>]+)"/g)){const href=m[1].replaceAll('&amp;','&');if(!href.startsWith('/')&&!href.startsWith('#'))continue;const u=new URL(href,'https://ssalmukindex.com/'+path.relative(root,file).replaceAll('\\','/'));const local=path.join(root,u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname);assert(fs.existsSync(local),file+' missing '+href);if(u.hash){const target=fs.readFileSync(local,'utf8');assert(target.includes('id="'+decodeURIComponent(u.hash.slice(1))+'"'),file+' missing fragment '+href);}}const canonical=html.match(/rel="canonical" href="([^"]+)"/)[1];if(!file.endsWith('404.html'))assert(sitemap.includes('<loc>'+canonical+'</loc>'),canonical);}
});
