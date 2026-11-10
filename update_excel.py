"""Runner GitHub sem artifact-tool: preserva o modelo e recalcula com LibreOffice."""
import json
from datetime import datetime
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill

path='Comparativo_por_Concorrente_09-11-2026.xlsx'
d=json.load(open('dados_revisados.json',encoding='utf8'))
hist=json.load(open('historico_cotacoes.json',encoding='utf8'))
w=load_workbook(path)
p={x['id']:x for x in d['products']}
ceps=['01001-001','13010-001','20010-010','26010-010','30110-010','38400-010','40010-010','44001-010']
a=w['Anúncios']
for row in range(7,7+len(p)):
    x=p[a.cell(row,1).value]
    a.cell(row,15,x['price'])
a['A4']='Última tentativa: '+d['automation']['date']+'. Preço à vista, sem cupons. Falhas não participam da disputa; consulte o histórico.'
b=w['Base de cálculo']
for row in range(8,8+len(p)*8):
    id=b.cell(row,1).value
    x=p[id]; i=ceps.index(b.cell(row,4).value); s=d['ship'][id]
    status=s.get('lastAttempt',[{}]*8)[i].get('status','error')
    for col,val in [(9,s['freights'][i] if status=='ok' else None),(11,s['start'][i] if len(s['start'])>i else None),(12,s['dates'][i] if len(s['dates'])>i else None),(13,s['du'][i] if len(s['du'])>i else None)]:
        c=b.cell(row,col); c.value=datetime.fromisoformat(val) if col in (11,12) and val and status=='ok' else val if status=='ok' else None
    b.cell(row,14,'Cotado' if status=='ok' else 'Sem entrega' if status=='unavailable' else 'Falha na coleta')
# Reference absence must not become a zero-cost winner.
for row in range(1,b.max_row+1):
    v=b.cell(row,15).value
    if isinstance(v,str) and v.startswith('=IF(E'):
        b.cell(row,15,'=IF(ISNUMBER(D'+str(row)+'),'+v[1:]+',"Referência sem cotação")')
for name in ['Histórico','Situação da coleta']:
    if name in w: del w[name]
h=w.create_sheet('Histórico');h.append(['Data','ID','CEP','Produto','Frete','Total','Entrega a partir','Entrega até','Dias úteis','Situação','URL'])
for r in hist:
    h.append([r['collectedAt'],r['offerId'],r['cep'],r['price'],r.get('freight'),r['price']+r['freight'] if isinstance(r.get('freight'),(float,int)) else None,r.get('deliveryFrom'),r.get('deliveryTo'),r.get('businessDays'),r.get('status','Legado'),r['url']])
t=w.create_sheet('Situação da coleta');t.append(['Data/hora','ID','CEP','Situação','Motivo','URL'])
run=json.load(open('ultima_coleta.json',encoding='utf8'))
for r in run['attempts']:t.append([r['checkedAt'],r['offerId'],r['cep'],r['status'],r.get('error',''),r['url']])
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
