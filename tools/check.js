const fs=require('fs');const html=fs.readFileSync(__dirname+'/../prototype/index.html','utf8');
const src=html.split('<script>')[1].split('</script>')[0];
const lv=src.slice(src.indexOf('const LEVELS='),src.indexOf('const DIRS='));
const core=src.slice(src.indexOf('const DIRS='),src.indexOf('const $='))+'let L;'+src.slice(src.indexOf('function parse'),src.indexOf('/* ---------- drawing'));
const sols=["U L D R U","R U L R D L U R","D U L D R U R D L","R D U L D L U R D","R L U L R U L D R U","0R 0U 1U 1D 1R 1U 1D 1L 1U 1R","L D R U R D L R U D L D","1R 1U 0D 0U 0R 0L 0D 0L 0U 0R 0L 0D 0R"];
const run=new Function('sols',lv+core+`
 return LEVELS.map((lv,i)=>{const P=parse(i);L=P.L;let g=P.grass,s=P.sheep,ok=true;const mv=sols[i].split(' ');
  for(const m of mv){const si=m.length>1?+m[0]:0,d=m.slice(-1);const r=slide(s,si,d);if(!r.path.length||r.trample)ok=false;r.path.forEach(p=>{if(g[p])g[p]--});s[si]=r.path[r.path.length-1]}
  return {field:i+1,par:lv.par,moves:mv.length,cleared:ok&&g.every(v=>!v)}})`);
console.table(run(sols));
