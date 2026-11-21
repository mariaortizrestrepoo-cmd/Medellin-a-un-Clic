from playwright.sync_api import sync_playwright
import http.server, threading, functools, re
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='dist'); H.log_message=lambda *a:None
s=http.server.ThreadingHTTPServer(('127.0.0.1',8810),H); threading.Thread(target=s.serve_forever,daemon=True).start()
U='http://127.0.0.1:8810/'
import os; key=os.environ['CONTENT_KEY'].strip()
with sync_playwright() as p:
    b=p.chromium.launch()
    for loc,vp in [('es-CO',(390,844)),('en-US',(320,640))]:
        ctx=b.new_context(viewport={'width':vp[0],'height':vp[1]},locale=loc); pg=ctx.new_page()
        pg.route('**/medellin-access/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"ok":true}'))
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto(U); pg.wait_for_timeout(800)
        print(loc,'locked:', 'locked' in pg.evaluate("document.body.className"), pg.evaluate("[...document.querySelectorAll('#lock .'+(document.body.classList.contains('lang-es')?'es':'en'))].filter(e=>e.offsetParent).map(e=>e.textContent.trim()).slice(0,2)"))
        print(' vault visible before unlock:', pg.evaluate("!!document.getElementById('menu')"))
        pg.evaluate(f"localStorage.setItem('mde-key','{key}')"); pg.reload(); pg.wait_for_timeout(1500)
        ids=pg.evaluate("[...document.querySelectorAll('.page')].map(p=>p.id)")
        print(' unlocked pages:',len(ids))
        bad=[]
        for i in ids:
            pg.evaluate(f"location.hash='{i}'"); pg.wait_for_timeout(120)
            ov=pg.evaluate("document.documentElement.scrollWidth-innerWidth")
            if ov>0: bad.append((i,ov))
        print(' overflow:',bad,'errors:',errs)
        pg.evaluate("location.hash='menu'"); pg.wait_for_timeout(300)
        print(' new cards:',pg.evaluate("['castillo','callejera'].map(x=>document.querySelectorAll('#menu [data-go='+x+']').length)"))
        ctx.close()
    pg=b.new_page(); pg.goto(U+'terminos.html'); pg.wait_for_timeout(500); print('terms title:',pg.title())
