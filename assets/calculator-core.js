(function(root){
 'use strict';
 const units=['골드','메소','은화','다이아','BP','원'];
 function validate(input){
  const r={...input};
  if(typeof r.game!=='string'||!r.game.trim()||r.game.length>60)throw Error('게임·활동 이름을 1~60자로 입력해주세요.');
  r.game=r.game.trim();
  if(!units.includes(r.unit))throw Error('지원하는 재화 단위를 선택해주세요. 목록에 없는 단위는 빈 CSV 기록 양식을 사용하세요.');
  if(!['actual','example'].includes(r.basis))throw Error('실제 기록인지 계산 예시인지 선택해주세요.');
  if(typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date)throw Error('올바른 기록 날짜를 입력해주세요.');
  for(const k of ['revenue','fee','cost','minutes','active']){
   if(!['string','number'].includes(typeof r[k])||(typeof r[k]==='string'&&!r[k].trim()))throw Error('수입·비용·시간을 모두 입력해주세요. 사용하지 않은 비용은 0을 입력하세요.');
   r[k]=Number(r[k]);
   if(!Number.isFinite(r[k])||r[k]<0||r[k]>1e15)throw Error('숫자는 0 이상 1,000조 이하로 입력해주세요.');
  }
  if(r.minutes<0.01)throw Error('경과 시간은 0.01분 이상이어야 합니다.');
  for(const k of ['minutes','active']){
   if(r[k]>0&&r[k]<0.01)throw Error('조작 시간은 미산정이면 0, 그 외에는 0.01분 이상 입력하세요.');
   if(Math.abs(r[k]*100-Math.round(r[k]*100))>1e-7)throw Error('시간은 분 단위로 소수 둘째 자리까지 입력하세요.');
  }
  if(r.active>r.minutes)throw Error('직접 조작 시간은 경과 시간보다 길 수 없습니다.');
  if(typeof r.memo!=='string')r.memo='';
  if(r.memo.length>500)throw Error('조건 메모는 500자 이내로 입력해주세요.');
  return r;
 }
 function calculate(input){
  const r=validate(input),net=r.revenue-r.fee-r.cost;
  const hourly=net*60/r.minutes,activeHourly=r.active>0?net*60/r.active:null;
  if(!Number.isFinite(net)||!Number.isFinite(hourly)||(activeHourly!==null&&!Number.isFinite(activeHourly)))throw Error('계산 가능한 범위를 벗어났습니다. 금액과 시간을 확인해주세요.');
  return {...r,net,hourly,activeHourly};
 }
 function aggregate(records){
  const map=new Map();
  for(const raw of records){const r=calculate(raw);const key=JSON.stringify([r.game,r.unit,r.basis]);if(!map.has(key))map.set(key,{game:r.game,unit:r.unit,basis:r.basis,net:0,minutes:0,count:0,rates:[]});const g=map.get(key);g.net+=r.net;g.minutes+=r.minutes;g.count++;g.rates.push(r.hourly);}
  return [...map.values()].map(g=>({...g,hourly:g.net*60/g.minutes,min:Math.min(...g.rates),max:Math.max(...g.rates)}));
 }
 function csvCell(value){let s=String(value??'');if(typeof value==='string'&&/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
 function toCSV(records){const header=['날짜','게임·활동','단위','기록 유형','정산 전 판매금·기타 수입','실제 수수료','기타 비용','경과 분','조작 분','순증가','경과 시간당','조건 메모'];return '\uFEFF'+[header,...records.map(raw=>{const r=calculate(raw);return [r.date,r.game,r.unit,r.basis==='example'?'계산 예시':'본인 입력·미검증',r.revenue,r.fee,r.cost,r.minutes,r.active,r.net,r.hourly,r.memo];})].map(row=>row.map(csvCell).join(',')).join('\r\n');}
 const api={units,validate,calculate,aggregate,toCSV};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SsalmukCalc=api;
})(globalThis);
