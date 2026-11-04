import sys, json, math
from playwright.sync_api import sync_playwright
exec(open('nav.py').read().split("with sync_playwright() as p:")[0].split("PORT=sys.argv[1]")[0])  # sin efecto
PORT=sys.argv[1]; U=f'http://localhost:{PORT}/'
axe=open('/home/claude/axe/node_modules/axe-core/axe.min.js',encoding='utf8').read()
TAGS=['wcag2a','wcag2aa','wcag21a','wcag21aa']
src=open('nav.py').read()
ns={}; exec("import math, json\n"+src[src.index('def polyline'):src.index('with sync_playwright() as p:')], ns)
OSRM_CALLS=[]; ns['OSRM_CALLS']=OSRM_CALLS
rows=[]
def scan(pg,label,theme,view):
    pg.add_script_tag(content=axe)
    r=pg.evaluate("()=>axe.run(document,{runOnly:{type:'tag',values:%s}})"%json.dumps(TAGS))
    ov=pg.evaluate("()=>[document.documentElement.scrollWidth,innerWidth]")
    for v in r['violations']:
        for n in v['nodes']:
            d=(n['any'][0].get('data') or {}) if n['any'] else {}
            rows.append((theme,view,label,v['id'],n['target'][0][:70],str(d.get('contrastRatio',''))))
    if ov[0]>ov[1]+1: rows.append((theme,view,label,'DESBORDE',f'{ov[0]}>{ov[1]}',''))
def login(b,em,pw,w,h,scheme):
    c=b.new_context(viewport={'width':w,'height':h},color_scheme=scheme); pg=c.new_page(); pg.set_default_timeout(6000)
    c.route('**/router.project-osrm.org/**', ns['osrm'])
    pg.goto(U); pg.wait_for_selector('form[data-form=login]'); pg.fill('input[name=email]',em); pg.fill('input[name=password]',pw); pg.click('form[data-form=login] button[type=submit]'); pg.wait_for_timeout(800)
    return c,pg
def go(pg,r,w=500): pg.goto(U+'#/'+r); pg.wait_for_timeout(w)
def setstate(pg,patch): pg.evaluate("(p)=>{const k='vitalred-v3';const s=JSON.parse(localStorage.getItem(k)||'{}');Object.assign(s,p);localStorage.setItem(k,JSON.stringify(s))}",patch); pg.reload(); pg.wait_for_timeout(500)
def close_modal(pg):
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
TRIP={'id':'TR-9902','origin':'Banco de Sangre Central','dest':'Hospital General','content':'2 u. Concentrado de hematíes O-','distance':'8.4 km','eta':'18 min','status':'transito','check0':True,'check1':True,'check2':True,'scanOk':True,'signOk':True,'photoOrigin':None,'photoDelivery':None,'thermalLogs':[{'time':'10:00','temp':4.2,'status':'NORMAL'}]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
    for theme in ['light','dark']:
        for view,w,h in [('movil',414,896),('escritorio',1440,900)]:
            T=(theme,view)
            # donante
            c,pg=login(b,'donante@vitalred.org','Donante123',w,h,theme)
            go(pg,'ruta-inexistente'); scan(pg,'404',*T)
            setstate(pg,{'campaign':{'blood':['B-','AB-'],'at':'2026-10-28T10:00:00Z','notified':132}}); go(pg,'d/home'); scan(pg,'d/home con convocatoria',*T)
            go(pg,'d/alert'); scan(pg,'d/alert con convocatoria',*T)
            pg.click('[data-act=accept]'); pg.wait_for_selector('.modal'); scan(pg,'modal aceptar alerta (con casilla)',*T); pg.check('#modalAck'); scan(pg,'modal con casilla marcada',*T); close_modal(pg)
            c.close()

            # invitado: registro con reglas de contraseña cumplidas (estado con texto verde)
            c=b.new_context(viewport={'width':w,'height':h},color_scheme=theme); pg=c.new_page(); pg.set_default_timeout(6000)
            pg.goto(U+'#/register'); pg.wait_for_timeout(600)
            pw=pg.locator('#password')
            if pw.count(): pw.fill('Abcdef1!x'); pg.wait_for_timeout(200)
            scan(pg,'register con reglas cumplidas',*T); c.close()
            # donante: triaje con respuestas marcadas
            c,pg=login(b,'donante@vitalred.org','Donante123',w,h,theme)
            setstate(pg,{'inFlow':True,'triage':None,'triageAns':None}); go(pg,'d/triage')
            for i,v in enumerate(['no','no','no','yes','yes']): pg.locator(f'label:has(input[name=t{i}][value={v}])').click()
            scan(pg,'d/triage con respuestas',*T); c.close()
            # médico
            c,pg=login(b,'medico@vitalred.org','Medico123',w,h,theme)
            go(pg,'m/new'); pg.click('label.tbtn:has-text("AB-")'); pg.click('label.tbtn:has-text("CÓDIGO ROJO")'); pg.wait_for_timeout(200); pg.click('#launchBtn'); pg.wait_for_selector('.modal'); scan(pg,'modal lanzar código rojo',*T); close_modal(pg)
            c.close()
            # banco
            c,pg=login(b,'banco@vitalred.org','Banco123',w,h,theme)
            setstate(pg,{'campaign':{'blood':['B-','AB-'],'at':'2026-10-28T10:00:00Z','notified':132},'reserved':['SR-4821'],'fleet':{'AMB-011':{'state':'Asignada','req':'ST-2048'}}})
            go(pg,'b/dash'); scan(pg,'b/dash con campaña y reserva',*T)
            go(pg,'b/fleet',6500); scan(pg,'b/fleet con unidad asignada y rutas',*T)
            pg.click('[data-act=releaseUnit]'); pg.wait_for_selector('.modal'); scan(pg,'modal liberar unidad',*T); close_modal(pg)
            go(pg,'b/dash'); pg.click('[data-act=detailReq]'); pg.wait_for_selector('.modal'); scan(pg,'modal detalle de solicitud',*T); close_modal(pg)
            go(pg,'b/appts'); pg.evaluate("window.print=()=>{}")
            go(pg,'b/reports'); pg.click('[data-act=exportPdf]'); scan(pg,'b/reports con hoja de impresión',*T)
            c.close()
            # transportista
            c,pg=login(b,'transporte@vitalred.org','Transp123',w,h,theme)
            setstate(pg,{'trip':TRIP}); go(pg,'t/transit',3000); scan(pg,'t/transit con ruta calculada',*T)
            go(pg,'t/delivery'); scan(pg,'t/delivery',*T)
            pg.click('[data-act=deliver]') if False else None
            setstate(pg,{'trip':{**TRIP,'status':'custodia'}}); go(pg,'t/check'); pg.locator('input[data-idx="0"]').check(force=True); pg.click('[data-act=dummyPhotoOrigin]'); 
            for i in (1,2): pg.locator(f'input[data-idx="{i}"]').check(force=True); pg.wait_for_timeout(100)
            pg.click('#routeBtn'); pg.wait_for_selector('.modal'); scan(pg,'modal iniciar traslado',*T); close_modal(pg)
            c.close()
    b.close()
print('TOTAL hallazgos en estados nuevos:',len(rows))
for r in sorted(set(rows)): print(r)
