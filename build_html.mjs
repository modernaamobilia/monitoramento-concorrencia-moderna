import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile(new URL('dados_revisados.json',import.meta.url),'utf8'));
data.comparison=JSON.parse(await fs.readFile(new URL('comparacao_por_concorrente.json',import.meta.url),'utf8'));
const cepList=['01001-001','13010-001','20010-010','26010-010','30110-010','38400-010','40010-010','44001-010'];
const recentIds=new Set(['M2','M3','M5','C1','C4','L2','L3','K3','K4']);
let history=[];
try{history=JSON.parse(await fs.readFile(new URL('historico_cotacoes.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const keys=new Set(history.map(x=>[x.offerId,x.url,x.cep,x.collectedAt].join('|')));
for(const p of data.products.filter(p=>!p.priceCollectedAt))for(let d=0;d<8;d++){
 const s=data.ship[p.id],row={offerId:p.id,url:p.url,cep:cepList[d],collectedAt:recentIds.has(p.id)?'2026-11-10':'2026-11-09',price:p.price,freight:s.freights[d],deliveryFrom:s.start[d]||null,deliveryTo:s.dates[d]||null,businessDays:s.du[d]||null};
 const key=[row.offerId,row.url,row.cep,row.collectedAt].join('|');if(!keys.has(key)){history.push(row);keys.add(key);}
}
data.history=history;
await fs.writeFile(new URL('historico_cotacoes.json',import.meta.url),JSON.stringify(history,null,2));
const template=await fs.readFile(new URL('buybox_template.html',import.meta.url),'utf8');
const upgrade=(await fs.readFile(new URL('panel_upgrade.js',import.meta.url),'utf8'))+'\n'+(await fs.readFile(new URL('panel_filters_history.js',import.meta.url),'utf8'))+'\n'+(await fs.readFile(new URL('panel_automation.js',import.meta.url),'utf8'));
const upgraded=template.replace(/\r?\nrender\(\);\r?\n<\/script>/,'\n'+upgrade+'\nrender();\n</script>');
if(!upgraded.includes('function filters()'))throw new Error('A nova interface não foi incorporada.');
let html=upgraded.replace('/*__DATA__*/',JSON.stringify(data).replaceAll('<','\\u003c'));
if(data.automation)html=html.replace(/<div class="stamp">[\s\S]*?<\/div>/,'<div class="stamp">Última tentativa: '+data.automation.date+' · '+data.automation.ok+' cotações completas · '+data.automation.unavailable+' sem entrega · '+data.automation.errors+' falhas. Valores antigos permanecem identificados e fora da disputa atual.</div>');
if(data.automation)html=html.replace(/<footer>[\s\S]*?<\/footer>/,'<footer>Coleta automática diária prevista para 7h17 de Brasília, sujeita a atrasos do GitHub. Última rodada publicada: '+data.automation.date+'. O Excel e o histórico são atualizados após a validação da rodada. Falhas não equivalem a frete grátis.</footer>');
await fs.writeFile(new URL('Comparativo_por_Concorrente_09-11-2026.html',import.meta.url),html);
await fs.writeFile(new URL('index.html',import.meta.url),html);
console.log('HTML independente salvo. Produtos: '+data.products.length+'; cotações: '+Object.values(data.ship).reduce((n,s)=>n+s.freights.length,0));
