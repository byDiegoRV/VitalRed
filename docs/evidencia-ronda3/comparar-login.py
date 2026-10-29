from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
import io
res=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
    for scheme in ['light','dark']:
        for w,h in [(414,896),(1440,900)]:
            shots={}; html={}
            for port in (3402,3401):
                c=b.new_context(viewport={'width':w,'height':h},color_scheme=scheme); pg=c.new_page(); pg.goto(f'http://localhost:{port}/'); pg.wait_for_selector('form[data-form=login]'); pg.wait_for_timeout(500)
                shots[port]=Image.open(io.BytesIO(pg.screenshot())).convert('RGB'); html[port]=pg.inner_html('#app'); c.close()
            diff=ImageChops.difference(shots[3402],shots[3401]).getbbox()
            res.append((scheme,w,'pixeles idénticos' if diff is None else f'DIFERENCIA {diff}','HTML idéntico' if html[3402]==html[3401] else 'HTML DISTINTO'))
    # registro (también invitado)
    b.close()
for r in res: print(r)
