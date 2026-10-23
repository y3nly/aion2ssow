/* A separate provisional PvE skill estimate using Bongbong's current scenario. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),api=globalThis.SkillDamage;
  const storageKey='aion_stats_overhead_v1';
  let state={order:'after',kind:'normal',observed:''};
  try{state={...state,...JSON.parse(localStorage.getItem(storageKey)||'{}')};}catch{}
  if(!['before','after'].includes(state.order))state.order='after';
  const copy={
    title:['Overhead Slam · Lv 18','내려찍기 · 18레벨'],tag:['Experimental · PvE · No specializations','실험용 · PvE · 특화 없음'],
    normal:['Normal / hit','일반 / 타격'],critical:['Crit / hit','치명타 / 타격'],doubleNormal:['Double / hit','강타 / 타격'],doubleCritical:['Crit + Double / hit','치명타 + 강타 / 타격'],expectedCast:['Mean / cast','평균 / 사용'],
    setup:['Uses the current Bongbong stats, target, direction, and buffs above.','위 Bongbong 스탯, 대상, 방향 및 버프를 사용합니다.'],
    need:['Enter all character and target stats above to estimate damage.','위의 캐릭터 및 대상 스탯을 모두 입력하세요.'],
    pve:['This first skill estimate supports PvE only. Enable PvE above.','첫 스킬 추정은 PvE만 지원합니다. 위에서 PvE를 선택하세요.'],
    details:['Formula & meter comparison','공식 및 미터 비교'],
    formula:['Per damage effect: 2,125 + 1.636 × Attack. Two effects per cast are assumed from the client record; confirm the hit count in your meter.','피해 효과당 2,125 + 1.636 × 공격력. 클라이언트 기록에 따라 사용당 2회 효과를 가정합니다. 미터에서 타격 수를 확인하세요.'],
    limits:['Provisional: defense ordering, hit mapping, and absolute damage are not verified in game. Bongbong’s weapon, crit, Double, and Multi-hit assumptions apply; Perfect Chance and weapon damage rolls are not modeled.','잠정값: 방어 적용 순서, 타격 대응 및 절대 피해는 게임 내 미검증입니다. Bongbong의 무기, 치명타, 강타 및 다단 히트 가정을 사용합니다. 완벽과 무기 피해 편차는 제외합니다.'],
    outcomes:['Per-hit values exclude extra Multi-hit procs. Mean/cast includes estimated crit, Double, and Multi-hit rates across two effects.','타격당 값에는 추가 다단 히트가 없습니다. 사용당 평균에는 2회 효과의 추정 치명타, 강타 및 다단 히트 비율이 포함됩니다.'],
    order:['Defense order','방어 적용 순서'],after:['After skill scaling','스킬 배율 적용 후'],before:['Before skill scaling','스킬 배율 적용 전'],
    alternate:['Other defense order: mean/cast','다른 방어 순서: 사용당 평균'],
    observed:['Meter damage','미터 피해량'],kind:['Measurement','측정 유형'],difference:['Meter vs estimate','미터 / 추정 차이'],
    test:['Compare the same target, direction, and active buffs. For per-hit checks, select a hit with matching crit/Double flags and no extra proc; for mean/cast, divide skill damage by casts, not hits.','같은 대상, 방향 및 활성 버프로 비교하세요. 타격당 비교는 치명타/강타 여부가 같고 추가 발동이 없는 타격을 사용하세요. 사용당 평균은 스킬 피해를 타격 수가 아닌 사용 횟수로 나누세요.'],
    source:['Skill data ↗','스킬 자료 ↗'],invalid:['Enter valid nonnegative stats and a positive Attack value.','유효한 0 이상의 스탯과 양수 공격력을 입력하세요.']
  };
  const t=k=>copy[k][document.documentElement.lang==='ko'?1:0];
  const kinds=['normal','critical','doubleNormal','doubleCritical','expectedCast'];
  if(!kinds.includes(state.kind))state.kind='normal';
  if(typeof state.observed!=='string' || !/^\d*(\.\d*)?$/.test(state.observed))state.observed='';
  const host=document.createElement('section');host.id='skill-estimate';host.className='panel';host.dataset.owned='';
  $('bongbong-mode').append(host);
  const fmt=n=>n.toLocaleString(document.documentElement.lang==='ko'?'ko-KR':'en-US',{maximumFractionDigits:1});
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
  function localize(){
    const open=host.querySelector('details')?.open;
    host.innerHTML='<h2>'+t('title')+'</h2><p class="nm-note">'+t('tag')+'</p><p class="nm-note">'+t('setup')+'</p><div id="skill-output" aria-live="polite"></div>'+
      '<details'+(open?' open':'')+'><summary>'+t('details')+'</summary><p class="nm-note">'+t('formula')+'</p><p class="nm-note">'+t('limits')+'</p><p class="nm-note">'+t('outcomes')+'</p>'+
      '<div class="fields"><div class="f"><label for="skill-order">'+t('order')+'</label><select id="skill-order"><option value="after">'+t('after')+'</option><option value="before">'+t('before')+'</option></select></div>'+
      '<div class="f"><label for="skill-kind">'+t('kind')+'</label><select id="skill-kind">'+kinds.map(k=>'<option value="'+k+'">'+t(k)+'</option>').join('')+'</select></div>'+
      '<div class="f"><label for="skill-observed">'+t('observed')+'</label><input id="skill-observed" type="number" min="0" step="any"></div></div>'+
      '<p class="nm-status" id="skill-difference" role="status"></p><p class="nm-note" id="skill-alternate"></p><p class="nm-note">'+t('test')+'</p><p class="nm-note"><a href="'+api.skill.source+'" target="_blank" rel="noopener">'+t('source')+'</a> · Global client '+api.skill.client+' · 2026-10-16</p></details>';
    $('skill-order').value=state.order;$('skill-kind').value=state.kind;$('skill-observed').value=state.observed;draw();
  }
  function draw(){
    const out=$('skill-output');if(!out)return;
    $('skill-difference').textContent='';$('skill-alternate').textContent='';
    const ready=[...M,...E].every(([id])=>$(id).value.trim()!=='' && Number.isFinite(Number($(id).value)));
    if(!ready){out.innerHTML='<p class="nm-status">'+t('need')+'</p>';return;}
    const s=snap();if(!s.isPve){out.innerHTML='<p class="nm-status">'+t('pve')+'</p>';return;}
    // Cancel crit/Double/Multi-hit in a probe to obtain upstream's remaining multipliers.
    const probe=calc({...s,critAmp:s.eCritRes-50,smite:0,partySmite:0,eSmiteRes:0,multi:0});
    const input={attack:s.atk,defenseReduction:Math.max(s.eDef-s.pen,0)/10,multiplier:probe.mult,
      criticalFactor:1.5+(s.critAmp-s.eCritRes)/100,criticalChance:calc(s).critRate,
      doubleChance:Math.max(0,Math.min(s.smite+s.partySmite-s.eSmiteRes,100))/100,
      multiFactor:1+Math.min(s.multi,100)/100*.125};
    const result=api.estimate(input,state.order);
    if(!result || s.multi<0){out.innerHTML='<p class="nm-status">'+t('invalid')+'</p>';return;}
    out.innerHTML='<div class="skill-cards">'+kinds.map(k=>'<div class="card"><div class="lbl">'+t(k)+'</div><div class="val" id="skill-'+k+'">'+fmt(result[k])+'</div></div>').join('')+'</div>';
    const other=api.estimate(input,state.order==='after'?'before':'after');
    $('skill-alternate').textContent=t('alternate')+': '+fmt(other.expectedCast);
    const observed=Number(state.observed);
    if(state.observed!=='' && Number.isFinite(observed) && observed>=0 && result[state.kind]>0){
      const error=(observed/result[state.kind]-1)*100;
      $('skill-difference').textContent=t('difference')+': '+(error>=0?'+':'')+error.toFixed(2)+'%';
    }
  }
  host.addEventListener('input',e=>{if(e.target.id==='skill-observed'){state.observed=e.target.value;save();draw();}});
  host.addEventListener('change',e=>{if(e.target.id==='skill-kind' || e.target.id==='skill-order'){state[e.target.id==='skill-kind'?'kind':'order']=e.target.value;save();draw();}});
  $('stats-language').addEventListener('change',localize);
  const previousRender=render;render=function(){previousRender();draw();};
  localize();
})();
