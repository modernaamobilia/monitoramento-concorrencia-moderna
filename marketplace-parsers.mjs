export function parseMadeiraQuote(d,wanted){
 if(!Array.isArray(d.buyBox))throw Error('Resposta Madeira inesperada');
 const b=d.buyBox.find(x=>String(x.seller?.id)===wanted||(wanted==='1'&&x.seller?.id===0));
 if(!b||/moderna/i.test(b.seller?.name||''))throw Error('Vendedor aprovado não encontrado');
 const price=b.price?.inCash;
 if(!Array.isArray(b.shipping)||!b.shipping.length)throw Error('Resposta Madeira sem situação de entrega');
 const opts=b.shipping.filter(x=>!x.error&&Number.isFinite(x.shipping?.price)).sort((a,b)=>a.shipping.price-b.shipping.price);
 if(!opts.length){
  const messages=b.shipping.map(x=>x.comment||'');
  if(b.shipping.every(x=>x.error===true&&/n[aã]o entregamos para esta regi[aã]o/i.test(x.comment||'')))return {price,status:'unavailable',reason:messages.join(' '),seller:b.seller.name};
  throw Error('Cotação Madeira com erro: '+messages.filter(Boolean).join(' ').slice(0,200));
 }
 const r=opts[0];return {price,freight:r.shipping.price,deliveryFrom:r.estimatedDelivery?.min,deliveryTo:r.estimatedDelivery?.max,businessDays:r.shipping.forecastMax,status:'ok',seller:b.seller.name};
}
export function parseMagaluShipping(text,now=new Date()){
 const months=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
 const clean=text.replace(/\s+/g,' ');const m=clean.match(/R\$\s*([\d.]+,\d{2})/);const freight=m?Number(m[1].replaceAll('.','').replace(',','.')):/gr[aá]tis|frete gr[aá]tis/i.test(clean)?0:NaN;
 if(!Number.isFinite(freight))throw Error('Frete Magalu não identificado');
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(now);
 function date(day,month,year){const mm=months.indexOf(month.toLowerCase());if(mm<0)throw Error('Mês Magalu inválido');let yy=year?Number(year):Number(today.slice(0,4));let iso=`${yy}-${String(mm+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(!year&&iso<today)iso=`${yy+1}${iso.slice(4)}`;return iso;}
 const crossing=clean.match(/(?:entre|de)\s+(\d{1,2})\/(\d{1,2})\s+(?:a|e|at[eé])\s+(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(20\d{2}))?/i);
 if(crossing){if(!months[Number(crossing[2])-1])throw Error('Mês inicial inválido');return {freight,deliveryFrom:date(crossing[1],months[Number(crossing[2])-1],crossing[5]),deliveryTo:date(crossing[3],crossing[4],crossing[5]),deadlineText:clean};}
 const range=clean.match(/(?:entre|de)\s+(\d{1,2})\s+(?:a|e|at[eé])\s+(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(20\d{2}))?/i);
 if(range)return {freight,deliveryFrom:date(range[1],range[3],range[4]),deliveryTo:date(range[2],range[3],range[4]),deadlineText:clean};
 const one=clean.match(/(?:at[eé]|dia)\s+(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(20\d{2}))?/i);
 if(one)return {freight,deliveryTo:date(one[1],one[2],one[3]),deadlineText:clean};
 const days=clean.match(/(\d+)\s+dias?\s+[uú]teis/i);if(days)return {freight,businessDays:Number(days[1]),deadlineText:clean};
 throw Error('Prazo Magalu não interpretado: '+clean.slice(0,160));
}
