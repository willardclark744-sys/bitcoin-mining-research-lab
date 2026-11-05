// Shared experiment core (browser worker + Node). Fresh random 80-byte headers, same nonces for both methods.
(function(g){
const S=(typeof module!=='undefined')?require('./sha.js'):g.SHA;
function freshHeader(rand){const h=new Uint8Array(80);rand(h);h[0]=0x00;h[1]=0x00;h[2]=0x00;h[3]=0x20;return h;}
// run one round: H headers x N nonces. Returns timings + verification.
function round(H,N,rand,now,indepVerify){
 const headers=[];for(let i=0;i<H;i++)headers.push(freshHeader(rand));
 const startNonce=[];for(let i=0;i<H;i++){const b=new Uint8Array(4);rand(b);startNonce.push((b[0]|b[1]<<8|b[2]<<16|b[3]<<24)>>>0);}
 let acc1=0,acc2=0,mism=0;const sampleA=[],sampleB=[];
 let t0=now();
 for(let i=0;i<H;i++){const h=headers[i].slice();for(let k=0;k<N;k++){const n=(startNonce[i]+k)>>>0;S.setNonce(h,n);const d=S.dsha(h);acc1^=d[31]|d[0]<<8;if(k<2)sampleA.push(S.hex(d));}}
 const tBase=now()-t0;
 t0=now();
 for(let i=0;i<H;i++){const mid=S.midstate(headers[i]);const tail=S.makeTail(headers[i]);for(let k=0;k<N;k++){const d=S.hashWithMid(mid,tail,(startNonce[i]+k)>>>0);acc2^=d[31]|d[0]<<8;if(k<2)sampleB.push(S.hex(d));}}
 const tMid=now()-t0;
 // FAIR baseline: same compress code, no allocation advantage, but recompute chunk 1 every nonce (3 compressions vs 2)
 let acc3=0;t0=now();
 for(let i=0;i<H;i++){const h=headers[i].slice();const tail=S.makeTail(h);for(let k=0;k<N;k++){const n=(startNonce[i]+k)>>>0;S.setNonce(h,n);const d=S.hashWithMid(S.midstate(h),tail,n);acc3^=d[31]|d[0]<<8;}}
 const tFair=now()-t0;
 // verification: full checksum equality + independent verifier (WebCrypto/Node crypto) on samples
 for(let i=0;i<sampleA.length;i++)if(sampleA[i]!==sampleB[i])mism++;
 const samples=[];for(let i=0;i<Math.min(H,4);i++){const h=headers[i].slice();S.setNonce(h,startNonce[i]);samples.push({header:S.hex(h),hash:sampleB[i*2]});}
 return {H,N,hashes:H*N,tBase,tMid,tFair,checksumEqual:acc1===acc2&&acc2===acc3,sampleMismatch:mism,samples};
}
const api={round,freshHeader};
if(typeof module!=='undefined')module.exports=api;else g.BENCH=api;
})(typeof self!=='undefined'?self:globalThis);
