import sys
import json
from openpyxl import load_workbook
w=load_workbook(sys.argv[1],data_only=True)
errors=[]
for s in w:
    for row in s:
        for c in row:
            if c.data_type=='e':errors.append((s.title,c.coordinate,c.value))
assert not errors,errors[:20]
assert w['Histórico'].max_row>184
assert w['Situação da coleta'].max_row==185
data=json.load(open('dados_revisados.json',encoding='utf8'))
run=json.load(open('ultima_coleta.json',encoding='utf8'))
quotes={(r['offerId'],r.get('requestedCep',r['cep'])):r for r in run['attempts']}
accepted={'T2','C1','C2','A1','A2','A3','L2','C4','L3','K3','K1','K2'}
products={p['id']:p for p in data['products']}
b=w['Base de cálculo']
checked=0
destinations=json.load(open('destinos.json',encoding='utf8'))
ceps=[x['cep'] for x in destinations]
for row in range(8,192):
    id=b.cell(row,1).value;city=b.cell(row,3).value
    nominal=next(x['cep'] for x in destinations if x['city']==city)
    q=quotes[(id,nominal)]
    assert b.cell(row,4).value==q['cep'],('CEP da linha diferente da consulta',id,city)
    if q['status']=='ok':
        assert abs(b.cell(row,8).value-q['price'])<0.001,(id,'preço')
        assert abs(b.cell(row,9).value-q['freight'])<0.001,(id,'frete')
for row in range(1,b.max_row+1):
    cep=b.cell(row,3).value
    if cep not in ceps: continue
    actual=b.cell(row,15).value
    if actual not in ('Sem concorrente próximo','Sem cotação concorrente','Concorrente vence','Moderna vence','Empate','Referência sem cotação'): continue
    # Row order of the comparison schedule is fixed in the supplied workbook.
    ref=checked//8
    m=quotes[('M'+str(ref+1),cep)]
    rivals=[r for (id,c),r in quotes.items() if c==cep and id in accepted and products[id]['ref']==ref and r['status']=='ok']
    if m['status']!='ok': expected='Referência sem cotação'
    elif not rivals: expected='Sem cotação concorrente'
    else:
        best=min(round(r['price']+r['freight'],2) for r in rivals)
        total=round(m['price']+m['freight'],2)
        expected='Concorrente vence' if total>best else 'Moderna vence' if total<best else 'Empate'
    assert actual==expected,(row,cep,actual,expected)
    checked+=1
assert checked==40,checked
formulas=load_workbook(sys.argv[1])
for row in range(7,30):
    c=formulas['Anúncios'].cell(row,20)
    assert c.hyperlink or (isinstance(c.value,str) and 'HYPERLINK(' in c.value.upper()),('Link não clicável',row)
    assert w['Anúncios'].cell(row,20).value,('Link sem valor calculado',row)
print('Excel recalculado: sem erros de fórmula; histórico e 184 tentativas presentes.')
