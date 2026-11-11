import {parseMagaluShipping} from './marketplace-parsers.mjs';
export async function prepareMagalu(p){
 const {chromium}=await import('playwright');
 const browser=await chromium.launch({headless:true});
 try{
 const context=await browser.newContext({locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
 const page=await context.newPage();page.setDefaultTimeout(25000);
 const r=await page.goto(p.url,{waitUntil:'domcontentloaded',timeout:45000});
 if(r?.status()===403)throw Error('Magalu bloqueou o navegador automático (403)');
 await page.getByTestId('shipping-btn-container').waitFor();
 const quote=async cep=>{
  const initialPrice=(await page.getByRole('complementary').getByTestId('price-value').innerText()).match(/R\$\s*([\d.]+,\d{2})/);
  if(!initialPrice)throw Error('Preço Magalu ausente');
  await page.getByTestId('shipping-btn-container').click();
  await page.getByRole('textbox',{name:'Enviar para',exact:true}).fill(cep);
  await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Enviar para',exact:true});
  await Promise.race([input.waitFor({state:'hidden'}),page.getByRole('dialog').getByRole('alert').filter({hasText:/CEP inv[aá]lido/}).waitFor()]);
  if(await input.isVisible()){
   const reason=await page.getByRole('dialog').getByRole('alert').innerText();
   if(!/CEP inv[aá]lido/i.test(reason))throw Error('CEP não confirmado: '+reason);
   await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
   return {price:Number(initialPrice[1].replaceAll('.','').replace(',','.')),status:'unavailable',reason,source:'browser'};
  }
  // The header updates before the shipping component. A normal reload commits the chosen CEP.
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});
  await page.getByTestId('shipping-btn-container').filter({hasText:cep}).waitFor();
  const aside=page.getByRole('complementary');
  if(!/EASY HOUSE/i.test(await aside.getByTestId('seller-info').innerText()))throw Error('Magalu trocou o vendedor da oferta');
  const priceText=await aside.getByTestId('price-value').innerText();const amount=priceText.match(/R\$\s*([\d.]+,\d{2})/);if(!amount)throw Error('Preço Magalu não identificado');
  const price=Number(amount[1].replaceAll('.','').replace(',','.'));
  const section=page.getByTestId('product-shipping');
  // An explicit storefront refusal is different from a timeout or parser failure.
  const text=await section.innerText();
  if(/n[aã]o (?:entregamos|entrega|dispon[ií]vel)|indispon[ií]vel para/i.test(text))return {price,status:'unavailable',reason:text,source:'browser'};
  await page.getByTestId('shipping-item').first().waitFor();
  const opts=await page.getByTestId('shipping-item').allInnerTexts();const parsed=opts.map(t=>parseMagaluShipping(t)).sort((a,b)=>a.freight-b.freight);
  return {price,...parsed[0],status:'ok',source:'browser',seller:'Easy House; entregue pelo Magalu'};
 };
 quote.close=()=>browser.close();return quote;
 }catch(e){await browser.close();throw e;}
}
