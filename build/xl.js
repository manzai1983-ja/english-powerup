const fs=require('fs'), zlib=require('zlib');
function unzip(file){
  const b=fs.readFileSync(file);
  let eocd=-1;
  for(let i=b.length-22;i>=0;i--){ if(b.readUInt32LE(i)===0x06054b50){eocd=i;break;} }
  const n=b.readUInt16LE(eocd+10), cdOff=b.readUInt32LE(eocd+16);
  let p=cdOff; const out={};
  for(let i=0;i<n;i++){
    const nl=b.readUInt16LE(p+28), el=b.readUInt16LE(p+30), cl=b.readUInt16LE(p+32);
    const name=b.toString('utf8',p+46,p+46+nl);
    const lho=b.readUInt32LE(p+42);
    const method=b.readUInt16LE(p+10), csize=b.readUInt32LE(p+20);
    const lnl=b.readUInt16LE(lho+26), lel=b.readUInt16LE(lho+28);
    const start=lho+30+lnl+lel;
    const raw=b.slice(start,start+csize);
    out[name]= method===0 ? raw : zlib.inflateRawSync(raw);
    p+=46+nl+el+cl;
  }
  return out;
}
function dec(s){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#10;/g,'\n').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
function open(file){
  const z=unzip(file);
  const ssXml=z['xl/sharedStrings.xml'] ? z['xl/sharedStrings.xml'].toString('utf8') : '';
  const shared=[];
  for(const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)){
    shared.push(dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')));
  }
  const wb=z['xl/workbook.xml'].toString('utf8');
  const sheets=[...wb.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="(rId\d+)"/g)].map(m=>({name:dec(m[1]),rid:m[2]}));
  const rels=z['xl/_rels/workbook.xml.rels'].toString('utf8');
  for(const s of sheets){
    const m=rels.match(new RegExp('Id="'+s.rid+'"[^>]*Target="([^"]*)"'));
    s.path='xl/'+m[1].replace(/^\/?xl\//,'');
  }
  function cellsOf(name){
    const s=sheets.find(x=>x.name===name);
    if(!s) throw new Error('sheet not found: '+name+' / have: '+sheets.map(x=>x.name).join(','));
    const xml=z[s.path].toString('utf8');
    const cells={};
    /* 自己終了タグ <c .../> を貪欲に読むと次のセルの値まで拾ってしまう。
       開きタグを1つずつ進め、閉じ方に応じて中身を切り出す。 */
    const re=/<c\s+r="([A-Z]+)(\d+)"([^>]*?)(\/>|>)/g;
    let m;
    while((m=re.exec(xml))!==null){
      const col=m[1], row=+m[2], attr=m[3];
      let inner='';
      if(m[4]==='>'){
        const end=xml.indexOf('</c>', re.lastIndex);
        inner=xml.slice(re.lastIndex, end);
        re.lastIndex=end+4;
      }
      let v='';
      const vm=inner.match(/<v>([\s\S]*?)<\/v>/);
      if(/t="s"/.test(attr)) v = vm ? (shared[+vm[1]]||'') : '';
      else if(/t="inlineStr"/.test(attr)) v = dec([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''));
      else v = vm ? dec(vm[1]) : '';
      cells[col+row]=v;
    }
    return cells;
  }
  return {z,shared,sheets,cellsOf};
}
module.exports={open};
