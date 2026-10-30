import sys, json, math
from playwright.sync_api import sync_playwright
PORT=sys.argv[1]; U=f'http://localhost:{PORT}/'
ok_n=0; bad=[]
def check(name, cond, extra=''):
    global ok_n
    if cond: ok_n+=1; print('  OK  ',name)
    else: bad.append(name); print('  FALLA',name,extra)
def login(b,em,pw,w=1280,h=900):
    c=b.new_context(viewport={'width':w,'height':h}); pg=c.new_page(); pg.set_default_timeout(6000)
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)[:160]))
    pg.goto(U); pg.wait_for_selector('form[data-form=login]'); pg.fill('input[name=email]',em); pg.fill('input[name=password]',pw); pg.click('form[data-form=login] button[type=submit]'); pg.wait_for_timeout(900)
    return c,pg,errs
H=lambda pg: pg.evaluate('location.hash')
def go(pg,r,w=500): pg.goto(U+'#/'+r); pg.wait_for_timeout(w)
def modal(pg, ack=None):
    pg.wait_for_selector('.modal'); has=pg.locator('#modalAck').count()
    if has:
        check('el botón Confirmar empieza deshabilitado (hay casilla)', pg.is_disabled('.modal [data-ok]'))
        pg.check('#modalAck'); 
        check('al marcar la casilla se habilita', not pg.is_disabled('.modal [data-ok]'))
    pg.click('.modal [data-ok]'); pg.wait_for_timeout(500)
def polyline(pts):
    out='';la=lo=0
    for a,b in pts:
        for v,p in ((round(a*1e5),la),(round(b*1e5),lo)):
            d=v-p; d=~(d<<1) if d<0 else d<<1
            while d>=0x20: out+=chr((0x20|(d&0x1f))+63); d>>=5
            out+=chr(d+63)
        la,lo=round(a*1e5),round(b*1e5)
    return out
def hav(a,b):
    r=math.pi/180; h=math.sin((b[0]-a[0])*r/2)**2+math.cos(a[0]*r)*math.cos(b[0]*r)*math.sin((b[1]-a[1])*r/2)**2; return 12742000*math.asin(math.sqrt(h))
OSRM_CALLS=[]
def osrm(route):
    url=route.request.url; OSRM_CALLS.append(url)
    co=url.split('/driving/')[1].split('?')[0].split(';'); (lo1,la1),(lo2,la2)=[tuple(map(float,c.split(',')[:2])) for c in co[:2]]
    pts=[(la1+(la2-la1)*k/12+0.002*math.sin(k/2), lo1+(lo2-lo1)*k/12) for k in range(13)]; pts[0]=(la1,lo1); pts[-1]=(la2,lo2)
    d=sum(hav(pts[i],pts[i+1]) for i in range(12))*1.0; dur=d/(30/3.6)
    enc=polyline(pts); man=lambda t,loc:{'type':t,'modifier':'straight','location':loc,'bearing_before':0,'bearing_after':0}
    body={'code':'Ok','routes':[{'geometry':enc,'weight':dur,'weight_name':'routability','duration':dur,'distance':d,'legs':[{'steps':[{'geometry':enc,'maneuver':man('depart',[lo1,la1]),'mode':'driving','driving_side':'right','name':'Av. Simulada','intersections':[],'weight':dur,'duration':dur,'distance':d},{'geometry':polyline([pts[-1],pts[-1]]),'maneuver':man('arrive',[lo2,la2]),'mode':'driving','driving_side':'right','name':'','intersections':[],'weight':0,'duration':0,'distance':0}],'summary':'Av. Simulada','weight':dur,'duration':dur,'distance':d}]}],'waypoints':[{'hint':'x','distance':1,'name':'','location':[lo1,la1]},{'hint':'x','distance':1,'name':'','location':[lo2,la2]}]}
    route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
    print('== BANCO (acciones reales)')
    c,pg,errs=login(b,'banco@vitalred.org','Banco123')
    go(pg,'b/dash'); crit0=pg.inner_text('.grid.kpi .card:nth-child(3) h1')
    pg.click('[data-act=startCampaign]'); modal(pg); check('campaña activa visible en el panel', 'Campaña activa' in pg.inner_text('main') and pg.locator('[data-act=endCampaign]').count()==1)
    pg.click('[data-act=reserveReq]'); modal(pg); check('reservar unidades cambia el botón y baja el stock O-', pg.locator('[data-act=releaseReq]').count()==1)
    crit1=pg.inner_text('.grid.kpi .card:nth-child(3) h1'); check(f'alertas críticas dinámicas ({crit0} -> {crit1})', crit1!=crit0)
    pg.click('[data-act=detailReq]'); pg.wait_for_selector('.modal'); check('"Ver detalles" abre una ventana con datos', 'Hospital San Rafael' in pg.inner_text('.modal')); pg.click('.modal [data-ok]'); pg.wait_for_timeout(300)
    go(pg,'b/reports')
    with pg.expect_download() as dl: pg.click('[data-act=exportCsv]')
    path=dl.value.path(); txt=open(path,encoding='utf-8-sig').read(); check('Exportar CSV descarga un archivo real', dl.value.suggested_filename.endswith('.csv') and '#B-91024' in txt and txt.count('\n')>=6, dl.value.suggested_filename)
    pg.evaluate("window.print=()=>{window.__printed=true}"); pg.click('[data-act=exportPdf]'); pg.wait_for_timeout(300)
    check('Exportar PDF prepara la hoja de impresión', pg.evaluate('window.__printed===true') and pg.locator('.print-sheet .doc table').count()==1)
    pg.pdf(path='/tmp/shots/reporte.pdf',format='A4',print_background=True)
    check('sin errores JS (banco)', not errs, errs); c.close()
    print('== CURSOR')
    c,pg,errs=login(b,'banco@vitalred.org','Banco123'); go(pg,'b/dash')
    cur=lambda sel: pg.evaluate("(s)=>getComputedStyle(document.querySelector(s)).cursor",sel)
    check('texto dentro de la app: cursor normal (flecha)', cur('main p')=='default', cur('main p')); check('botón: mano', cur('.btn')=='pointer', cur('.btn')); c.close()
    c=b.new_context(viewport={'width':1280,'height':900}); pg=c.new_page(); pg.goto(U); pg.wait_for_selector('form[data-form=login]')
    check('login SIN cambios de cursor (sigue el comportamiento original)', pg.evaluate("getComputedStyle(document.querySelector('.auth-split p, main p')).cursor")=='auto'); c.close()
    print('== RUTAS REALES (respuesta OSRM simulada)')
    c,pg,errs=login(b,'banco@vitalred.org','Banco123'); c.route('**/router.project-osrm.org/**',osrm)
    pg.goto(U+'#/b/fleet'); pg.wait_for_selector('#fleetMap .leaflet-marker-icon'); pg.wait_for_timeout(6500)
    lab=pg.inner_text('#routeSrc'); check('etiqueta indica rutas reales OSRM', 'OSRM' in lab, lab)
    info=pg.inner_text('[data-info="AMB-017"]'); check(f'ETA/distancia de AMB-017 vienen de la ruta ({info})', 'km al banco' in info and 'estimado' not in info, info)
    check('se hicieron peticiones al servicio de rutas', len(OSRM_CALLS)>=3, len(OSRM_CALLS))
    pg.click('button[data-amb="AMB-017"]'); pg.wait_for_timeout(800); check('Ver en mapa dibuja la ruta de recogida', pg.locator('#fleetMap path.leaflet-interactive').count()>=2)
    pg.click('[data-act=forceAssign][data-id="AMB-011"]'); modal(pg); check('Forzar asignación cambia el estado a Asignada', 'Asignada' in pg.inner_text('main') and pg.locator('[data-act=releaseUnit]').count()==1)
    check('sin errores JS (radar)', not errs, errs); c.close()
    c,pg,errs=login(b,'transporte@vitalred.org','Transp123'); c.route('**/router.project-osrm.org/**',osrm)
    pg.evaluate("(t)=>{const k='vitalred-v3';const s=JSON.parse(localStorage.getItem(k)||'{}');s.trip=t;localStorage.setItem(k,JSON.stringify(s))}",{'id':'TR-9902','origin':'Banco de Sangre Central','dest':'Hospital General','content':'x','distance':'8.4 km','eta':'18 min','status':'transito','check0':True,'check1':True,'check2':True,'scanOk':False,'signOk':False,'photoOrigin':None,'photoDelivery':None,'thermalLogs':[]}); pg.reload(); pg.wait_for_timeout(500)
    pg.goto(U+'#/t/transit'); pg.wait_for_selector('#tripMap .leaflet-marker-icon'); pg.wait_for_timeout(2500)
    d=pg.inner_text('#tripDist'); e=pg.inner_text('#tripEta'); check(f'transit muestra distancia y tiempo calculados ({d}, {e})', d!='8.4 km' and e!='18 min', (d,e))
    st=pg.evaluate("JSON.parse(localStorage.getItem('vitalred-v3')).trip"); check('se guardan en el viaje (aparecen también en Inicio)', st['distance']==d, st)
    check('sin errores JS (ruta)', not errs, errs); c.close()
    b.close()
print(f'\nRESULTADO: {ok_n} correctas, {len(bad)} con fallas', bad)
