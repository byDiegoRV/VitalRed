import sys
from playwright.sync_api import sync_playwright
port,label=sys.argv[1],sys.argv[2]
axe=open('/home/claude/axe/node_modules/axe-core/axe.min.js',encoding='utf8').read()
TAGS=['wcag2a','wcag2aa','wcag21a','wcag21aa']
U=f'http://localhost:{port}/'
def scan(pg,name):
    pg.add_script_tag(content=axe)
    res=pg.evaluate("(t)=>axe.run(document,{runOnly:{type:'tag',values:t}})",TAGS)
    items=[]
    for v in res['violations']:
        for n in v['nodes']:
            d=(n['any'][0].get('data') or {}) if n['any'] else {}
            items.append((v['id'],n['target'][0],d.get('contrastRatio','')))
    print(f"[{label}] {name}: {len(items)} violaciones")
    for i in items: print('    ',i)
def login(pg,email,pw,hash_):
    pg.goto(U); pg.wait_for_selector('form[data-form=login]')
    pg.fill('input[name=email]',email); pg.fill('input[name=password]',pw); pg.click('form[data-form=login] button[type=submit]')
    pg.wait_for_timeout(700); pg.goto(U+hash_); pg.wait_for_timeout(700)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
    for scheme in ['dark','light']:
        print('--- tema',scheme)
        ctx=b.new_context(viewport={'width':414,'height':896},color_scheme=scheme); pg=ctx.new_page(); pg.set_default_timeout(5000)
        pg.goto(U); pg.wait_for_selector('form[data-form=login]'); scan(pg,'Login'); ctx.close()
        ctx=b.new_context(viewport={'width':414,'height':896},color_scheme=scheme); pg=ctx.new_page(); pg.set_default_timeout(5000)
        login(pg,'donante@vitalred.org','Donante123','#/d/triage'); scan(pg,'Pre-triaje'); ctx.close()
        ctx=b.new_context(viewport={'width':414,'height':896},color_scheme=scheme); pg=ctx.new_page(); pg.set_default_timeout(5000)
        login(pg,'banco@vitalred.org','Banco123','#/b/dash'); scan(pg,'Dashboard banco'); ctx.close()
    b.close()
