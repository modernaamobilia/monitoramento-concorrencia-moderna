import fs from 'node:fs/promises';
export const DESTINATIONS=JSON.parse(await fs.readFile(new URL('destinos.json',import.meta.url),'utf8'));
export const CEPS=DESTINATIONS.map(x=>x.cep);
export function locationStore(p){return new URL(p.url).hostname.includes('magazineluiza.com.br')?'Magalu':p.store;}
export function quoteCep(p,index){return DESTINATIONS[index].overrides?.[locationStore(p)]||CEPS[index];}
export function offerCeps(p){return DESTINATIONS.map((_,i)=>quoteCep(p,i));}
