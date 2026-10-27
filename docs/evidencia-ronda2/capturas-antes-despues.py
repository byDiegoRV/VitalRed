import sys, subprocess
from playwright.sync_api import sync_playwright
port,label=sys.argv[1],sys.argv[2]; U=f'http://localhost:{port}/'; out='/home/claude/repo2/docs/evidencia-ronda2/'
TRIP={'id':'TR-9902','origin':'Banco de Sangre Central','dest':'Hospital General','content':'2 u. Concentrado de hematíes O-','distance':'8.4 km','eta':'18 min','status':'en_transito','check0':True,'check1':True,'check2':True,'scanOk':False,'signOk':False,'photoOrigin':None,'photoDelivery':None,'thermalLogs':[{'time':f'10:{m:02d}','temp':round(4.2+((m%3)/10),1),'status':'NORMAL'} for m in range(0,60,5)]}
def login(b,em,pw,w,h):
    c=b.new_context(viewport={'width':w,'height':h},color_scheme='light'); pg=c.new_page(); pg.set_default_timeout(8000)
    pg.goto(U); pg.wait_for_selector('form[data-form=login]'); pg.fill('input[name=email]',em); pg.fill('input[name=password]',pw); pg.click('form[data-form=login] button[type=submit]'); pg.wait_for_timeout(900)
    return c,pg
def shot(pg,name,wait=900):
    pg.wait_for_timeout(wait); pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(200); pg.screenshot(path=f'{out}{label}-{name}.png')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
    c,pg=login(b,'medico@vitalred.org','Medico123',1440,900)
    pg.goto(U+'#/m/dashboard'); pg.wait_for_timeout(4800); shot(pg,'1-medico-dashboard-escritorio')
    pg.goto(U+'#/m/new'); pg.wait_for_timeout(500); pg.click('label.tbtn:has-text("AB-")'); pg.click('label.tbtn:has-text("Urgente")'); pg.wait_for_timeout(300); shot(pg,'2-medico-nueva-solicitud',200); c.close()
    c,pg=login(b,'banco@vitalred.org','Banco123',414,896)
    pg.goto(U+'#/b/appts'); pg.wait_for_timeout(4800); shot(pg,'3-banco-citas-movil'); print(label,'ancho citas movil:',pg.evaluate('[document.documentElement.scrollWidth,innerWidth]')); c.close()
    c,pg=login(b,'banco@vitalred.org','Banco123',1440,900)
    pg.goto(U+'#/b/fleet'); pg.wait_for_timeout(5000); shot(pg,'4-banco-radar-escritorio',300); c.close()
    c,pg=login(b,'transporte@vitalred.org','Transp123',1280,900)
    pg.evaluate("(t)=>{const k='vitalred-v3';const s=JSON.parse(localStorage.getItem(k)||'{}');s.trip=t;localStorage.setItem(k,JSON.stringify(s))}",TRIP); pg.reload(); pg.wait_for_timeout(500)
    pg.goto(U+'#/t/check'); pg.wait_for_timeout(500); pg.click('[data-act=dummyPhotoOrigin]'); pg.wait_for_timeout(400)
    pg.goto(U+'#/t/delivery'); pg.wait_for_timeout(500)
    for a in ['toggleDeliveryScan','toggleDeliverySign','dummyPhotoDelivery']: pg.click(f'[data-act={a}]'); pg.wait_for_timeout(300)
    pg.click('[data-act=deliver]'); pg.wait_for_timeout(900)
    pg.pdf(path=f'{out}{label}-5-bitacora.pdf',format='A4',print_background=True,prefer_css_page_size=True); c.close()
    b.close()
