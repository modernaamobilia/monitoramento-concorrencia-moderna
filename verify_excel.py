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
assert any(c.hyperlink for row in load_workbook(sys.argv[1])['Anúncios'] for c in row)
print('Excel recalculado: sem erros de fórmula; histórico e 184 tentativas presentes.')
