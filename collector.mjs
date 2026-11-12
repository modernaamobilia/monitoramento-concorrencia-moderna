import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseMadeiraQuote} from './marketplace-parsers.mjs';
import {DESTINATIONS,CEPS,quoteCep} from './destinations.mjs';
export {DESTINATIONS,CEPS} from './destinations.mjs';
const round=n=>Math.round(n*100)/100;
const money=s=>/\d/.test(s)?Number(s.replace(/[^\d,]/g,'').replace(',','.')):NaN;
const plain=s=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export function validate(q){if(!(Number.isFinite(q.price)&&q.price>0))throw Error('Preço inválido');if(q.status==='ok'&&(!(Number.isFinite(q.freight)&&q.freight>=0)||!(q.deliveryTo||q.businessDays)))throw Error('Frete ou prazo incompleto');return q;}
async function request(url,opts={}){for(let n=0;n<3;n++){try{const r=await fetch(url,{...opts,signal:AbortSignal.timeout(40000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.text();}catch(e){if(n===2||/HTTP 40[134]/.test(e.message))throw e;await new Promise(r=>setTimeout(r,1500*(n+1)));}}}
const json=async(u,o)=>JSON.parse(await request(u,o));
const post=(body)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function structured(html){const out=[];for(const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)){try{let j=JSON.parse(m[1]);out.push(...(Array.isArray(j)?j:j['@graph']||[j]));}catch{}}return out.find(x=>x['@type']==='Product');}
const hidden=(h,id)=>h.match(new RegExp('id="'+id+'"[^>]*value="([^"]+)"'))?.[1];
function isoPt(s){const months=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];const m=s.match(/(\d{1,2}) de (\w+|março) de (\d{4})/i);return m&&months.includes(m[2].toLowerCase())?`${m[3]}-${String(months.indexOf(m[2].toLowerCase())+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;}
export function parseModernaShipping(h,price){const opts=h.split('class="shipping_option_box"').slice(1).map(s=>({freight:money(s.match(/shipping-option__price[^>]*>([\s\S]*?)<\/div>/)?.[1]||''),deliveryTo:isoPt(plain(s))})).filter(x=>Number.isFinite(x.freight)&&x.deliveryTo);if(!opts.length)throw Error('Sem frete/prazo interpretável');return {...opts.sort((a,b)=>a.freight-b.freight)[0],price,status:'ok'};}
export async function prepare(p,pins){
 const host=new URL(p.url).origin;
 if(host.includes('magazineluiza')){const {prepareMagalu}=await import('./magalu-browser.mjs');return prepareMagalu(p);}
 const h=await request(p.url),schema=structured(h);
 if(p.store==='Moderna'){
  const sku=hidden(h,'referenceId'),id=hidden(h,'productId');if(sku!==new URL(p.url).searchParams.get('referenceId')||!id)throw Error('SKU divergente');
  const v=h.match(/class="product-container__price"[^>]*>\s*<h4>([^<]+)/);if(!v)throw Error('Preço Pix não identificado');const price=money(v[1]);
  return async cep=>parseModernaShipping(await request(host+'/api/shipping/calculate',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({scope:'product',destination:cep.replace('-',''),'items[0][product_id]':id,'items[0][sku]':sku,'items[0][quantity]':'1'})}),price);
 }
 if(host.includes('madesa.com')){
  const sh=JSON.parse(h.match(/<script[^>]*data-shipping-product[^>]*>([\s\S]*?)<\/script>/)?.[1]||'null');
  if(!sh||!schema?.offers)throw Error('Dados Madesa ausentes');const offer=Array.isArray(schema.offers)?schema.offers[0]:schema.offers;const vid=new URL(offer.url).searchParams.get('variant');if(pins[p.id]&&pins[p.id]!==vid)throw Error('Variante Madesa mudou');pins[p.id]=vid;const v=sh.variants[vid];if(!v)throw Error('Variante não disponível');const price=Number(offer.price);
  return async cep=>{const d=await json('https://contingencia.checkstore.com.br/quote-madesa',post({origin_zip_code:'95765000',destination_zip_code:cep.replace('-',''),products:[{...v,width:sh.width,height:sh.height,length:sh.length,quantity:1}],additional_information:{sales_channel:'Shopify'}}));if(!Array.isArray(d.rates))throw Error('Resposta frete inesperada');if(!d.rates.length)return {price,status:'unavailable'};const r=d.rates.filter(x=>Number.isFinite(x.total_price)).sort((a,b)=>a.total_price-b.total_price)[0];if(!r)throw Error('Tarifa inválida');return {price,freight:r.total_price/100,deliveryFrom:r.min_delivery_date,deliveryTo:r.max_delivery_date,businessDays:r.business_days||r.days_estimated,status:'ok'};};
 }
 if(p.store==='MadeiraMadeira'){
  const n=JSON.parse(h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1]||'null')?.props.pageProps;if(!n?.product)throw Error('Produto Madeira não identificado');
  const wanted=new URL(p.url).searchParams.get('seller')||String(n.sellerId||1);const id=n.product.id;
  return async cep=>parseMadeiraQuote(await json(`${host}/api/freight/${id}?zipCode=${cep.replace('-','')}&seller=${wanted}&quantity=1`),wanted);
 }
 if(['Easy House','Bom Pastor'].includes(p.store)){
  const slug=new URL(p.url).pathname.split('/')[1];const catalog=await json(`${host}/api/catalog_system/pub/products/search/${slug}/p`);const product=catalog.find(x=>x.linkText===slug)||catalog[0];if(!product)throw Error('Catálogo sem produto');
  const offers=schema?.offers?.offers;if(!offers?.length)throw Error('Preço à vista não confirmado');const selected=pins[p.id]||String(Number(offers[0].sku));const item=product.items.find(x=>x.itemId===selected);if(!item)throw Error('SKU aprovado ausente');pins[p.id]=selected;const sale=offers.find(x=>String(Number(x.sku))===selected);if(!sale)throw Error('Preço SKU ausente');const price=Number(sale.price),seller=item.sellers[0].sellerId;
  return async cep=>{const d=await json(host+'/api/checkout/pub/orderForms/simulation',post({items:[{id:selected,quantity:1,seller}],postalCode:cep.replace('-',''),country:'BRA'}));const slas=d.logisticsInfo?.[0]?.slas;if(!Array.isArray(slas))throw Error('Simulação VTEX incompleta');const delivery=slas.filter(x=>x.deliveryChannel==='delivery'&&Number.isFinite(x.price)).sort((a,b)=>a.price-b.price);if(!delivery.length){if(d.items?.[0]?.availability==='cannotBeDelivered'||d.messages?.some(x=>x.code==='cannotBeDelivered'))return {price,status:'unavailable'};throw Error('Sem entrega confirmada');}const r=delivery[0],days=r.shippingEstimate?.match(/^(\d+)bd$/)?.[1];return {price,freight:r.price/100,businessDays:days?Number(days):null,deliveryTo:r.shippingEstimateDate?.slice(0,10),status:'ok'};};
 }
 throw Error('Loja sem adaptador');
}
export async function collect(){
const data=JSON.parse(await fs.readFile('dados_revisados.json')),history=JSON.parse(await fs.readFile('historico_cotacoes.json'));data.destinations=DESTINATIONS;let pins={};try{pins=JSON.parse(await fs.readFile('variantes_aprovadas.json'));}catch{}
const at=new Date().toISOString(),day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());const attempts=[];
for(const p of data.products){let fn,error;try{fn=await prepare(p,pins);}catch(e){error=e.message;}
 for(let i=0;i<8;i++){const actualCep=quoteCep(p,i);let row={offerId:p.id,url:p.url,requestedCep:CEPS[i],cep:actualCep,destinationIndex:i,collectedAt:day,checkedAt:at};try{if(error)throw Error(error);const q=validate(await fn(actualCep));row={...row,...q};}catch(e){row={...row,status:'error',error:e.message};}attempts.push(row);console.log(p.id,actualCep,row.status,row.error||row.freight||'');await new Promise(r=>setTimeout(r,200));}
 await fn?.close?.();
}
// Only complete per-offer price cohorts can replace the global display price.
for(const p of data.products){const rows=attempts.filter(x=>x.offerId===p.id);const prices=[...new Set(rows.filter(x=>x.status!=='error').map(x=>x.price))];const s=data.ship[p.id];s.ceps=rows.map(r=>r.cep);s.collectedAt||=Array(8).fill(null);s.status||=Array(8).fill('legacy');s.lastAttempt=rows.map(r=>({at,status:r.status,error:r.error||null,reason:r.reason||null}));if(prices.length!==1){if(prices.length>1)for(const r of rows){r.status='error';r.error='Preço varia por CEP: requer comparação com preço regional';s.lastAttempt[r.destinationIndex]={at,status:'error',error:r.error};}continue;}
 for(let i=0;i<8;i++){let r=rows[i];s.lastAttempt[i]={at,status:r.status,error:r.error||null,reason:r.reason||null};if(r.status==='error')continue;s.freights[i]=r.status==='ok'?r.freight:null;s.dates[i]=r.deliveryTo||null;s.start[i]=r.deliveryFrom||null;s.du[i]=r.businessDays||null;s.collectedAt[i]=day;s.status[i]=r.status;}
 p.price=prices[0];p.priceCollectedAt=day;
}
// Failed attempts never become a successful historical quote; reruns are revisions in the run log.
for(const r of attempts.filter(x=>x.status!=='error')){const i=history.findIndex(x=>x.offerId===r.offerId&&x.url===r.url&&x.cep===r.cep&&x.collectedAt===day);if(i<0)history.push(r);else history[i]=r;}
data.automation={checkedAt:at,date:day,total:attempts.length,ok:attempts.filter(x=>x.status==='ok').length,unavailable:attempts.filter(x=>x.status==='unavailable').length,errors:attempts.filter(x=>x.status==='error').length};
await fs.mkdir('coletas',{recursive:true});await fs.writeFile(`coletas/${at.replaceAll(':','-')}.json`,JSON.stringify({summary:data.automation,attempts},null,2));
for(const [name,value] of [['dados_revisados.json',data],['historico_cotacoes.json',history],['variantes_aprovadas.json',pins],['ultima_coleta.json',{summary:data.automation,attempts}]])await fs.writeFile(name,JSON.stringify(value,null,2));console.log(JSON.stringify(data.automation));
if(!data.automation.ok)throw Error('Nenhuma cotação completa: publicação deve ser interrompida');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await collect();
