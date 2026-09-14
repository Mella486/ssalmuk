(()=>{
 'use strict';
 const C=SsalmukCalc,form=document.getElementById('recordForm'),status=document.getElementById('calcStatus');
 if(!form)return;
 const key='ssalmuk_records_v1';
 let records=[],storageAvailable=true,storageSnapshot=null,writePending=false;
 const fmt=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(Math.abs(n)<0.005?0:n);
 function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
 function localDate(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
 function parseStored(value){
  const raw=JSON.parse(value===null?'[]':value);
  if(!Array.isArray(raw)||raw.length>500)throw Error('Invalid saved data');
  return raw.map(C.validate);
 }
 form.elements.date.value=localDate();
 try{storageSnapshot=localStorage.getItem(key);records=parseStored(storageSnapshot);}
 catch(e){message('저장 기록을 읽지 못했습니다. 기존 저장소는 덮어쓰지 않습니다. 브라우저 저장 설정을 확인해주세요.',true);storageAvailable=false;}
 function input(){return Object.fromEntries(new FormData(form));}
 function resultText(r){return '순증가 '+fmt(r.net)+' '+r.unit+', 경과 시간당 '+fmt(r.hourly)+' '+r.unit+'/h, '+(r.activeHourly===null?'조작 시간 미산정':'직접 조작 시간당 '+fmt(r.activeHourly)+' '+r.unit+'/h')+'.';}
 function showResult(r){
  document.getElementById('result').hidden=false;
  document.getElementById('netResult').textContent=fmt(r.net)+' '+r.unit;
  document.getElementById('hourResult').textContent=fmt(r.hourly)+' '+r.unit+'/h';
  document.getElementById('activeResult').textContent=r.activeHourly===null?'조작 시간 미산정':fmt(r.activeHourly)+' '+r.unit+'/h';
  document.getElementById('resultBasis').textContent=r.basis==='example'?'계산 예시 · 실제 게임 수익 아님':'본인 입력값의 계산 결과 · 외부 검증 없음';
 }
 form.addEventListener('submit',e=>{
  e.preventDefault();
  try{const r=C.calculate(input());showResult(r);message('계산했습니다. '+resultText(r)+' 기록은 저장 버튼을 눌러야 이 브라우저에 남습니다.');}
  catch(e){document.getElementById('result').hidden=true;message(e.message,true);}
 });
 form.addEventListener('input',()=>{document.getElementById('result').hidden=true;});
 document.getElementById('exampleBtn').addEventListener('click',()=>{
  const sample={game:'가상 활동 A',date:localDate(),unit:'골드',basis:'example',revenue:10000,fee:500,cost:1500,minutes:90,active:60,memo:'계산 방법 설명용 가상 수치. 실제 게임 수익·수수료 아님.'};
  for(const [k,v]of Object.entries(sample))form.elements[k].value=v;
  const r=C.calculate(sample);showResult(r);message('가상 예시를 불러왔습니다. '+resultText(r)+' 실제 기록과 별도로 분류합니다.');
 });
 async function persist(change){
  if(writePending)return false;
  if(!storageAvailable){message('저장소를 사용할 수 없어 변경하지 않았습니다. 브라우저 저장 설정을 확인해주세요.',true);return false;}
  if(!globalThis.navigator?.locks?.request){message('이 브라우저는 여러 탭의 기록을 안전하게 저장하는 기능을 지원하지 않습니다. 최신 브라우저를 이용하거나 빈 CSV 양식에 기록하세요. 기존 기록은 변경하지 않습니다.',true);return false;}
  writePending=true;
  const saveButton=document.getElementById('saveBtn');saveButton.disabled=true;
  try{
   return await navigator.locks.request('ssalmuk-records-write',()=>{
    const stored=localStorage.getItem(key);
    if(stored!==storageSnapshot){
     try{records=parseStored(stored);storageSnapshot=stored;render();}
     catch(e){storageAvailable=false;message('다른 탭에서 바뀐 저장 기록을 읽지 못했습니다. 기존 자료를 덮어쓰지 않았습니다.',true);return false;}
     message('다른 탭에서 기록이 변경되어 최신 목록을 불러왔습니다. 기록을 덮어쓰지 않았습니다. 목록을 확인한 뒤 저장 또는 삭제를 다시 눌러주세요.',true);
     return false;
    }
    const next=change(records),serialized=JSON.stringify(next);
    localStorage.setItem(key,serialized);
    records=next;storageSnapshot=serialized;render();return true;
   });
  }catch(e){message('브라우저에 저장하지 못했습니다. 기존 기록은 유지됩니다. '+e.message,true);return false;}
  finally{writePending=false;saveButton.disabled=false;}
 }
 document.getElementById('saveBtn').addEventListener('click',async()=>{
  try{
   const r=C.calculate(input());
   if(await persist(current=>{if(current.length>=500)throw Error('최대 500개까지 보관합니다. CSV를 내려받은 후 필요한 기록을 삭제해주세요.');return [...current,r];})){
    showResult(r);message('이 브라우저에 저장했습니다. '+resultText(r)+' 공개 사이트로 전송되지 않습니다.');
   }
  }catch(e){document.getElementById('result').hidden=true;message(e.message,true);}
 });
 function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);return td;}
 function render(){
  const body=document.getElementById('recordRows');body.replaceChildren();
  document.getElementById('emptyRecords').hidden=records.length>0;
  document.getElementById('recordsTable').hidden=!records.length;
  document.getElementById('exportBtn').disabled=!records.length;
  records.forEach(r=>{
   const tr=document.createElement('tr');tr.className='record';
   cell(tr,r.date);cell(tr,r.game+(r.basis==='example'?' (계산 예시)':''));cell(tr,fmt(C.calculate(r).net)+' '+r.unit);cell(tr,fmt(r.minutes)+'분');
   const td=cell(tr,''),b=document.createElement('button');b.type='button';b.textContent='삭제';b.setAttribute('aria-label',r.date+' '+r.game+' 기록 삭제');
   b.addEventListener('click',async()=>{
    if(confirm('선택한 기록 1개를 이 브라우저에서 삭제할까요?')&&await persist(current=>current.filter(item=>item!==r)))message('선택한 기록을 삭제했습니다.');
   });
   td.append(b);body.append(tr);
  });
  const summary=document.getElementById('summary');summary.replaceChildren();
  for(const g of C.aggregate(records)){
   const p=document.createElement('p');p.textContent=g.game+' · '+g.unit+' · '+(g.basis==='example'?'계산 예시':'본인 기록')+' '+g.count+'회: 합계 순증가 '+fmt(g.net)+', 총 '+fmt(g.minutes)+'분, 시간 가중 평균 '+fmt(g.hourly)+' '+g.unit+'/h (회차 범위 '+fmt(g.min)+'~'+fmt(g.max)+')';summary.append(p);
  }
 }
 document.getElementById('exportBtn').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([C.toCSV(records)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download='ssalmuk-records-'+localDate()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  message('CSV 내보내기를 요청했습니다. 다운로드 파일에는 입력한 메모가 포함됩니다.');
 });
 render();
 document.getElementById('calculatorFields').disabled=false;
 if(storageAvailable)message('계산 준비가 되었습니다. 입력값과 저장 기록은 이 브라우저에서만 처리합니다.');
})();
