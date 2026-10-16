const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../extension/models.js');
const fixtures=require('./notmeter-fixtures.json');
const encode=p=>'NOTMETER_STATS_V4:'+Buffer.from(JSON.stringify(p)).toString('base64');
const profile={schema:'notmeter-stat-efficiency-profile-v4',jobName:'검성',...m.defaults()};
function close(actual,expected){assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*1e-10,`${actual} ≠ ${expected}`);}
for(const fixture of fixtures.fixtures)test('NotMeter reference parity: '+fixture.name,()=>{
  const result=m.calculate(fixture.input);assert.ok(result);
  for(const key of ['attack','effective','damage'])close(result.base[key],fixture.expected[key]);
  const keys={attackIncrease:'attackIncreasePercent',damageAmplification:'damageAmplificationPercent',weaponDamageAmplification:'weaponDamageAmplificationPercent',pveDamageAmplification:'pveDamageAmplificationPercent',bossDamageAmplification:'bossDamageAmplificationPercent',criticalDamageAmplification:'criticalDamageAmplificationPercent',perfect:'perfectPercent',hardHit:'hardHitPercent',frontDamageAmplification:'frontDamageAmplificationPercent',backDamageAmplification:'backDamageAmplificationPercent'};
  for(const effect of fixture.expected.effects)close(result.effects.find(e=>e.key===(keys[effect.key]||effect.key)).gain,effect.gain);
});
test('UTF-8 profile maps both modes and derives Attack without Perfect or weapon boosts',()=>{
  const p={...profile,attack:8000,additionalAttack:400,minimumAttack:1000,maximumAttack:2000,attackIncreasePercent:20,perfectPercent:90,weaponDamageAmplificationPercent:75,hardHitPercent:0,unknownProducerField:{value:123}};
  const decoded=m.decode(encode(p)), a=m.adapt(decoded);
  assert.equal(a.bong.atk,11880);assert.equal(a.bong.wAmp,75);assert.equal(a.bong.smite,0);
  assert.equal(a.notmeter.perfectPercent,90);assert.equal(a.classKey,'검성');
  assert.deepEqual(decoded.unknownProducerField,{value:123});
  assert.ok(a.missingBong.includes('critStat'));assert.ok(a.missingBong.includes('speedNow'));
});
test('missing attack components do not invent an aggregate Attack',()=>{
  const p=m.decode(encode({schema:profile.schema,attack:1000}));
  assert.equal(m.adapt(p).bong.atk,undefined);assert.ok(m.adapt(p).missingBong.includes('atk'));
});
test('malformed, wrong-version, invalid values, and invalid weapon ranges are rejected',()=>{
  for(const value of ['NOTMETER_STATS_V3:e30=','NOTMETER_STATS_V4:???',encode([]),encode({...profile,attack:0}),encode({...profile,perfectPercent:'oops'}),encode({...profile,minimumAttack:5000,maximumAttack:2000}),encode({...profile,hardHitPercent:null})])assert.throws(()=>m.decode(value));
  assert.equal(m.calculate({...m.defaults(),maximumAttack:0}),null);
});
test('Perfect and divine-equivalent option changes affect the adjusted result only',()=>{
  const input={...m.defaults(),perfectPercent:0,hardHitPercent:50};
  const base=m.calculate(input), changed=m.calculate(input,{perfectPercent:20,attackIncreasePercent:1,hardHitPercent:.2});
  close(base.base.damage,changed.base.damage);assert.ok(changed.after.damage>base.base.damage);
  assert.equal(m.calculate(input,{attack:-20000}),null);
});
