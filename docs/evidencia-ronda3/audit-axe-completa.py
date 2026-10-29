import sys, json
from playwright.sync_api import sync_playwright
port, label = sys.argv[1], sys.argv[2]
U=f'http://localhost:{port}/'
axe=open('/home/claude/axe/node_modules/axe-core/axe.min.js',encoding='utf8').read()
ROLES={'donor':('donante@vitalred.org','Donante123',['d/home','d/alert','d/triage','d/qr','d/profile','d/schedule','d/review','d/done','d/pdf']),
 'medical':('medico@vitalred.org','Medico123',['m/dashboard','m/new','m/radar','m/none','m/reception','m/profile']),
 'bank':('banco@vitalred.org','Banco123',['b/dash','b/appts','b/fleet','b/reports','b/profile']),
 'transport':('transporte@vitalred.org','Transp123',['t/home','t/check','t/transit','t/delivery','t/logbook','t/history','t/manual'])}
if len(sys.argv)>3: ROLES={k:v for k,v in ROLES.items() if k==sys.argv[3]}
VIEWS=[('movil',414,896),('escritorio',1440,900)]
out={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
    for scheme in ['dark','light']:
      for vn,w,h in VIEWS:
        for role,(em,pw,routes) in ROLES.items():
            c=b.new_context(viewport={'width':w,'height':h},color_scheme=scheme); pg=c.new_page(); pg.set_default_timeout(6000)
            pg.goto(U); pg.wait_for_selector('form[data-form=login]')
            pg.fill('input[name=email]',em); pg.fill('input[name=password]',pw); pg.click('form[data-form=login] button[type=submit]'); pg.wait_for_timeout(900)
            for r in routes:
                pg.goto(U+'#/'+r); pg.wait_for_timeout(500)
                pg.add_script_tag(content=axe)
                res=pg.evaluate("()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})")
                ov=pg.evaluate("()=>({sw:document.documentElement.scrollWidth,iw:innerWidth})")
                for v in res['violations']:
                    for n in v['nodes']:
                        d=(n['any'][0].get('data') or {}) if n['any'] else {}
                        k=(scheme,vn,r,v['id'],n['target'][0][:60],str(d.get('contrastRatio','')))
                        out[k]=1
                if ov['sw']>ov['iw']+1: out[(scheme,vn,r,'DESBORDE-HORIZONTAL',f"{ov['sw']}>{ov['iw']}",'')]=1
            c.close()
    b.close()
rows=sorted(out)
json.dump(rows,open(f'/tmp/full_{label}.json','w'))
print(label,'total',len(rows))
from collections import Counter
print(Counter((r[0],r[1]) for r in rows))
for r in rows: print(r)
