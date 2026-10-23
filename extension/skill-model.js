/* Experimental skill layer. Does not change either stat calculator.
 * Global client 2.0.7.0 / Steam 25926599, extracted 2026-10-16:
 * https://aion2.gg/database/skills/overhead-slam-11170000
 * Lv18: 2125 + 163.6% Attack; two identical damage effects.
 * Server defense ordering and effect-to-meter hit mapping remain unverified. */
(function(root){
  'use strict';
  const skill=Object.freeze({id:'11170000',level:18,flat:2125,coefficient:1.636,hits:2,
    source:'https://aion2.gg/database/skills/overhead-slam-11170000',client:'2.0.7.0'});
  function estimate(s,order='after'){
    const keys=['attack','defenseReduction','multiplier','criticalFactor','criticalChance','doubleChance','multiFactor'];
    if(!s || !keys.every(k=>typeof s[k]==='number' && Number.isFinite(s[k]) && s[k]>=0) || s.attack<=0 ||
      s.criticalChance>1 || s.doubleChance>1 || !['before','after'].includes(order))return null;
    // Two hypotheses are explicit: the client tooltip does not specify server ordering.
    const base=order==='after'?Math.max(skill.flat+skill.coefficient*s.attack-s.defenseReduction,1):
      skill.flat+skill.coefficient*Math.max(s.attack-s.defenseReduction,1);
    const normal=base*s.multiplier,critical=normal*s.criticalFactor;
    const expectedHit=normal*(1+s.criticalChance*(s.criticalFactor-1))*(1+s.doubleChance)*s.multiFactor;
    const result={base,normal,critical,doubleNormal:normal*2,doubleCritical:critical*2,expectedCast:expectedHit*skill.hits};
    return Object.values(result).every(Number.isFinite)?result:null;
  }
  const api={skill,estimate};root.SkillDamage=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
