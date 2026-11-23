# Genera el ícono y la pantalla de arranque de Android y de iPhone desde el logo nuevo de María
# (nativa/marca/icono-1024.png e icono-maskable-1024.png). Correr después de "cap add". Uso: python3 iconos-nativos.py
import os, re
from PIL import Image, ImageDraw
AQUI = os.path.dirname(os.path.abspath(__file__))
ICONO = Image.open(os.path.join(AQUI, 'marca', 'icono-1024.png')).convert('RGB')
MASK = Image.open(os.path.join(AQUI, 'marca', 'icono-maskable-1024.png')).convert('RGB')
AZUL = (11, 22, 38)
# color del borde del ícono "maskable" (fondo verde): rellena lo que Android muestra al mover el ícono
borde = [MASK.getpixel((x, y)) for x in (4, 512, 1019) for y in (4, 1019)]
VERDE = tuple(sum(c[i] for c in borde) // len(borde) for i in range(3))

def redondeado(img, lado, radio=0.22, circulo=False):
    im = img.resize((lado, lado), Image.LANCZOS)
    m = Image.new('L', (lado * 4, lado * 4), 0); d = ImageDraw.Draw(m)
    (d.ellipse if circulo else (lambda b, fill: d.rounded_rectangle(b, radius=int(lado * 4 * radio), fill=fill)))((0, 0, lado * 4 - 1, lado * 4 - 1), fill=255)
    out = Image.new('RGBA', (lado, lado), (0, 0, 0, 0)); out.paste(im, (0, 0), m.resize((lado, lado), Image.LANCZOS)); return out

def arranque(w, h):
    s = Image.new('RGB', (w, h), AZUL); lado = int(min(w, h) * 0.28)
    i = redondeado(ICONO, lado); s.paste(i, ((w - lado) // 2, (h - lado) // 2), i); return s

# ---------- Android ----------
RES = os.path.join(AQUI, 'android', 'app', 'src', 'main', 'res')
if os.path.isdir(RES):
    for dpi, f in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
        carpeta = os.path.join(RES, 'mipmap-' + dpi)
        redondeado(ICONO, int(48 * f)).save(os.path.join(carpeta, 'ic_launcher.png'))
        redondeado(ICONO, int(48 * f), circulo=True).save(os.path.join(carpeta, 'ic_launcher_round.png'))
        # ícono adaptable: la capa de 108 dp muestra solo los 72 dp del centro; ahí va el ícono "maskable" completo
        capa, vis = int(108 * f), int(72 * f)
        fg = Image.new('RGBA', (capa, capa), VERDE + (255,)); fg.paste(MASK.resize((vis, vis), Image.LANCZOS), ((capa - vis) // 2, (capa - vis) // 2))
        fg.save(os.path.join(carpeta, 'ic_launcher_foreground.png'))
    open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w').write(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>\n' % VERDE)
    for raiz, _, archivos in os.walk(RES):
        for a in archivos:
            if a == 'splash.png':
                p = os.path.join(raiz, a); w, h = Image.open(p).size; arranque(w, h).save(p)
    print('Android: íconos y arranque listos; color de fondo', '#%02X%02X%02X' % VERDE)

# ---------- iPhone ----------
XC = os.path.join(AQUI, 'ios', 'App', 'App', 'Assets.xcassets')
if os.path.isdir(XC):
    ICONO.save(os.path.join(XC, 'AppIcon.appiconset', 'AppIcon-512@2x.png'))   # 1024, sin transparencia (Apple lo exige)
    for f in os.listdir(os.path.join(XC, 'Splash.imageset')):
        if f.endswith('.png'): arranque(2732, 2732).save(os.path.join(XC, 'Splash.imageset', f))
    print('iPhone: ícono 1024 y arranque listos')
