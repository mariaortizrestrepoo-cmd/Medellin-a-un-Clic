# Copia la app normal y le pone las marcas del candado
h=open('../app/index.html').read()
def rep(a,b):
    global h
    assert h.count(a)==1, a[:40]
    h=h.replace(a,b,1)
rep('<!-- ============ MENÚ ============ -->','<!--VAULT-START-->\n<!-- ============ MENÚ ============ -->')
rep('</footer>\n</main>','</footer>\n<!--VAULT-END-->\n</main>')
rep('<script>\nconst DICHOS = [','<script>\nfunction startApp(){\nconst DICHOS = [')
rep("try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(()=>{}); } catch(e) {}\n</script>",
    "}\ntry { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(()=>{}); } catch(e) {}\n</script>\n<!--LOCK-SCRIPT-->")
rep('<body class="lang-en">','<body class="lang-en locked">\n<!--LOCK-HTML-->')
h=h.replace('</style>','<!--LOCK-CSS-->\n</style>',1)
open('src/index.src.html','w').write(h); print('ok')
