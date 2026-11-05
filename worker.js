importScripts('sha.js','bench-core.js');
let stop=false;
onmessage=async e=>{const m=e.data;if(m.cmd==='stop'){stop=true;return;}
 if(m.cmd==='run'){stop=false;const rand=b=>crypto.getRandomValues(b);const now=()=>performance.now();
  for(let r=0;r<m.rounds;r++){ if(stop){postMessage({type:'stopped',round:r});return;}
   const res=BENCH.round(m.H,m.N,rand,now);res.round=r;postMessage({type:'round',res});
   await new Promise(z=>setTimeout(z,0)); }
  postMessage({type:'done'});}
};
