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
// ---- 手直し（2026-11-16 ユーザー指摘） ----
function fix(no,en,f){const it=out.find(i=>i.no===no&&i.en===en);if(!it)throw new Error('fix not found '+no+' '+en);f(it);}
// No.22: メモの each other は誤り。問題文は any other ＋単数名詞
fix(22,'each other',it=>{it.en='any other ＋単数名詞';it.ja='他のどの（～よりも）';it.note='比較級＋than any other＋単数名詞で「他のどの～よりも」＝最上級の意味。each other（お互い）は代名詞なので名詞の前に置けない';});
// No.93: coincide / proceed / agree with は No.92（negotiate with）の with 仲間。No.93 の文には無い
['coincide with A','proceed with A','agree with A'].forEach(e=>fix(93,e,it=>{it.no=92;}));
out.push({no:93,en:'adopt',ja:'（計画・方針など）を採用する',note:'',rel:''});
out.push({no:93,en:'unless S V',ja:'SがVしない限り',note:'',rel:''});
// No.24: verify の意味を追加
out.splice(out.findIndex(i=>i.no===24),0,{no:24,en:'verify that S V',ja:'SがVであることを確認する（裏付ける）',note:'verify＝（調べて）正しいと確かめる・立証する',rel:''});
out.sort((a,b)=>a.no-b.no);
const knock={};fs.readFileSync('knock.txt','utf8').trim().split('\n').forEach(l=>{const i=l.indexOf('|');knock[+l.slice(0,i)]=l.slice(i+1).trim();});
const miss=out.filter(it=>!knock[it.no]).map(it=>it.no);
console.log('items',out.length,'missingEx',miss.length,miss.slice(0,20));
console.log(out.filter(it=>!it.ja).map(it=>it.no+' '+it.en));
const usedNos=new Set(out.map(i=>i.no));const kn={};usedNos.forEach(n=>{if(knock[n])kn[n]=knock[n];});
const jaAll={};fs.readFileSync('ja.txt','utf8').trim().split(/\r?\n/).forEach(l=>{const i=l.indexOf('|');jaAll[+l.slice(0,i)]=l.slice(i+1).trim();});
const kj={};Object.keys(kn).forEach(n=>{if(jaAll[n])kj[n]=jaAll[n];else console.log('no ja',n);});
fs.writeFileSync('gdata.json',JSON.stringify({items:out.map(i=>[i.no,i.en,i.ja,i.note,i.rel]),knock:kn,knockJa:kj}));
const src=fs.readFileSync('grammar.src.html','utf8');if(src.indexOf('/*DATA*/null')<0)throw new Error('no DATA slot');
fs.writeFileSync('../../grammar.html',src.replace('/*DATA*/null',()=>fs.readFileSync('gdata.json','utf8')));console.log('wrote grammar.html');
console.log('bytes',fs.statSync('gdata.json').size);
