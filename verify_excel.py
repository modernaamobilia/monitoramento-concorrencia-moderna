import sys
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
formulas=load_workbook(sys.argv[1])
for row in range(7,30):
    c=formulas['Anúncios'].cell(row,20)
    assert c.hyperlink or (isinstance(c.value,str) and 'HYPERLINK(' in c.value.upper()),('Link não clicável',row)
    assert w['Anúncios'].cell(row,20).value,('Link sem valor calculado',row)
print('Excel recalculado: sem erros de fórmula; histórico e 184 tentativas presentes.')
