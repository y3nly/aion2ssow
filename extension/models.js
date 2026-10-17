/* Independent implementation of the public NotMeter stat model.
 * Reference: https://notmeter.com/assets/stat-efficiency-calculator.js?v=20261013-hard-hit
 * Formula observation date: 2026-10-16. No runtime request to NotMeter is made. */
(function (root) {
  'use strict';
  const fields = {
    power: ['Might', '위력'], destruction: ['Destruction', '파괴'], justice: ['Justice', '정의'], wisdom: ['Wisdom', '지혜'],
    attack: ['Attack', '공격력'], additionalAttack: ['Attack Bonus', '추가 공격력'],
    minimumAttack: ['Min Attack', '최소 공격력'], maximumAttack: ['Max Attack', '최대 공격력'],
    pveAttack: ['PvE Attack', 'PVE 공격력'], bossAttack: ['Boss Attack', '보스 공격력'],
    attackIncreasePercent: ['Attack Increase %', '공격력 증가율 %'],
    damageAmplificationPercent: ['Damage Boost %', '피해 증폭 %'],
    weaponDamageAmplificationPercent: ['Weapon Boost %', '무기 피해 증폭 %'],
    pveDamageAmplificationPercent: ['PvE Boost %', 'PVE 피해 증폭 %'],
    bossDamageAmplificationPercent: ['Boss Boost %', '보스 피해 증폭 %'],
    criticalDamageAmplificationPercent: ['Crit Damage Boost %', '치명타 피해 증폭 %'],
    perfectPercent: ['Perfect Chance %', '완벽 %'], hardHitPercent: ['Double Chance %', '강타 %'],
    frontDamageAmplificationPercent: ['Front Attack Boost %', '전방 피해 증폭 %'],
    backDamageAmplificationPercent: ['Back Attack Boost %', '후방 피해 증폭 %'],
    criticalChancePercent: ['Crit Chance %', '치명타 발동률 %'],
    partyHardHitPercent: ['Party Double %', '파티 강타 %'],
    bossHardHitResistancePercent: ['Boss Double Resist %', '보스 강타 저항 %'],
    frontAttackRatePercent: ['Front Uptime %', '전방 유지 비율 %'],
    backAttackRatePercent: ['Back Uptime %', '후방 유지 비율 %'],
  };
  const scenario = ['criticalChancePercent','partyHardHitPercent','bossHardHitResistancePercent','frontAttackRatePercent','backAttackRatePercent'];
  const baseline = Object.keys(fields).filter(k => !scenario.includes(k));
  const attackFields = ['attack','additionalAttack','minimumAttack','maximumAttack','pveAttack','bossAttack'];
  const classes = { '수호성':'Templar','검성':'Gladiator','살성':'Assassin','궁성':'Ranger','호법성':'Chanter','치유성':'Cleric','마도성':'Sorcerer','정령성':'Spiritmaster','권성':'Brawler' };
  const mappings = {
    damageAmplificationPercent:'amp', weaponDamageAmplificationPercent:'wAmp',
    criticalDamageAmplificationPercent:'critAmp', frontDamageAmplificationPercent:'frontAmp',
    backDamageAmplificationPercent:'backAmp', hardHitPercent:'smite',
    pveDamageAmplificationPercent:'pveAmp', bossDamageAmplificationPercent:'bossAmp',
  };
  const clamp = v => Math.min(100,Math.max(0,v));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const defaults = () => Object.assign(Object.fromEntries(Object.keys(fields).map(k => [k,0])), {
    attack: 10000, minimumAttack: 1000, maximumAttack: 2000,
    criticalChancePercent: 80, bossHardHitResistancePercent: 0,
    frontAttackRatePercent: 100, backAttackRatePercent: 100, attackType:'none',
  });
  function reconstructAttack(p) {
    const keys=['attack','additionalAttack','minimumAttack','maximumAttack','attackIncreasePercent'];
    if(!keys.every(k => finite(p[k]))) return undefined;
    return (p.attack+p.additionalAttack+(p.minimumAttack+p.maximumAttack)/2)*(1+p.attackIncreasePercent/100);
  }
  function decode(text) {
    const prefix='NOTMETER_STATS_V4:';
    const value=String(text).trim();
    if(value.length>1000000 || !value.startsWith(prefix)) throw new Error('format');
    const encoded=value.slice(prefix.length);
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length%4===1) throw new Error('encoding');
    let p;
    try {
      const bytes=Uint8Array.from(atob(encoded), c=>c.charCodeAt(0));
      p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    } catch { throw new Error('encoding'); }
    if(!p || Array.isArray(p) || p.schema!=='notmeter-stat-efficiency-profile-v4' || !finite(p.attack) || p.attack<=0) throw new Error('schema');
    for(const k of baseline) {
      if(!(k in p)) continue;
      const lo=attackFields.includes(k) || ['power','destruction','justice','wisdom'].includes(k)?0:-1000;
      const hi=lo===0?100000000:1000;
      if(!finite(p[k]) || p[k]<lo || p[k]>hi) throw new Error('value:'+k);
    }
    if(finite(p.minimumAttack) && finite(p.maximumAttack) && p.minimumAttack>p.maximumAttack) throw new Error('range');
    if('jobName' in p && (typeof p.jobName!=='string' || p.jobName.length>100)) throw new Error('job');
    return p; // Unknown producer fields are retained, never evaluated or inserted as HTML.
  }
  function adapt(p) {
    const bong={}, notmeter={};
    for(const k of baseline) if(finite(p[k])) notmeter[k]=p[k];
    for(const [from,to] of Object.entries(mappings)) if(finite(p[from])) bong[to]=p[from];
    const attack=reconstructAttack(p);
    if(attack!==undefined) {
      if(!finite(attack) || attack<=0) throw new Error('attack');
      bong.atk=attack;
    }
    const job=String(p.jobName||'').trim();
    const classKey=Object.keys(classes).find(k=>k===job || classes[k].toLowerCase()===job.toLowerCase());
    return { bong, notmeter, classKey, missingBong:['atk','pen','critStat','amp','wAmp','critAmp','backAmp','frontAmp','multi','smite','pveAmp','bossAmp','speedNow'].filter(k=>!(k in bong)),
      missingNotmeter:baseline.filter(k=>!(k in notmeter)) };
  }
  function valid(s) {
    return Object.keys(fields).every(k=>finite(s[k]) && s[k]>= (attackFields.includes(k)?0:-1000) && s[k]<= (attackFields.includes(k)?1e8:1000)) &&
      s.attack>0 && s.minimumAttack<=s.maximumAttack && ['none','front','back'].includes(s.attackType);
  }
  function evaluate(s, delta={}, candidate=false) {
    const d=k=>delta[k]||0;
    const gear=s.attack+d('attack'), bonus=s.additionalAttack+d('additionalAttack');
    const min=s.minimumAttack+d('minimumAttack'), max=s.maximumAttack+d('maximumAttack');
    const inc=s.attackIncreasePercent+d('attackIncreasePercent');
    if(!candidate && (gear<0 || bonus<0 || min<0 || max<min || s.pveAttack+d('pveAttack')<0 || s.bossAttack+d('bossAttack')<0)) return null;
    const average=(min+max)/2, perfect=clamp(s.perfectPercent+d('perfectPercent'))/100;
    const weapon=1+(s.weaponDamageAmplificationPercent+d('weaponDamageAmplificationPercent'))/100;
    const effective=(gear*weapon+bonus+(average*(1-perfect)+max*perfect)*weapon)*(1+inc/100)+s.pveAttack+d('pveAttack')+s.bossAttack+d('bossAttack');
    const boost=1+(s.damageAmplificationPercent+d('damageAmplificationPercent')+s.pveDamageAmplificationPercent+d('pveDamageAmplificationPercent')+s.bossDamageAmplificationPercent+d('bossDamageAmplificationPercent'))/100;
    const crit=1+clamp(s.criticalChancePercent)/100*(0.5+(s.criticalDamageAmplificationPercent+d('criticalDamageAmplificationPercent'))/100);
    const double=1+clamp(s.hardHitPercent+d('hardHitPercent')+s.partyHardHitPercent-s.bossHardHitResistancePercent)/100;
    const dir=s.attackType==='none'?1:1+clamp(s[s.attackType+'AttackRatePercent'])/100*(s[s.attackType+'DamageAmplificationPercent']+d(s.attackType+'DamageAmplificationPercent'))/100;
    const attack=(gear+bonus+average)*(1+inc/100), damage=effective*boost*crit*double*dir;
    return [attack,effective,damage,boost,crit,double,dir].every(v=>finite(v)&&v>0)?{attack,effective,damage}:null;
  }
  const effects = [
    ['power',1,{attackIncreasePercent:.1}],['destruction',1,{attackIncreasePercent:.2}],
    ['justice',1,{perfectPercent:.2}],['wisdom',1,{hardHitPercent:.2}],
    ...attackFields.map(k=>[k,10,{[k]:10}]),
    ...['attackIncreasePercent','damageAmplificationPercent','weaponDamageAmplificationPercent','pveDamageAmplificationPercent','bossDamageAmplificationPercent','criticalDamageAmplificationPercent','perfectPercent','hardHitPercent','frontDamageAmplificationPercent','backDamageAmplificationPercent'].map(k=>[k,1,{[k]:1}]),
  ];
  function calculate(s, delta={}) {
    if(!valid(s) || !Object.values(delta).every(finite)) return null;
    const base=evaluate(s), after=evaluate(s,delta);
    if(!base || !after) return null;
    return {base,after,gain:(after.damage/base.damage-1)*100,effects:effects.map(([key,amount,change])=>({key,amount,gain:(evaluate(s,change,true)?.damage/base.damage-1)*100})).sort((a,b)=>b.gain-a.gain)};
  }
  const api={fields,scenario,baseline,classes,mappings,defaults,decode,adapt,reconstructAttack,evaluate,calculate};
  root.StatModels=api;
  if(typeof module!=='undefined') module.exports=api;
})(globalThis);
