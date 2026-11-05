const $=id=>document.getElementById(id);const fmt=(x,d=2)=>Number(x).toLocaleString(undefined,{maximumFractionDigits:d});
let LIVE=null,LOG=null,worker=null;
// ---------- live data ----------
async function loadLive(){$('liveBody').textContent='Loading…';
 const srcs=[['mempool.space','https://mempool.space/api/v1/blocks'],['blockstream.info','https://blockstream.info/api/blocks']];
 for(const [n,u] of srcs){try{const r=await fetch(u,{cache:'no-store'});const b=(await r.json())[0];
  LIVE={src:n,url:u,height:b.height,difficulty:b.difficulty,blockTime:new Date(b.timestamp*1000),fetched:new Date()};
  LIVE.netHps=LIVE.difficulty*2**32/600;renderLive();updQ2();return;}catch(e){}}
 $('liveBody').innerHTML='<span class="bad">Could not reach public APIs. Q2 odds use no network value until refreshed.</span>';}
function renderLive(){const L=LIVE;$('liveBody').innerHTML=`<div class="grid"><div class="kv">Block height<b>${fmt(L.height,0)}</b></div><div class="kv">Difficulty<b>${(L.difficulty/1e12).toFixed(2)} T</b></div>
<div class="kv">Implied network hashrate<b>${fmt(L.netHps/1e18,0)} EH/s</b><span class="mu">difficulty×2³²/600</span></div><div class="kv">Block mined<b style="font-size:.9rem">${L.blockTime.toLocaleString()}</b></div></div>
<div class="mu">Source: ${L.src} (${L.url}) · fetched ${L.fetched.toLocaleString()}</div>`;}
// ---------- device ----------
function device(){return{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency??'unavailable',platform:navigator.platform,runtime:worker?'Web Worker':'main thread (chunked)',when:new Date().toISOString()};}
// ---------- exp1 ----------
const CFG={H:32,N:1000,rounds:6};
function runExp1(){LOG={experiment:'midstate-vs-full-dsha256',label:'MEASURED on this device',config:CFG,device:null,rounds:[],verification:[]};
 $('runBtn').disabled=true;$('stopBtn').disabled=false;$('prog').value=0;$('exp1').innerHTML='<div class="mu">Running… UI stays responsive.</div>';
 try{worker=new Worker('worker.js');}catch(e){worker=null;}
 LOG.device=device();
 if(worker){worker.onmessage=e=>onMsg(e.data);worker.onerror=()=>{worker=null;fallback();};worker.postMessage({cmd:'run',...CFG});}else fallback();}
let fbStop=false;
async function fallback(){LOG.device=device();fbStop=false;const rand=b=>crypto.getRandomValues(b),now=()=>performance.now();
 for(let r=0;r<CFG.rounds;r++){if(fbStop){onMsg({type:'stopped',round:r});return;}const res=BENCH.round(CFG.H,CFG.N,rand,now);res.round=r;onMsg({type:'round',res});await new Promise(z=>setTimeout(z,20));}onMsg({type:'done'});}
function stopExp1(){if(worker)worker.postMessage({cmd:'stop'});fbStop=true;}
async function verify(res){ // independent verifier: WebCrypto if available (HTTPS), else generic sha256 path
 const out=[];for(const s of res.samples){const h=SHA.fromHex(s.header);let d,by;
  if(window.crypto&&crypto.subtle){const a=await crypto.subtle.digest('SHA-256',h);d=SHA.hex(new Uint8Array(await crypto.subtle.digest('SHA-256',a)));by='WebCrypto (native)';}
  else{d=SHA.hex(SHA.dsha(h));by='generic JS sha256 (WebCrypto needs HTTPS)';}
  out.push({ok:d===s.hash,by});}return out;}
async function onMsg(m){if(m.type==='round'){const v=await verify(m.res);m.res.indep=v;LOG.rounds.push(m.res);$('prog').value=(m.res.round+1)/CFG.rounds;renderExp1(false);}
 else{if(worker){worker.terminate();worker=null;}$('runBtn').disabled=false;$('stopBtn').disabled=true;renderExp1(true,m.type==='stopped');}}
function stats(rs){const use=rs.length>1?rs.slice(1):rs;const sum=k=>use.reduce((a,r)=>a+r[k],0);const n=use.reduce((a,r)=>a+r.hashes,0);
 const sp=use.map(r=>r.tBase/r.tMid).sort((a,b)=>a-b),sf=use.map(r=>r.tFair/r.tMid).sort((a,b)=>a-b);const med=a=>a[Math.floor(a.length/2)];
 return{n,base:sum('tBase'),mid:sum('tMid'),fair:sum('tFair'),sp:med(sp),spMin:sp[0],spMax:sp[sp.length-1],sf:med(sf),sfMin:sf[0],sfMax:sf[sf.length-1],
  eq:rs.every(r=>r.checksumEqual&&r.sampleMismatch===0),indep:rs.every(r=>r.indep.every(x=>x.ok)),by:rs[0].indep[0]?.by,warm:rs.length>1};}
function renderExp1(done,stopped){if(!LOG.rounds.length){$('exp1').innerHTML='<div class="mu">Stopped before any round finished.</div>';return;}
 const s=stats(LOG.rounds);LOG.summary=s;const v=x=>x>1?`<span class="ok">${x.toFixed(2)}× faster</span>`:`<span class="bad">${(1/x).toFixed(2)}× slower</span>`;
 $('exp1').innerHTML=`<h3><span class="tag MEAS">MEASURED</span>${done?(stopped?'Stopped early':'Complete'):'In progress'} · this device</h3>
<div class="grid"><div class="kv">Hashes per method<b>${fmt(s.n,0)}</b></div><div class="kv">Verification<b class="${s.eq&&s.indep?'ok':'bad'}">${s.eq&&s.indep?'Identical ✓':'MISMATCH ✗'}</b></div>
<div class="kv">Full dSHA (generic)<b>${fmt(s.base,0)} ms</b>${fmt(s.n/s.base*1000,0)} H/s</div><div class="kv">Midstate<b>${fmt(s.mid,0)} ms</b>${fmt(s.n/s.mid*1000,0)} H/s</div>
<div class="kv">vs generic baseline<b>${v(s.sp)}</b>range ${s.spMin.toFixed(2)}–${s.spMax.toFixed(2)}</div><div class="kv">vs fair 3-compression baseline<b>${v(s.sf)}</b>range ${s.sfMin.toFixed(2)}–${s.sfMax.toFixed(2)} · ideal 1.50×</div></div>
<div class="mu">${LOG.rounds.length} round(s)${s.warm?', first excluded as JIT warm-up':''}. Independent verifier: ${s.by}. Equality checked on every hash via XOR checksum of all three methods + per-sample comparison.</div>
<div class="mono">Device: ${LOG.device.userAgent}<br>hardwareConcurrency: ${LOG.device.hardwareConcurrency} · ${LOG.device.runtime}</div>`;
 $('exp1dl').style.display='block';takeaways();}
function dl(kind){let data,type;if(kind==='json'){data=JSON.stringify(LOG,null,1);type='application/json';}
 else{data='round,hashes,full_ms,midstate_ms,fair_ms,checksum_equal,indep_ok,userAgent\n'+LOG.rounds.map(r=>[r.round,r.hashes,r.tBase.toFixed(3),r.tMid.toFixed(3),r.tFair.toFixed(3),r.checksumEqual,r.indep.every(x=>x.ok),'"'+LOG.device.userAgent+'"'].join(',')).join('\n');type='text/csv';}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download='exp1-log-'+Date.now()+'.'+kind;a.click();}
function renderFixture(){const f=window.NODE_FIXTURE;if(!f){$('fixture').textContent='fixture.js missing';return;}
 $('fixture').innerHTML=`<div class="grid"><div class="kv">Hashes/method<b>${fmt(f.hashesPerMethod,0)}</b></div><div class="kv">Verified<b class="ok">${f.allChecksumsEqual&&f.indepOK?'Identical ✓':'✗'}</b>${f.indepChecked} samples vs ${f.independentVerifier}</div>
<div class="kv">Full / midstate / fair<b style="font-size:.95rem">${fmt(f.baseMs,0)} / ${fmt(f.midMs,0)} / ${fmt(f.fairMs,0)} ms</b></div><div class="kv">Speedup<b>${f.speedupMedian.toFixed(2)}× generic · ${f.fairSpeedupMedian.toFixed(2)}× fair</b></div></div>
<div class="mono">${f.runtime} · ${f.when} · genesis check ${f.genesisOK?'✓':'✗'}</div>`;}
// ---------- Q1 version demo ----------
function versionDemo(){const h=BENCH.freshHeader(b=>crypto.getRandomValues(b));let rows=[];
 for(let v=0;v<4;v++){h[1]=(v<<5)&0xff; /* roll BIP320 bits 13-15 region in byte 1 */ const mid=SHA.midstate(h),t=SHA.makeTail(h);
  const a=SHA.hex(SHA.hashWithMid(mid,t,0)),c=h.slice();SHA.setNonce(c,0);const b=SHA.hex(SHA.dsha(c));rows.push(`v-roll ${v}: midstate ${SHA.hex(new Uint8Array(mid.buffer.slice(0,4)))}… hash ${a.slice(0,16)}… ${a===b?'✓':'✗'}`);}
 $('vdemo').innerHTML='<span class="tag SIM">SIMULATED</span>'+rows.join('<br>')+'<br><span class="mu">Each version value = a new first-chunk midstate for free in the chip. Phone shows correctness only; ASIC energy savings are not measured here.</span>';}
// ---------- Q2 ----------
const Q2=['sh','ss','sw','sd','mh','mr','mu','mw'];
function odds(hps){if(!LIVE)return null;const p=hps/LIVE.netHps;return{block:p,day:1-Math.pow(1-p,144),year:1-Math.pow(1-p,52560),yrs:1/(p*52560)};}
function oddsHtml(o){return o?`per block 1 in ${fmt(1/o.block,0)} · per day ${(o.day*100).toExponential(2)}% · per year ${(o.year*100).toFixed(4)}% · expected wait ≈ ${fmt(o.yrs,0)} years`:'Need live difficulty.';}
function updQ2(){const H=+$('sh').value,s=+$('ss').value,w=+$('sw').value,d=+$('sd').value;$('vh').textContent=H;$('vs').textContent=s;$('vw').textContent=w;$('vd').textContent=d;
 const f=(1-s/100)*(1-w/1440)*(1-d/600),u=H*1e12*f;
 $('q2out').innerHTML=`<div class="kv" style="margin-top:8px"><span class="tag SIM">SIMULATED</span>Useful: <b>${(u/1e12).toFixed(4)} TH/s</b> (${((1-f)*100).toFixed(2)}% lost: stale ${s}%, Wi-Fi ${(w/14.4).toFixed(2)}%, switch ${(d/6).toFixed(2)}%)<br><span class="mu">${oddsHtml(odds(u))}</span><br><span class="mu">Recovering ALL losses changes odds by only ×${(1/f).toFixed(4)}.</span></div>`;
 const mh=+$('mh').value,mr=+$('mr').value,mu=+$('mu').value,mw=+$('mw').value;
 if(mh){const mu2=mh*1e12*(1-(mr||0)/100)*((mu||100)/100);$('q2meas').innerHTML=`<span class="tag MEAS">MEASURED (you entered)</span> useful ${(mu2/1e12).toFixed(4)} TH/s vs estimate ${(u/1e12).toFixed(4)} TH/s (Δ ${(((mu2-u)/u)*100).toFixed(2)}%)<br>${oddsHtml(odds(mu2))}${mw?`<br>Efficiency ${(mw/mh).toFixed(2)} J/TH`:'<br>Missing: wall-power W for J/TH.'}`;}
 else $('q2meas').textContent='Not yet supplied. Enter AxeOS values to compare measured vs estimate.';
 Q2.forEach(k=>localStorage.setItem('q2'+k,$(k).value));}
// ---------- Q3 ----------
async function runQ3(){$('q3btn').disabled=true;const T=30,B=4096,ZB=12;const rand=b=>crypto.getRandomValues(b);
 const strategies={baseline:{cost:0},'historical-pattern':{cost:0},timestamp:{cost:0},'AI-pick (heuristic model)':{cost:512}};
 const res={};for(const k in strategies)res[k]={shares:0,spent:0,verified:0};
 const lz=d=>{let z=0;for(const x of SHA.rev(d)){if(x===0){z+=8;continue;}z+=Math.clz32(x)-24;break;}return z;};
 for(let t=0;t<T;t++){const h=BENCH.freshHeader(rand);
  for(const k in strategies){const c=h.slice();let budget=B-strategies[k].cost;res[k].spent+=B;
   let nonces=[];const st=new Uint32Array(1);rand(new Uint8Array(st.buffer));
   if(k==='baseline')for(let i=0;i<budget;i++)nonces.push((st[0]+i)>>>0);
   if(k==='historical-pattern')for(let i=0;i<budget;i++){const r=new Uint32Array(1);rand(new Uint8Array(r.buffer));nonces.push(((r[0]&0x00ffffff)|0x80000000)>>>0);} // claim: winners cluster in high range
   if(k==='timestamp'){for(let j=0;j<8;j++){} for(let i=0;i<budget;i++){if(i%512===0){c[68]=(c[68]+1)&255;}nonces.push((st[0]+i%512)>>>0);}}
   if(k.startsWith('AI'))for(let i=0;i<budget;i++){const r=new Uint32Array(1);rand(new Uint8Array(r.buffer));nonces.push(r[0]%2===0?r[0]:(r[0]^0x5a5a5a5a)>>>0);} // stand-in "model"; cost charged above
   let mid=SHA.midstate(c),tail=SHA.makeTail(c),lastTs=c[68];
   for(let i=0;i<nonces.length;i++){if(k==='timestamp'&&i%512===0){c[68]=(lastTs+i/512)&255;tail=SHA.makeTail(c);}
    const d=SHA.hashWithMid(mid,tail,nonces[i]);if(lz(d)>=ZB){res[k].shares++;const v=c.slice();SHA.setNonce(v,nonces[i]);if(SHA.hex(SHA.dsha(v))===SHA.hex(d))res[k].verified++;}}}
  $('q3p').value=(t+1)/T;await new Promise(z=>setTimeout(z,0));}
 const b=res.baseline,pb=b.shares/b.spent,exp=2**-ZB;let rows='',any=false;
 for(const k in res){const r=res[k],p=r.shares/r.spent;let z='',pv='';if(k!=='baseline'){const pp=(r.shares+b.shares)/(r.spent+b.spent),se=Math.sqrt(pp*(1-pp)*(1/r.spent+1/b.spent));const zz=(p-pb)/se;const pval=2*(1-Phi(Math.abs(zz)));z=zz.toFixed(2);pv=pval.toFixed(3);if(pval<0.05/3&&p>pb)any=true;}
  rows+=`<tr><td>${k}</td><td>${r.shares}/${r.verified}</td><td>${(p*1e3).toFixed(3)}</td><td>${z}</td><td>${pv}</td></tr>`;}
 window.Q3=res;$('q3out').innerHTML=`<span class="tag EXP">EXPERIMENTAL</span><table><tr><th>Strategy</th><th>Shares/verified</th><th>per 1k hashes (incl. cost)</th><th>z</th><th>p</th></tr>${rows}</table>
<div class="mu">Expected by chance: ${(exp*1e3).toFixed(3)} per 1k. ${T} fresh trials × ${B} hash budget each. Result: <b>${any?'A strategy crossed α=0.017 — treat as likely false positive until it replicates on a rerun.':'No measurable advantage (valid result).'}</b></div>`;$('q3btn').disabled=false;}
function Phi(x){const t=1/(1+0.2316419*x),d=0.3989423*Math.exp(-x*x/2);return 1-d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));}
function genesis(){const g=SHA.fromHex('0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c');
 const h=SHA.hex(SHA.rev(SHA.hashWithMid(SHA.midstate(g),SHA.makeTail(g),0x7c2bac1d)));$('genesis').innerHTML=`Genesis block (nonce 2083236893) via midstate path:<br>${h}<br>${h==='000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'?'<span class="ok">matches known hash ✓</span>':'<span class="bad">mismatch ✗</span>'} — proves the hasher is correct; says nothing about predicting nonces.`;}
// ---------- takeaways ----------
function takeaways(){const s=LOG&&LOG.summary,f=window.NODE_FIXTURE;const src=s?`your device: ${s.sf.toFixed(2)}× vs fair baseline (${s.sp.toFixed(2)}× vs generic)`:`Node fixture: ${f.fairSpeedupMedian.toFixed(2)}× vs fair baseline (${f.speedupMedian.toFixed(2)}× vs generic)`;
 $('takeaways').innerHTML=`<li><b>What worked:</b> midstate reuse produced bit-identical hashes and was faster — but Bitaxe/AxeOS already does this (plus version rolling in the chip). It is not an overlooked loophole.</li>
<li><b>How much it helped:</b> ${src}; the ideal is 1.5× (2 vs 3 compressions). On a Bitaxe that gain is already in the 1.2–1.5 TH/s rating, so ≈0% new. Recovering waste (Q2) is worth ~1% at typical settings. Candidate-picking (Q3): no measurable advantage expected or seen.</li>
<li><b>Next experiment most likely to teach something new:</b> with a Bitaxe, log AxeOS hashrate, reject %, and a wall-power meter for 24 h, then enter them in Q2. Measured waste and J/TH are the only open unknowns here.</li>`;}
// init
Q2.forEach(k=>{const v=localStorage.getItem('q2'+k);if(v!==null&&v!=='')$(k).value=v;$(k).addEventListener('input',updQ2);});
renderFixture();genesis();takeaways();updQ2();loadLive();
