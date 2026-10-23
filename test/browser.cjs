const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const models=require('../extension/models.js');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=req.url==='/original'?path.join(root,'index.html'):path.join(root,'dist',req.url==='/'?'index.html':req.url.split('?')[0]);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
});
const encode=p=>'NOTMETER_STATS_V4:'+Buffer.from(JSON.stringify(p)).toString('base64');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.STATS_BROWSER_CHANNEL?{channel:process.env.STATS_BROWSER_CHANNEL}:{})});
  try{
    const base='http://127.0.0.1:'+server.address().port;
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('https://script.google.com/**',r=>r.abort());
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.waitForFunction(()=>globalThis.StatsExtension);
    assert.equal(await page.locator('#atk').inputValue(),'');
    assert.equal(await page.locator('#pen').inputValue(),'');
    assert.equal(await page.locator('#speedNow').inputValue(),'');
    assert.equal(await page.locator('#outDmgNormal').innerText(),'—');
    await page.locator('#mode-notmeter').click();
    assert.equal(await page.locator('#nm-attack').inputValue(),'');
    assert.equal(await page.locator('#nm-criticalChancePercent').inputValue(),'');
    assert.equal(await page.locator('#nm-bossHardHitResistancePercent').inputValue(),'0');
    assert.equal(await page.locator('#nm-output .nm-cards').count(),0);
    await page.locator('#mode-bongbong').click();
    const original=await context.newPage();await original.goto(base+'/original');
    const state=await page.evaluate(()=>snap());
    assert.deepEqual(await page.evaluate(s=>calc(s),state),await original.evaluate(s=>calc(s),state));
    for(let i=0;i<20;i++){
      const s={...state,atk:10000+i*150,critStat:700+i*50,smite:i*8,dir:i%2?'back':'front'};
      assert.deepEqual(await page.evaluate(s=>[calc(s),calc(s,'guaranteed')],s),await original.evaluate(s=>[calc(s),calc(s,'guaranteed')],s));
    }
    const profile={schema:'notmeter-stat-efficiency-profile-v4',jobName:'검성',...models.defaults(),attack:8000,additionalAttack:400,minimumAttack:1000,maximumAttack:2000,attackIncreasePercent:20,damageAmplificationPercent:60,hardHitPercent:0,power:50,unknownExample:123};
    const paste=async p=>{await page.locator('#stats-paste').fill(encode(p));await page.locator('#stats-import').click();};
    const pen=await page.locator('#pen').inputValue();await paste(profile);
    assert.equal(await page.locator('#atk').inputValue(),'11880');assert.equal(await page.locator('#pen').inputValue(),pen);
    assert.equal(await page.locator('#smite').inputValue(),'0');assert.equal(await page.locator('#speedClass').inputValue(),'검성');
    assert.match(await page.locator('#stats-import-details').textContent(),/unknownExample/);
    // A paste never fills unprovided Bongbong stats with fabricated examples.
    assert.equal(await page.locator('#outDmgNormal').innerText(),'—');
    for(const id of ['pen','critStat','multi'])await page.locator('#'+id).fill('0');
    assert.equal(await page.locator('#skill-output .card').count(),5);
    const skillValues=await page.evaluate(()=>{
      const s=snap(),normal=Number(document.getElementById('skill-normal').textContent.replaceAll(',',''));
      const probe=calc({...s,critAmp:s.eCritRes-50,smite:0,partySmite:0,eSmiteRes:0,multi:0});
      return {normal,expected:Math.max(2125+1.636*s.atk-Math.max(s.eDef-s.pen,0)/10,1)*probe.mult,before:calc(s)};
    });
    assert.ok(Math.abs(skillValues.normal-skillValues.expected)<=.051);
    await page.locator('#skill-estimate details').evaluate(el=>el.open=true);
    await page.locator('#skill-observed').fill(String(skillValues.normal));
    assert.match(await page.locator('#skill-difference').innerText(),/[+-]0.00%/);
    await page.locator('#skill-order').selectOption('before');
    assert.notEqual(await page.locator('#skill-normal').innerText(),skillValues.normal.toLocaleString('en-US',{maximumFractionDigits:1}));
    assert.deepEqual(await page.evaluate(()=>calc(snap())),skillValues.before,'skill controls must not modify upstream results');
    await page.locator('#skill-order').selectOption('after');
    await page.locator('#stats-language').selectOption('ko');
    assert.match(await page.locator('#skill-estimate h2').innerText(),/내려찍기/);
    await page.locator('#stats-language').selectOption('en');
    assert.equal(await page.locator('#skill-observed').inputValue(),String(skillValues.normal));
    await page.locator('#mode-notmeter').click();assert.equal(await page.locator('#skill-estimate').isVisible(),false);
    await page.locator('#mode-bongbong').click();
    await page.locator('#speedNow').fill('100');await page.locator('#speedClassBuff').selectOption('1');
    assert.equal(await page.locator('#speedAfterOut').innerText(),'140.0%');
    await page.locator('#saveCompare1').click();await page.locator('#amp').fill('70');await page.locator('#saveCompare2').click();await page.locator('#compareSlots').click();
    assert.match(await page.locator('#compareResult').innerText(),/Setup 2 is higher/);
    const before=await page.evaluate(()=>snap());
    await page.locator('#stats-language').selectOption('ko');assert.deepEqual(await page.evaluate(()=>snap()),before);
    assert.equal(await page.locator('#amp').inputValue(),'70');
    await page.locator('#stats-language').selectOption('en');
    await page.locator('#mode-notmeter').click();
    await page.locator('#nm-criticalChancePercent').fill('80');
    assert.equal(await page.locator('#nm-attack').inputValue(),'8000');assert.equal(await page.locator('#nm-damageAmplificationPercent').inputValue(),'60');
    await page.locator('#nm-attack').fill('9000');
    assert.equal(await page.locator('#atk').inputValue(),'11880');
    await page.locator('#nm-save1').click();await page.locator('#nm-perfectPercent').fill('70');await page.locator('#nm-save2').click();await page.locator('#nm-compare').click();
    assert.match(await page.locator('#nm-comparison').innerText(),/\+/);
    await page.locator('#delta-hardHitPercent').fill('200');assert.ok((await page.locator('#nm-output').innerText()).includes('Damage gain'));
    await page.locator('#nm-power').fill('60');
    const changed=await page.locator('#nm-output').innerText();assert.ok(!changed.includes('Enter valid'));
    await page.locator('#stats-language').selectOption('ko');await page.locator('#stats-language').selectOption('en');
    assert.equal(await page.locator('#nm-attack').inputValue(),'9000');assert.equal(await page.locator('#delta-hardHitPercent').inputValue(),'200');
    await page.reload();await page.waitForFunction(()=>globalThis.StatsExtension);
    assert.equal(await page.locator('#mode-notmeter').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#nm-attack').inputValue(),'9000');
    const snapshot=await page.evaluate(()=>({b:snap(),n:document.getElementById('nm-attack').value}));
    await page.locator('#stats-paste').fill('NOTMETER_STATS_V4:???');await page.locator('#stats-import').click();
    assert.deepEqual(await page.evaluate(()=>({b:snap(),n:document.getElementById('nm-attack').value})),snapshot);
    await paste({schema:profile.schema,attack:1000});
    assert.equal(await page.locator('#atk').inputValue(),'11880');assert.equal(await page.locator('#nm-attack').inputValue(),'1000');
    await paste(profile);assert.equal(await page.locator('#nm-attack').inputValue(),'8000');
    await page.reload();await page.waitForFunction(()=>globalThis.StatsExtension);
    assert.equal(await page.locator('#nm-criticalChancePercent').inputValue(),'80');
    await page.locator('#mode-bongbong').click();
    for(const cls of Object.keys(models.classes)){
      await page.locator('#speedClass').selectOption(cls);
      const options=await page.locator('#speedClassBuff option').count();
      for(let i=0;i<options;i++){
        await page.locator('#speedClassBuff').selectOption(String(i));
        await page.waitForTimeout(10);
        assert.deepEqual(await page.evaluate(()=>StatsExtension.untranslated()),[],cls+' has untranslated display text');
      }
    }
    await page.locator('#speedClass').selectOption('검성');
    await page.screenshot({path:path.join(root,'dist/review-desktop.png'),fullPage:true});
    for(const mode of ['bongbong','notmeter']){
      await page.locator('#mode-'+mode).click();
      for(const width of [1440,800,360]){
        await page.setViewportSize({width,height:800});
        const wrapped=await page.evaluate(()=>[...document.querySelectorAll('.f label,.m-lbl,.bar-row .name,.import-origin')]
          .filter(el=>el.getClientRects().length)
          .filter(el=>el.scrollWidth>el.clientWidth+1||el.getBoundingClientRect().height>parseFloat(getComputedStyle(el).lineHeight)*1.3)
          .map(el=>el.textContent));
        assert.deepEqual(wrapped,[],mode+' labels must fit one row at '+width+'px');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,mode+' mobile overflow');
      await page.screenshot({path:path.join(root,'dist/review-'+mode+'-mobile.png'),fullPage:true});
    }
    assert.deepEqual(errors,[]);
    await page.locator('#mode-bongbong').click();await page.locator('#reset').click();
    assert.equal(await page.locator('#atk').inputValue(),'');
    assert.equal(await page.locator('#outDmgNormal').innerText(),'—');
    await page.reload();await page.waitForFunction(()=>globalThis.StatsExtension);
    assert.equal(await page.locator('#atk').inputValue(),'');
    assert.equal(await page.locator('#skill-output .card').count(),0);
    const migration=await browser.newContext();
    await migration.addInitScript(()=>{
      localStorage.setItem('aion_stats_bong',JSON.stringify({atk:'13538',pen:'2560',amp:'77'}));
      localStorage.setItem('aion_stats_nm',JSON.stringify({attack:10000,damageAmplificationPercent:77,bossHardHitResistancePercent:30}));
      localStorage.setItem('aion_stats_origins',JSON.stringify({bong:{amp:'manual'},notmeter:{damageAmplificationPercent:'manual'}}));
    });
    const migrated=await migration.newPage();await migrated.goto(base);await migrated.waitForFunction(()=>globalThis.StatsExtension);
    assert.equal(await migrated.locator('#atk').inputValue(),'');
    assert.equal(await migrated.locator('#amp').inputValue(),'77');
    await migrated.locator('#mode-notmeter').click();
    assert.equal(await migrated.locator('#nm-attack').inputValue(),'');
    assert.equal(await migrated.locator('#nm-bossHardHitResistancePercent').inputValue(),'0');
    assert.equal(await migrated.locator('#nm-damageAmplificationPercent').inputValue(),'77');
    await migration.close();
    console.log('Browser checks passed: upstream parity, shared import, language, modes, saves, all classes, mobile.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
