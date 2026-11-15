const fs=require('fs');
const rows=fs.readFileSync('gm3.txt','utf8').split('\n').map(l=>l.split('\t'));
const items=[];let lastNo=null;
for(const r of rows){const pg=+r[0];if(pg>=25)continue;let en=(r[1]||'').trim(),ja=(r[2]||'').trim();
 if(!en||/文法問題集/.test(en))continue;
 let no=null,rel='';const m=en.match(/^(\d{1,4})\s+(.*)$/);
 if(m){no=+m[1];en=m[2];lastNo=no;}else{const mm=en.match(/^(≒|←→|=)\s*(.*)$/);if(mm){rel=mm[1];en=mm[2];}no=lastNo;}
 let note='';const k=ja.indexOf('※');if(k>=0){note=ja.slice(k+1).trim();ja=ja.slice(0,k).trim();}
 const ek=en.indexOf('※');if(ek>=0){note=(en.slice(ek+1).trim()+' '+note).trim();en=en.slice(0,ek).trim();}
 if(!ja&&/^\(/.test(en)){}
 items.push({no,en,ja,note,rel});}
// dedupe identical
const seen={};const out=[];for(const it of items){const key=it.no+'|'+it.en+'|'+it.ja;if(seen[key])continue;seen[key]=1;out.push(it);}
const knock={};fs.readFileSync('knock.txt','utf8').trim().split('\n').forEach(l=>{const i=l.indexOf('|');knock[+l.slice(0,i)]=l.slice(i+1).trim();});
const miss=out.filter(it=>!knock[it.no]).map(it=>it.no);
console.log('items',out.length,'missingEx',miss.length,miss.slice(0,20));
console.log(out.filter(it=>!it.ja).map(it=>it.no+' '+it.en));
const usedNos=new Set(out.map(i=>i.no));const kn={};usedNos.forEach(n=>{if(knock[n])kn[n]=knock[n];});
fs.writeFileSync('gdata.json',JSON.stringify({items:out.map(i=>[i.no,i.en,i.ja,i.note,i.rel]),knock:kn}));
console.log('bytes',fs.statSync('gdata.json').size);
