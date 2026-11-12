"""Runner GitHub sem artifact-tool: preserva o modelo e recalcula com LibreOffice."""
import json
import re
from datetime import datetime
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill

path='Comparativo_por_Concorrente_09-11-2026.xlsx'
d=json.load(open('dados_revisados.json',encoding='utf8'))
hist=json.load(open('historico_cotacoes.json',encoding='utf8'))
w=load_workbook(path)
p={x['id']:x for x in d['products']}
destinations=json.load(open('destinos.json',encoding='utf8'))
ceps=[x['cep'] for x in destinations]
a=w['Anúncios']
for row in range(7,7+len(p)):
    x=p[a.cell(row,1).value]
    a.cell(row,15,x['price'])
a['A4']='Última tentativa: '+d['automation']['date']+'. Preço à vista, sem cupons. Falhas não participam da disputa; consulte o histórico.'
b=w['Base de cálculo']
for row in range(8,8+len(p)*8):
    id=b.cell(row,1).value
    x=p[id]; i=next(i for i,dest in enumerate(destinations) if dest['city']==b.cell(row,3).value); s=d['ship'][id]
    b.cell(row,4,s.get('ceps',ceps)[i])
    status=s.get('lastAttempt',[{}]*8)[i].get('status','error')
    for col,val in [(9,s['freights'][i] if status=='ok' else None),(11,s['start'][i] if len(s['start'])>i else None),(12,s['dates'][i] if len(s['dates'])>i else None),(13,s['du'][i] if len(s['du'])>i else None)]:
        c=b.cell(row,col); c.value=datetime.fromisoformat(val) if col in (11,12) and val and status=='ok' else val if status=='ok' else None
    reason=s.get('lastAttempt',[{}]*8)[i].get('reason','') or ''
    b.cell(row,14,'Cotado' if status=='ok' else 'CEP rejeitado' if 'inválido' in reason.lower() else 'Sem entrega' if status=='unavailable' else 'Falha na coleta')
# Reference absence must not become a zero-cost winner.
calc_rows=[]
for row in range(1,b.max_row+1):
    v=b.cell(row,15).value
    if isinstance(v,str) and ('Sem concorrente próximo' in v):
        calc_rows.append(row)
        for cell in b[row]:
            f=cell.value
            if isinstance(f,str) and f.startswith('='):
                if cell.column==15:
                    if 'Referência sem cotação' not in f: cell.value='=IF(ISNUMBER(D'+str(row)+'),'+f[1:]+',"Referência sem cotação")'
                else:
                    f=f.replace('IF(F'+str(row)+'>0,','IF(AND(ISNUMBER(D'+str(row)+'),F'+str(row)+'>0),')
                    f=f.replace('IF(F'+str(row)+'=0,','IF(OR(F'+str(row)+'=0,NOT(ISNUMBER(D'+str(row)+'))),')
                    cell.value=f
for sh in w:
    if sh.title in ('Anúncios','Base de cálculo'): continue
    for row in sh:
        for cell in row:
            f=cell.value
            if not isinstance(f,str) or not f.startswith('='): continue
            # Individual comparisons require the reference's delivered total.
            match=re.search(r"'Base de cálculo'!D(\d+)",f)
            if match and int(match[1]) in calc_rows and ('ROUND(' in f or 'Moderna menor' in f):
                ref="'Base de cálculo'!D"+match[1]
                fallback='"Moderna sem cotação"' if 'Moderna menor' in f else '""'
                if 'NOT(ISNUMBER('+ref+'))' not in f: cell.value='=IF(NOT(ISNUMBER('+ref+')),'+fallback+','+f[1:]+')'
    # Show each actual postal code beside the city in individual comparisons.
    for row in range(1,sh.max_row+1):
        text=sh.cell(row,1).value
        if not isinstance(text,str) or text.startswith('=') or not any(x['city'] in text for x in destinations):continue
        f=sh.cell(row,2).value
        if isinstance(f,str):
            match=re.fullmatch(r"='Base de cálculo'!H(\d+)",f)
            if match:
                q=int(match[1]);city=b.cell(q,3).value;actual=b.cell(q,4).value
                mr=next((r for r in range(8,192) if b.cell(r,1).value=='M'+str(p[b.cell(q,1).value]['ref']+1) and b.cell(r,3).value==city),None)
                if mr:sh.cell(row,1,city+'\nConcorrente: '+str(actual)+'\nModerna: '+str(b.cell(mr,4).value)+ ('\nCEPs diferentes' if actual!=b.cell(mr,4).value else ''))
for idx,ref in enumerate([4,3,0,1,2]):
    rows=[r for r in calc_rows if (r-calc_rows[0])//8==ref]
    # Formula-linked text follows the same result schedule as the indicators.
    first,last=rows[0],rows[-1]
    w['Visão geral'].cell(10+idx,7,'=COUNTIF(\'Base de cálculo\'!O'+str(first)+':O'+str(last)+',"Concorrente vence")&" CEPs com concorrente menor. Ver análise por CEP para preço, frete e prazo."')
for name in ['Visão geral','Toronto','Carolina','Closet Light','Alvorada','Coliseu']:
    w[name]['A4']='Coleta: '+d['automation']['date']+'. CEPs por loja na aba Situação da coleta. CEPs diferentes são sinalizados; histórico preservado.'
for name in ['Histórico','Situação da coleta']:
    if name in w: del w[name]
h=w.create_sheet('Histórico');h.append(['Data','ID','CEP','Produto','Frete','Total','Entrega a partir','Entrega até','Dias úteis','Situação','Origem','URL'])
for r in hist:
    h.append([r['collectedAt'],r['offerId'],r['cep'],r['price'],r.get('freight'),r['price']+r['freight'] if isinstance(r.get('freight'),(float,int)) else None,r.get('deliveryFrom'),r.get('deliveryTo'),r.get('businessDays'),r.get('status','Legado'),'Assistida no navegador' if r.get('source')=='browser_assisted' else 'Automática' if r.get('status') else 'Legado',r['url']])
t=w.create_sheet('Situação da coleta');t.append(['Data/hora','ID','CEP','Situação','Origem','Motivo','Falha na automação','URL'])
run=json.load(open('ultima_coleta.json',encoding='utf8'))
for r in run['attempts']:t.append([r['checkedAt'],r['offerId'],r['cep'],r['status'],'Assistida no navegador' if r.get('source')=='browser_assisted' else 'Automática',(r.get('error') or r.get('reason',''))+(' | CEP original: '+r['requestedCep'] if r.get('requestedCep') and r['requestedCep']!=r['cep'] else ''),r.get('automaticError',''),r['url']])
for sh in [h,t]:
    sh.freeze_panes='D2';sh.auto_filter.ref=sh.dimensions;sh.sheet_view.showGridLines=False
    for c in sh[1]:c.font=Font(name='Arial',bold=True,color='FFFFFF');c.fill=PatternFill('solid',fgColor='203B5B')
    for col in sh.columns:sh.column_dimensions[col[0].column_letter].width=20
    sh.column_dimensions[sh.cell(1,sh.max_column).column_letter].width=55
    for row in range(2,sh.max_row+1):
        c=sh.cell(row,sh.max_column);c.hyperlink=c.value;c.style='Hyperlink'
for row in h.iter_rows(min_row=2,min_col=4,max_col=6):
    for c in row:c.number_format='"R$ "#,##0.00'
w.save(path)
