import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {CEPS,validate} from './collector.mjs';import {parseMagaluShipping} from './marketplace-parsers.mjs';
import {offerCeps} from './destinations.mjs';
export function applyAssisted(data,history,run,evidence,importedAt=new Date().toISOString()){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(importedAt));
 if(evidence.observedDate!==today||run.summary.date!==today)return 0;
 const p=data.products.find(x=>x.id===evidence.offerId);if(!p||p.url!==evidence.url)throw Error('Verificação assistida não corresponde ao anúncio aprovado');
 const actualCeps=offerCeps(p);if(evidence.quotes.length!==8||new Set(evidence.quotes.map(x=>x.cep)).size!==8||evidence.quotes.some(x=>!actualCeps.includes(x.cep)))throw Error('Verificação assistida não corresponde aos 8 CEPs atuais desta loja');
 let count=0;
 for(const q of evidence.quotes){const index=run.attempts.findIndex(x=>x.offerId===p.id&&x.url===p.url&&x.cep===q.cep);const automatic=run.attempts[index];if(!automatic||automatic.status!=='error')continue;
 const values=validate({price:evidence.price,...parseMagaluShipping(q.text,new Date(today+'T12:00:00Z')),status:'ok'});
 const i=actualCeps.indexOf(q.cep);const row={offerId:p.id,url:p.url,cep:q.cep,requestedCep:CEPS[i],destinationIndex:i,collectedAt:today,checkedAt:importedAt,observedDate:today,source:'browser_assisted',evidence:evidence.method,automaticStatus:automatic.status,automaticError:automatic.error,...values};run.attempts[index]=row;
 const s=data.ship[p.id];s.ceps=actualCeps;s.collectedAt||=Array(8).fill(null);s.status||=Array(8).fill('legacy');s.lastAttempt||=Array(8).fill(null);
 s.freights[i]=values.freight;s.start[i]=values.deliveryFrom||null;s.dates[i]=values.deliveryTo||null;s.du[i]=values.businessDays||null;s.collectedAt[i]=today;s.status[i]='ok';s.lastAttempt[i]={at:importedAt,status:'ok',source:'browser_assisted',automaticError:automatic.error};
 const old=history.findIndex(x=>x.offerId===p.id&&x.url===p.url&&x.cep===q.cep&&x.collectedAt===today);if(old<0)history.push(row);else history[old]=row;count++;
 }
 if(count){p.price=evidence.price;p.priceCollectedAt=today;run.summary={...run.summary,ok:run.attempts.filter(x=>x.status==='ok').length,unavailable:run.attempts.filter(x=>x.status==='unavailable').length,errors:run.attempts.filter(x=>x.status==='error').length,assisted:run.attempts.filter(x=>x.source==='browser_assisted').length,automaticErrors:run.attempts.filter(x=>x.status==='error'||x.automaticStatus==='error').length,assistedImportedAt:importedAt};data.automation=run.summary;}
 return count;
}
async function main(){const run=JSON.parse(await fs.readFile('ultima_coleta.json')),day=run.summary.date;let evidence;try{evidence=JSON.parse(await fs.readFile(`verificacoes_assistidas/magalu_${day}.json`));}catch(e){if(e.code==='ENOENT'){console.log('Sem verificação assistida nesta data.');return;}throw e;}
const data=JSON.parse(await fs.readFile('dados_revisados.json')),history=JSON.parse(await fs.readFile('historico_cotacoes.json'));const at=new Date().toISOString(),count=applyAssisted(data,history,run,evidence,at);if(!count){console.log('Nenhuma revisão assistida aplicada.');return;}
for(const [name,value] of [['dados_revisados.json',data],['historico_cotacoes.json',history],['ultima_coleta.json',run]])await fs.writeFile(name,JSON.stringify(value,null,2));await fs.writeFile(`coletas/${at.replaceAll(':','-')}_assistida.json`,JSON.stringify(run,null,2));console.log(`${count} consultas assistidas de ${day}; falhas da automação preservadas no registro.`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
