const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const policy=require('./community-policy.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');

test('all executable inline scripts parse and automatic generators are absent',()=>{
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!m[1].includes('ld+json')&&m[2].trim())new vm.Script(m[2]);
  }
  assert.doesNotMatch(html,/seedDailyChat|seedDailyPredChat|buildPredSeedPosts|SEED_POSTS|checkAutoDelete|syncPredictionMigrations/);
});

test('automatic records are hidden without discarding replies or unclassified records',async()=>{
  const input=[{id:'daily-test',body:'auto'},{id:'pred-daily-test'},{id:'pq-test'},{id:'flagged',isAutoDaily:true},{id:'p-human',parentId:'daily-test',body:'reply'},{id:'unknown',body:'unknown'}];
  const before=JSON.stringify(input);
  const visible=await policy.filterPosts(input);
  assert.deepEqual(visible.map(p=>p.id),['p-human','unknown']);
  assert.deepEqual(policy.roots(visible).map(p=>p.id),['p-human','unknown']);
  assert.equal(JSON.stringify(input),before);
});

test('seed fingerprint matches exact text; an edited or unrelated record survives',async()=>{
  const seed={id:'s1',body:'클래식 혈맹전 직후 아이템 시세 폭등해서 실질 시급 올랐음. 지금 타이밍 좋아요'};
  assert.equal(await policy.isGenerated(seed),true);
  assert.equal(await policy.isGenerated({...seed,body:'작성자가 바꾼 내용'}),false);
  assert.equal(await policy.isGenerated({...seed,id:'p-different'}),false);
});

function loadHarness(failure=false){
  const writes=[];
  const source=html.slice(html.indexOf('let communityLoadFailed='),html.indexOf('// ── 렌더링 ──'));
  const context=vm.createContext({CommunityPolicy:policy,setTimeout,clearTimeout,console:{error(){}},lsGet:(_,fallback)=>fallback,lsSet(){},
    games:[],posts:{},pendingGames:{},myVotes:{},myPostLikes:{},
    db:{
      collection(name){return {
        async get(){
          if(failure)throw Error('Unavailable');
          return {docs:name==='posts'?[{id:'daily-test',data:()=>({gameId:'test'})},{id:'r-real',data:()=>({gameId:'test',parentId:'daily-test'})}]:[]};
        },
        doc(){return {set(){writes.push('set');},delete(){writes.push('delete');}};}
      };},
      batch(){writes.push('batch');throw Error('unexpected write');}
    }
  });
  vm.runInContext(source,context);
  return {context,writes};
}
test('empty database is read-only; no games or posts are seeded',async()=>{
  const {context,writes}=loadHarness();await vm.runInContext('loadData()',context);
  assert.equal(context.games.length,0);assert.deepEqual(Array.from(context.posts.test,p=>p.id),['r-real']);assert.deepEqual(writes,[]);
});
test('failed reads show failure state and never substitute fake data',async()=>{
  const {context,writes}=loadHarness(true);await vm.runInContext('loadData()',context);
  assert.equal(context.games.length,0);assert.equal(Object.keys(context.posts).length,0);
  assert.equal(vm.runInContext('communityLoadFailed && gamesLoadFailed',context),true);assert.deepEqual(writes,[]);
});

test('post appears only after successful persistence; failure and duplicate clicks do not add records',async()=>{
  let resolve,reject;
  const saves=[];
  const context=vm.createContext({posts:{},renderStats(){},showToast(){},console:{error(){}},db:{collection(){return {doc(){return {set(post){saves.push(post);return new Promise((a,b)=>{resolve=a;reject=b;});}};}};}}});
  vm.runInContext(html.slice(html.indexOf('const communityWrites='),html.indexOf('async function submitReply(')),context);
  const pending=vm.runInContext("persistCommunityPost({id:'p1',gameId:'test'})",context);
  assert.equal(Object.keys(context.posts).length,0);
  assert.equal(await vm.runInContext("persistCommunityPost({id:'p2',gameId:'test'})",context),false);
  assert.equal(saves.length,1);resolve();assert.equal(await pending,true);assert.equal(context.posts.test.length,1);
  const failed=vm.runInContext("persistCommunityPost({id:'p3',gameId:'test'})",context);reject(Error('offline'));
  assert.equal(await failed,false);assert.equal(context.posts.test.length,1);
});
