// Level generator + BFS solver for the slide-to-graze prototype.
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function slide(L,grass,sheep,i,d){ // returns {path, trample}
  const [dx,dy]=DIRS[d];let x=sheep[i]%L.w,y=(sheep[i]/L.w)|0;const path=[];let trample=false;
  for(;;){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=L.w||ny>=L.h)break;const p=ny*L.w+nx;const c=L.cells[p];
    if(c==='#')break;if(sheep.some((s,j)=>j!==i&&s===p))break;x=nx;y=ny;path.push(p);
    if(c==='f'){trample=true;break}if(c==='m')break}
  return{path,trample}}
function solve(L,grass0,sheep0,cap=250000){
  const key=(g,s)=>s.join(',')+'|'+g.join('');
  const seen=new Map();let q=[[grass0,sheep0]];seen.set(key(grass0,sheep0),null);let depth=0;
  if(grass0.every(v=>!v))return{min:0};
  while(q.length){depth++;const nq=[];
    for(const [g,s] of q){for(let i=0;i<s.length;i++)for(let d=0;d<4;d++){
      const r=slide(L,g,s,i,d);if(!r.path.length||r.trample)continue;
      const g2=g.slice();for(const p of r.path)if(g2[p])g2[p]--;const s2=s.slice();s2[i]=r.path[r.path.length-1];
      const k=key(g2,s2);if(seen.has(k))continue;seen.set(k,[key(g,s),i,d]);
      if(g2.every(v=>!v)){const sol=[];let c=k;while(seen.get(c)){const [pk,pi,pd]=seen.get(c);sol.unshift((s.length>1?pi:'')+'RLDU'[pd]);c=pk}return{min:depth,sol:sol.join(' ')}}
      nq.push([g2,s2]);if(seen.size>cap)return{min:-1,capped:true}}}
    q=nq}
  return{min:-1}}
function gen(spec,R){
  const {w,h}=spec,N=w*h;const cells=Array(N).fill('.');
  const free=()=>{for(;;){const p=(R()*N)|0;if(cells[p]==='.')return p}};
  for(let i=0;i<(spec.rocks||0);i++)cells[free()]='#';
  for(let i=0;i<(spec.mud||0);i++)cells[free()]='m';
  for(let i=0;i<(spec.flowers||0);i++)cells[free()]='f';
  const sheep=[];for(let i=0;i<(spec.sheep||1);i++){let p;do{p=free()}while(sheep.includes(p));sheep.push(p)}
  const L={w,h,cells};const pass=Array(N).fill(0);let s=sheep.slice();const zero=Array(N).fill(0);
  for(let m=0;m<spec.walk;m++){let ok=false;for(let t=0;t<20&&!ok;t++){const i=(R()*s.length)|0,d=(R()*4)|0;const r=slide(L,zero,s,i,d);if(!r.path.length||r.trample)continue;for(const p of r.path)pass[p]++;s[i]=r.path[r.path.length-1];ok=true}}
  const grass=Array(N).fill(0);let tall=spec.tall||0;
  const order=[...Array(N).keys()].sort(()=>R()-.5);
  for(const p of order){if(cells[p]!=='.'||sheep.includes(p)||!pass[p])continue;grass[p]=1;if(pass[p]>=2&&tall>0){grass[p]=2;tall--}}
  if(tall>0)return null;
  return{L,grass,sheep}}
function show(c){const {L,grass,sheep}=c;const rows=[];for(let y=0;y<L.h;y++){let r='';for(let x=0;x<L.w;x++){const p=y*L.w+x;r+=sheep.includes(p)?'S':L.cells[p]!=='.'?L.cells[p]:grass[p]===2?'G':grass[p]===1?'g':'.'}rows.push(r)}return rows}
const specs=[
 {w:5,h:5,rocks:3,walk:6,lo:4,hi:5},
 {w:6,h:6,rocks:5,walk:10,lo:6,hi:8},
 {w:6,h:6,rocks:5,tall:3,walk:11,lo:7,hi:9},
 {w:6,h:6,rocks:4,mud:2,walk:11,lo:7,hi:9},
 {w:6,h:6,rocks:4,flowers:2,walk:11,lo:7,hi:10},
 {w:6,h:6,rocks:5,sheep:2,walk:11,lo:7,hi:10},
 {w:6,h:7,rocks:5,mud:2,tall:3,flowers:2,walk:14,lo:9,hi:12},
 {w:6,h:7,rocks:6,mud:2,tall:3,flowers:2,sheep:2,walk:15,lo:10,hi:13},
];
const out=[];
specs.forEach((spec,si)=>{const R=rng(1000+si*77);let best=null;
  for(let t=0;t<(spec.sheep>1?250:1500);t++){const c=gen(spec,R);if(!c)continue;
    const open=c.L.cells.filter(x=>x==='.').length-c.sheep.length;const cov=c.grass.filter(v=>v).length/open;
    if(cov<0.55)continue;if(best&&cov*10<best.score-13)continue;
    const r=solve(c.L,c.grass,c.sheep,spec.sheep>1?120000:250000);if(r.min<spec.lo||r.min>spec.hi)continue;
    let bonus=0;
    if(spec.flowers){const L2={...c.L,cells:c.L.cells.map(x=>x==='f'?'.':x)};const r2=solve(L2,c.grass,c.sheep);if(r2.min>0&&r2.min<r.min)bonus+=4;else continue}
    if(spec.mud){const L2={...c.L,cells:c.L.cells.map(x=>x==='m'?'.':x)};const r2=solve(L2,c.grass,c.sheep,120000);if(r2.min!==r.min)bonus+=2}
    const score=cov*10+r.min*0.6+bonus;if(!best||score>best.score)best={score,c,r,cov}}
  if(!best){console.log('NO LEVEL',si);return}
  // greedy fill: turn leftover bare cells into grass where still solvable within hi
  const c=best.c;let r=best.r;
  for(let p=0;p<c.grass.length;p++){if(c.L.cells[p]!=='.'||c.sheep.includes(p)||c.grass[p])continue;c.grass[p]=1;const r2=solve(c.L,c.grass,c.sheep,spec.sheep>1?150000:300000);if(r2.min>0&&r2.min<=spec.hi)r=r2;else c.grass[p]=0}
  const rows=show(c);console.log(`// ${si+1}: par ${r.min} cov ${best.cov.toFixed(2)} sol ${r.sol}`);console.log(rows.join('\n'));
  out.push({rows,par:r.min})});
require('fs').writeFileSync(__dirname+'/levels.json',JSON.stringify(out));
