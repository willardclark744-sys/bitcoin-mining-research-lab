// Pure-JS SHA-256 with explicit compression + midstate support. Works in Safari, Workers, Node.
(function(g){
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const IV=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const W=new Uint32Array(64);
// compress one 16-word block (big-endian words in m) into state s (Uint32Array 8), in place
function compress(s,m){
 for(let i=0;i<16;i++)W[i]=m[i];
 for(let i=16;i<64;i++){const a=W[i-15],b=W[i-2];
  W[i]=(((a>>>7|a<<25)^(a>>>18|a<<14)^(a>>>3))+W[i-7]+((b>>>17|b<<15)^(b>>>19|b<<13)^(b>>>10))+W[i-16])|0;}
 let a=s[0],b=s[1],c=s[2],d=s[3],e=s[4],f=s[5],h7=s[6],h=s[7];
 for(let i=0;i<64;i++){
  const t1=(h+((e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7))+((e&f)^(~e&h7))+K[i]+W[i])|0;
  const t2=(((a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10))+((a&b)^(a&c)^(b&c)))|0;
  h=h7;h7=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
 s[0]+=a;s[1]+=b;s[2]+=c;s[3]+=d;s[4]+=e;s[5]+=f;s[6]+=h7;s[7]+=h;
}
function words(bytes,off){const m=new Uint32Array(16);for(let i=0;i<16;i++){const o=off+i*4;m[i]=(bytes[o]<<24|bytes[o+1]<<16|bytes[o+2]<<8|bytes[o+3])>>>0;}return m;}
// generic sha256 of arbitrary bytes -> Uint8Array(32)
function sha256(bytes){const L=bytes.length,n=((L+9+63)>>6)<<6,p=new Uint8Array(n);p.set(bytes);p[L]=0x80;
 const bits=L*8;p[n-4]=bits>>>24;p[n-3]=bits>>>16&255;p[n-2]=bits>>>8&255;p[n-1]=bits&255;p[n-5]=Math.floor(bits/2**32)&255;
 const s=new Uint32Array(IV);for(let o=0;o<n;o+=64)compress(s,words(p,o));return out(s);}
function out(s){const r=new Uint8Array(32);for(let i=0;i<8;i++){r[i*4]=s[i]>>>24;r[i*4+1]=s[i]>>>16;r[i*4+2]=s[i]>>>8;r[i*4+3]=s[i];}return r;}
// BASELINE: full double SHA-256 of an 80-byte header (generic path, recomputes both inner chunks every time)
function dsha(header){return sha256(sha256(header));}
// OPTIMIZED: midstate = state after inner chunk 1 (bytes 0..63). Per nonce: inner chunk 2 (bytes 64..79 + padding), then outer SHA-256 of 32-byte digest.
function midstate(header){const s=new Uint32Array(IV);compress(s,words(header,0));return s;}
function makeTail(header){const m=new Uint32Array(16);const w=words(header,64);m[0]=w[0];m[1]=w[1];m[2]=w[2];m[3]=0;m[4]=0x80000000;m[15]=640;return m;}
const OM=new Uint32Array(16),ST=new Uint32Array(8);
function hashWithMid(mid,tail,nonce){ // nonce: uint32, written little-endian into header bytes 76..79
 tail[3]=((nonce&255)<<24|(nonce>>>8&255)<<16|(nonce>>>16&255)<<8|nonce>>>24)>>>0;
 ST.set(mid);compress(ST,tail);
 for(let i=0;i<8;i++)OM[i]=ST[i];OM[8]=0x80000000;for(let i=9;i<15;i++)OM[i]=0;OM[15]=256;
 const s=new Uint32Array(IV);compress(s,OM);return out(s);}
function setNonce(h,n){h[76]=n&255;h[77]=n>>>8&255;h[78]=n>>>16&255;h[79]=n>>>24&255;}
function hex(b){let s='';for(const x of b)s+=(x<16?'0':'')+x.toString(16);return s;}
function fromHex(h){const r=new Uint8Array(h.length/2);for(let i=0;i<r.length;i++)r[i]=parseInt(h.substr(i*2,2),16);return r;}
function rev(b){return Uint8Array.from(b).reverse();}
const api={sha256,dsha,midstate,makeTail,hashWithMid,setNonce,hex,fromHex,rev};
if(typeof module!=='undefined')module.exports=api;else g.SHA=api;
})(typeof self!=='undefined'?self:globalThis);
