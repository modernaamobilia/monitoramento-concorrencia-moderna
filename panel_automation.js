const originalShipping=shipping;
shipping=function(p,d){const s=DATA.ship[p.id],old=originalShipping(p,d);if(!DATA.automation)return old;const attempt=s.lastAttempt?.[d];const current=attempt?.status==='ok'&&attempt.at===DATA.automation.checkedAt&&s.collectedAt?.[d]===DATA.automation.date&&p.priceCollectedAt===DATA.automation.date;if(!current)return {...old,freight:null,total:null,valid:false,prazo:attempt?.status==='unavailable'?'Sem entrega para este CEP':'Falha na coleta · consultar última cotação no histórico'};return old;};
// Recompute the initial overview after applying freshness rules.
for(let ref=0;ref<5;ref++)for(let d=0;d<8;d++)ALL[ref][d]=analyze(ref,d);
quoteStamp=function(p,d=state.d){const s=DATA.ship[p.id],last=[...HISTORY].reverse().find(x=>x.offerId===p.id&&x.url===p.url&&x.cep===DEST[d][1]);return date(s.collectedAt?.[d]||last?.collectedAt||'2026-11-09')+(s.lastAttempt?.[d]?.status==='error'?' · falha na atualização':'');};
