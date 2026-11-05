// Node: runs first experiment, verifies against node:crypto, writes fixture.js
const crypto=require('crypto'),os=require('os'),fs=require('fs');
const S=require('./sha.js'),B=require('./bench-core.js');
const rand=b=>crypto.randomFillSync(b),now=()=>Number(process.hrtime.bigint())/1e6;
// correctness check vs historical block (genesis): known hash
const gen=S.fromHex('0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c');
const gHash=S.hex(S.rev(S.hashWithMid(S.midstate(gen),S.makeTail(gen),0x7c2bac1d)));
const genesisOK=gHash==='000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const rounds=[];let indepOK=true,indepChecked=0;
for(let r=0;r<7;r++){const res=B.round(64,2000,rand,now);
 for(const s of res.samples){const h=Buffer.from(s.header,'hex');const d=crypto.createHash('sha256').update(crypto.createHash('sha256').update(h).digest()).digest('hex');indepChecked++;if(d!==s.hash)indepOK=false;}
 rounds.push(res);}
const use=rounds.slice(2); // first 2 = JIT warmup, reported but excluded
const spF=use.map(r=>r.tFair/r.tMid).sort((a,b)=>a-b);
const sp=use.map(r=>r.tBase/r.tMid).sort((a,b)=>a-b);
const tot=k=>use.reduce((a,r)=>a+r[k],0),hashes=use.reduce((a,r)=>a+r.hashes,0);
// node:crypto native reference throughput
let t0=now();const hb=Buffer.alloc(80);for(let i=0;i<100000;i++){hb.writeUInt32LE(i,76);crypto.createHash('sha256').update(crypto.createHash('sha256').update(hb).digest()).digest();}
const nativeHps=100000/((now()-t0)/1000);
const fx={label:'MEASURED (Node, server-side, not your iPhone)',when:new Date().toISOString(),
 runtime:`Node ${process.version} on ${os.platform()} ${os.arch()}, CPU: ${os.cpus()[0].model}, cores: ${os.cpus().length}`,
 roundsTotal:rounds.length,warmupExcluded:2,hashesPerMethod:hashes,baseMs:tot('tBase'),midMs:tot('tMid'),
 baseHps:hashes/(tot('tBase')/1000),midHps:hashes/(tot('tMid')/1000),fairMs:tot('tFair'),fairHps:hashes/(tot('tFair')/1000),fairSpeedupMedian:spF[2],theoreticalCompressionRatio:1.5,speedupMedian:sp[Math.floor(sp.length/2)],speedupMin:sp[0],speedupMax:sp[sp.length-1],
 allChecksumsEqual:rounds.every(r=>r.checksumEqual&&r.sampleMismatch===0),independentVerifier:'node:crypto sha256',indepChecked,indepOK,genesisOK,genesisHash:gHash,nativeNodeCryptoHps:nativeHps,
 perRound:rounds.map(r=>({hashes:r.hashes,tBase:+r.tBase.toFixed(2),tMid:+r.tMid.toFixed(2),tFair:+r.tFair.toFixed(2)}))};
fs.writeFileSync(__dirname+'/fixture.js','window.NODE_FIXTURE='+JSON.stringify(fx,null,1)+';\n');
console.log(JSON.stringify(fx,null,1));
