import sys, json, math
from playwright.sync_api import sync_playwright
PORT=sys.argv[1]; U=f'http://localhost:{PORT}/'
THEME=sys.argv[2] if len(sys.argv)>2 else 'light'; VIEW=sys.argv[3] if len(sys.argv)>3 else 'desktop'
VP={'width':414,'height':896} if VIEW=='mobile' else {'width':1280,'height':900}
AXE=open('/home/claude/axe/node_modules/axe-core/axe.min.js',encoding='utf8').read(); ST={'pg':None}; FOUND={}
def scan(label):
    pg=ST['pg']
    if pg is None or pg.is_closed(): return
    try:
        pg.add_script_tag(content=AXE)
        r=pg.evaluate("()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})")
        for v in r['violations']:
            for n in v['nodes']:
                d=(n['any'][0].get('data') or {}) if n['any'] else {}
                FOUND[(v['id'],n['target'][0][:70],str(d.get('contrastRatio','')),pg.evaluate('location.hash'))]=label
        ov=pg.evaluate('[document.documentElement.scrollWidth,innerWidth]')
        if ov[0]>ov[1]+1: FOUND[('DESBORDE',f'{ov[0]}>{ov[1]}','',pg.evaluate('location.hash'))]=label
    except Exception as e: pass
ok_n=0; bad=[]
def check(name, cond, extra=''):
    global ok_n
    scan(name)
    if cond: ok_n+=1; print('  OK   '+name)
    else: bad.append(name); print('  FALLA '+name, extra)
src=open('nav.py').read(); ns={}; exec("import math, json\n"+src[src.index('def polyline'):src.index('with sync_playwright() as p:')], ns); ns['OSRM_CALLS']=[]
H=lambda pg: pg.evaluate('location.hash')
def go(pg,r,w=450): pg.goto(U+'#/'+r); pg.wait_for_timeout(w)
def modal(pg):
    pg.wait_for_selector('.modal'); pg.wait_for_timeout(350); scan('modal abierto')
    if pg.locator('#modalAck').count(): pg.check('#modalAck')
    pg.click('.modal [data-ok]'); pg.wait_for_timeout(500)
def login(pg,em,pw):
    pg.wait_for_selector('form[data-form=login]'); pg.fill('input[name=email]',em); pg.fill('input[name=password]',pw); pg.click('form[data-form=login] button[type=submit]'); pg.wait_for_timeout(800)
def logout(pg): pg.click('[data-act=logout]'); modal(pg); pg.wait_for_selector('form[data-form=login]')
ACC={'m':('medico@vitalred.org','Medico123'),'d':('donante@vitalred.org','Donante123'),'b':('banco@vitalred.org','Banco123'),'t':('transporte@vitalred.org','Transp123')}
def as_(pg,k): login(pg,*ACC[k])
def txt(pg,sel='main'): return pg.inner_text(sel)
def fill_reg(pg,name,email,blood,pw='Abcdef1!x'):
    pg.fill('#name',name); pg.fill('#email',email); pg.fill('#password',pw); pg.fill('#password2',pw); pg.click('[data-act=regNext]'); pg.wait_for_timeout(400)
    for g,v in [('gender','m'),('age','adult'),('weight','ok')]: pg.locator(f'label:has(input[name={g}][value={v}])').click()
    pg.select_option('select[name=blood]',blood); pg.click('[data-act=regNext]'); pg.wait_for_timeout(300)
    for i in range(3): pg.locator(f'label:has(input[name=risk{i}][value=no])').click()
    pg.click('[data-act=regNext]'); pg.wait_for_timeout(300); pg.check('input[name=terms]'); pg.click('[data-act=regNext]'); pg.wait_for_timeout(800)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
    ctx=b.new_context(viewport=VP,color_scheme=THEME); ctx.route('**/router.project-osrm.org/**',ns['osrm'])
    pg=ctx.new_page(); ST['pg']=pg; pg.set_default_timeout(7000); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    print('== ARRANQUE Y SESIÓN')
    pg.goto(U+'#/m/dashboard'); pg.wait_for_timeout(600); check('abrir una pantalla interna sin sesión -> login', H(pg)=='#/login', H(pg))
    as_(pg,'m'); check('login médico -> panel', H(pg)=='#/m/dashboard', H(pg))
    pg.reload(); pg.wait_for_timeout(600); check('recargar (F5) conserva la sesión de la pestaña', H(pg)=='#/m/dashboard', H(pg))
    pg.goto(U); pg.wait_for_timeout(700); check('abrir la app de nuevo (nueva navegación) -> siempre login', H(pg) in ('','#/login') and pg.locator('form[data-form=login]').count()==1, H(pg))
    print('== UN SOLO PERFIL ACTIVO')
    as_(pg,'m'); p2=ctx.new_page(); p2.set_default_timeout(7000); p2.goto(U); p2.wait_for_selector('form[data-form=login]'); login(p2,*ACC['d'])
    check('segunda pestaña no puede iniciar sesión con otro perfil', H(p2) in ('','#/login') and 'sesión activa' in p2.inner_text('#toasts'), (H(p2), p2.inner_text('#toasts')[:80]))
    logout(pg); login(p2,*ACC['d']); check('al cerrar sesión en la primera, la segunda ya puede entrar', H(p2)=='#/d/profile', H(p2)); logout(p2); p2.close()
    print('== REGISTRO')
    pg.goto(U+'#/register'); pg.wait_for_selector('#name'); fill_reg(pg,'Nuevo Donante','nuevo@vitalred.org','A+')
    check('registro completo -> perfil del donante', H(pg)=='#/d/profile', H(pg))
    u=pg.evaluate("JSON.parse(localStorage.getItem('vitalred-v3')).users.find(u=>u.email==='nuevo@vitalred.org')"); check('se guardan los datos médicos del registro', u and u['medical']['weight']=='ok' and u['medical']['blood']=='A+', u)
    go(pg,'d/medical'); check('"Mis datos médicos" muestra lo registrado (A+, 50 kg o más)', pg.locator('select[name=blood]').input_value()=='A+' and pg.locator('input[name=weight][value=ok]').is_checked())
    logout(pg); pg.goto(U+'#/register'); pg.wait_for_selector('#name'); check('nuevo registro empieza vacío (sin datos del anterior)', pg.input_value('#name')=='' and pg.input_value('#email')=='')
    pg.fill('#name','Otra Persona'); pg.fill('#email','nuevo@vitalred.org'); pg.fill('#password','Abcdef1!x'); pg.fill('#password2','Abcdef1!x'); pg.click('[data-act=regNext]'); pg.wait_for_timeout(400)
    check('correo repetido se rechaza', 'Ya existe una cuenta' in txt(pg) and pg.locator('#regForm input[name=gender]').count()==0)
    pg.fill('#email','NUEVO@VitalRed.org '); pg.click('[data-act=regNext]'); pg.wait_for_timeout(400); check('también con mayúsculas/espacios', 'Ya existe una cuenta' in txt(pg))
    pg.fill('#email','donante@vitalred.org'); pg.click('[data-act=regNext]'); pg.wait_for_timeout(400); check('y con un usuario de demostración', 'Ya existe una cuenta' in txt(pg))
    print('== MÉDICO LANZA UNA SOLICITUD (caso nuevo)')
    pg.goto(U+'#/login'); pg.wait_for_timeout(400); as_(pg,'m'); go(pg,'m/new')
    pg.select_option('#hospital','Hospital San Rafael'); pg.select_option('#component','Plasma fresco congelado'); pg.select_option('#area','Quirófano')
    pg.click('label.tbtn:has-text("A+")'); pg.click('button[data-act=unit][data-d="1"]'); pg.click('label.tbtn:has-text("CÓDIGO ROJO")'); pg.wait_for_timeout(200); pg.click('#launchBtn'); modal(pg)
    check('radar abierto con la solicitud', H(pg)=='#/m/radar' and 'Plasma fresco congelado' in txt(pg) and 'Hospital San Rafael' in txt(pg), txt(pg)[:200])
    check('notificados = donantes compatibles reales (2: Aleks O+ y Nuevo A+)', '2 notificados' in txt(pg), txt(pg)[:300])
    go(pg,'m/new'); check('con solicitud activa, m/new redirige al radar', H(pg)=='#/m/radar', H(pg)); check('se informa el motivo', 'solicitud en curso' in pg.inner_text('#toasts'))
    logout(pg)
    print('== DONANTE RECIBE, SE ARREPIENTE Y LUEGO AGENDA')
    as_(pg,'d'); go(pg,'d/home'); check('el donante compatible ve la solicitud en su inicio', 'CÓDIGO ROJO' in txt(pg) and 'Hospital San Rafael' in txt(pg))
    go(pg,'d/alert'); check('alerta con hospital, hemocomponente y distancia', 'Hospital San Rafael' in txt(pg) and 'Plasma fresco congelado' in txt(pg) and 'km del banco' in txt(pg))
    pg.click('[data-act=accept]'); modal(pg)
    for i,v in enumerate(['no','no','no','yes','yes']): pg.locator(f'label:has(input[name=t{i}][value={v}])').click()
    pg.click('#triageBtn'); pg.wait_for_timeout(300); pg.click('[data-act=confirmTriage]'); modal(pg); check('llega a agendar', H(pg)=='#/d/schedule', H(pg))
    check('botón "Ya no puedo donar" en agendar', pg.locator('[data-act=declineFlow]').count()==1)
    pg.click('[data-act=declineFlow]'); modal(pg); check('arrepentimiento -> perfil', H(pg)=='#/d/profile', H(pg))
    st=pg.evaluate("JSON.parse(localStorage.getItem('vitalred-v3')).req"); check('la solicitud vuelve a buscar donantes', st['status']=='buscando' and 'donor' not in st and st.get('declined')==1, st)
    go(pg,'d/schedule'); check('tras arrepentirse no puede forzar el paso de agendar', H(pg)=='#/d/alert', H(pg))
    pg.click('[data-act=accept]'); modal(pg)
    for i,v in enumerate(['no','no','no','yes','yes']): pg.locator(f'label:has(input[name=t{i}][value={v}])').click()
    pg.click('#triageBtn'); pg.wait_for_timeout(300); pg.click('[data-act=confirmTriage]'); modal(pg); pg.locator('label:has(input[name=slot])').nth(2).click(); pg.click('[data-act=confirmSlot]'); modal(pg)
    check('cita agendada -> pase', H(pg)=='#/d/qr' and 'VR-2026-' in txt(pg), H(pg))
    check('el pase ya no ofrece "simular donación"', 'Simular donación' not in txt(pg))
    for r in ['d/alert','d/triage','d/review','d/schedule','d/done','d/pdf','d/rejected']:
        go(pg,r,350); check(f'forzar #/{r} con cita agendada -> vuelve al pase', H(pg)=='#/d/qr', H(pg))
    logout(pg)
    print('== MÉDICO VE "PROGRAMADA"')
    as_(pg,'m'); go(pg,'m/radar'); t=txt(pg); check('ventana "Cita programada" con donante, hora y folio', 'Cita programada' in t and 'Aleks L.' in t and '09:00' in t and 'VR-2026-' in t, t[:300]); logout(pg)
    print('== BANCO REGISTRA LA DONACIÓN Y DESPACHA')
    as_(pg,'b'); go(pg,'b/dash'); check('la solicitud aparece en el banco', 'CITA PROGRAMADA' in txt(pg) and 'Hospital San Rafael' in txt(pg))
    go(pg,'b/appts'); check('la cita del donante está en la agenda', 'Aleks López' in txt(pg))
    pg.click('[data-act=authorize]'); modal(pg); check('autorizar ingreso -> extracción', 'Registrar donación completada' in txt(pg))
    pg.click('[data-act=completeAppt]'); modal(pg)
    go(pg,'b/dash'); check('banco ve la donación completa y puede despachar', 'DONACIÓN COMPLETA' in txt(pg) and pg.locator('[data-act=dispatch]').count()==1)
    pg.click('[data-act=dispatch]'); modal(pg); check('unidad despachada (traslado en ruta)', 'Traslado: En ruta' in txt(pg), txt(pg)[:200]); logout(pg)
    print('== DONANTE: HISTORIAL')
    as_(pg,'d'); go(pg,'d/qr'); check('el pase muestra "Donación completada"', 'Donación completada' in txt(pg))
    go(pg,'d/done'); check('pantalla de gracias con detalle del destino', 'Hospital San Rafael' in txt(pg) and 'Plasma fresco congelado' in txt(pg))
    go(pg,'d/history'); t=txt(pg); check('historial: 5 donaciones, 15 vidas, con la nueva arriba', t.count('COMPLETADA')==5 and '15' in t and t.index('Hospital San Rafael')<t.index('Hospital Ángeles'), t[:400])
    go(pg,'d/triage'); check('terminada la donación ya no puede volver al pre-triaje', H(pg)=='#/d/done', H(pg))
    go(pg,'d/home'); check('inicio: 5 donaciones y botón de historial', pg.locator('[data-go="d/history"]').count()==1 and '5' in txt(pg)); logout(pg)
    print('== TRANSPORTISTA ENTREGA')
    as_(pg,'t'); go(pg,'t/home'); check('el viaje del banco aparece al transportista', 'Hospital San Rafael' in txt(pg), txt(pg)[:200])
    go(pg,'t/check')
    for i in range(3): pg.locator(f'input[data-idx="{i}"]').check(force=True); pg.wait_for_timeout(120)
    pg.click('[data-act=dummyPhotoOrigin]'); pg.wait_for_timeout(300); pg.click('#routeBtn'); modal(pg)
    pg.wait_for_selector('#tripMap .leaflet-marker-icon'); pg.wait_for_timeout(2500); check('ruta hacia el hospital que lo pidió', 'Hospital San Rafael' in txt(pg) and 'OSRM' in pg.inner_text('#routeSrc'), pg.inner_text('#routeSrc'))
    go(pg,'t/delivery')
    for a in ['toggleDeliveryScan','toggleDeliverySign','dummyPhotoDelivery']: pg.click(f'[data-act={a}]'); pg.wait_for_timeout(250)
    pg.click('[data-act=deliver]'); modal(pg); check('entrega -> bitácora con el destino', H(pg)=='#/t/logbook' and 'Hospital San Rafael' in txt(pg)); logout(pg)
    print('== MÉDICO RECIBE')
    as_(pg,'m'); go(pg,'m/radar'); t=txt(pg); check('radar: donación completada y unidad entregada', 'Donación completada' in t and 'Unidad entregada' in t and pg.locator('[data-go="m/reception"]').count()==1, t[:300])
    pg.click('[data-go="m/reception"]'); pg.wait_for_timeout(300)
    pg.click('[data-act=sigToggle] >> nth=0'); pg.click('[data-act=sigToggle] >> nth=1')
    for c in pg.locator('.chk').all(): c.check()
    pg.wait_for_timeout(200); check('recepción habilita el botón con firmas y verificaciones', not pg.is_disabled('#recvBtn')); pg.click('#recvBtn'); modal(pg)
    check('caso cerrado', 'Caso cerrado' in txt(pg), txt(pg)[:200]); go(pg,'m/new'); check('terminado el caso ya puede crear otra solicitud', H(pg)=='#/m/new', H(pg))
    print('== MÉDICO SOLO (simulación de etapas)')
    pg.click('label.tbtn:has-text("O-")'); pg.click('label.tbtn:has-text("Urgente")'); pg.select_option('#hospital','Hospital del Valle'); pg.click('#launchBtn'); modal(pg)
    for esp,btn in [('Donante en camino','Simular: un donante acepta'),('Cita programada','Simular: cita agendada'),('Donación completada','Simular: donación completada'),('Unidad en ruta','Simular: banco despacha la unidad'),('Unidad entregada','Simular: unidad entregada')]:
        pg.click(f'button:has-text("{btn}")'); pg.wait_for_timeout(350); check(f'etapa: {esp}', esp in txt(pg), txt(pg)[:160])
    check('hospital distinto en el nuevo caso (Hospital del Valle)', 'Hospital del Valle' in txt(pg))
    pg.click('[data-go="m/reception"]'); pg.wait_for_timeout(300); pg.click('[data-act=sigToggle] >> nth=0'); pg.click('[data-act=sigToggle] >> nth=1')
    for c in pg.locator('.chk').all(): c.check()
    pg.wait_for_timeout(200); pg.click('#recvBtn'); modal(pg)
    logout(pg)
    print('== CASOS DE DEMOSTRACIÓN DISTINTOS')
    as_(pg,'d'); hs=[]
    for k in range(3):
        go(pg,'d/alert'); 
        if pg.locator('[data-act=demoAlert]').count()==0: break
        pg.click('[data-act=demoAlert]'); pg.wait_for_timeout(400); hs.append(pg.inner_text('main h2:has-text("Hospital"), main h2:has-text("Clínica")')); 
        logout(pg); as_(pg,'m'); go(pg,'m/radar'); pg.click('[data-act=cancelReq]'); pg.wait_for_selector('.modal'); pg.click('.modal [data-ok]'); pg.wait_for_timeout(300); logout(pg); as_(pg,'d')
    check(f'cada alerta de demostración trae un caso distinto {hs}', len(set(hs))==len(hs)==3, hs)
    check('sin errores JS', not errs, errs)
    b.close()
print(f'\nRESULTADO: {ok_n} correctas, {len(bad)} con fallas', bad)
print(f'AXE ({THEME}/{VIEW}): {len(FOUND)} hallazgos')
for k,v in sorted(FOUND.items()): print('   ',k,'| durante:',v[:60])
