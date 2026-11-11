#!/usr/bin/env python3
"""
Generador de los assets de marca de GymFor (iconos y splash).

Dibuja el emblema con Cairo (vectorial) y guarda PNGs con compresión sin
pérdida (Pillow). Requiere `pycairo` y `Pillow`:

    python3 scripts/generate_brand_assets.py

Emblema: una «G» cuyo travesaño termina en un disco de pesas. Formas grandes
y sin detalles finos para que se lea bien también a 48 px.
"""

import math
import os

import cairo
from PIL import Image

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')

SIZE = 1024
BG_COLOR = (15 / 255, 23 / 255, 42 / 255)  # #0F172A

CYAN = (56 / 255, 189 / 255, 248 / 255)      # #38BDF8
ELECTRIC = (14 / 255, 165 / 255, 233 / 255)  # #0EA5E9
ROYAL = (37 / 255, 99 / 255, 235 / 255)      # #2563EB
WHITE = (1.0, 1.0, 1.0)
SILVER = (203 / 255, 213 / 255, 225 / 255)   # #CBD5E1

# Geometría del emblema (unidades a escala 1.0, centrado en el origen).
R_MEDIO = 220        # radio medio del anillo de la G
GROSOR = 100         # grosor del trazo de la G
R_EXTERIOR = R_MEDIO + GROSOR / 2  # 270 → diámetro 540 px < 682 px (zona segura 66%)


def _rect_redondeado(ctx, x, y, w, h, r):
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, math.radians(-90), 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.radians(90))
    ctx.arc(x + r, y + h - r, r, math.radians(90), math.radians(180))
    ctx.arc(x + r, y + r, r, math.radians(180), math.radians(270))
    ctx.close_path()


def dibujar_emblema(ctx, cx, cy, escala=1.0, monocromo=False):
    """Dibuja el emblema de GymFor centrado en (cx, cy)."""
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(escala, escala)

    if monocromo:
        relleno_g = cairo.SolidPattern(*WHITE)
    else:
        relleno_g = cairo.LinearGradient(-R_EXTERIOR, -R_EXTERIOR, R_EXTERIOR, R_EXTERIOR)
        relleno_g.add_color_stop_rgb(0.0, *CYAN)
        relleno_g.add_color_stop_rgb(0.5, *ELECTRIC)
        relleno_g.add_color_stop_rgb(1.0, *ROYAL)

    # 1. Anillo de la G: de 0° (derecha, a la altura del travesaño) en sentido
    #    horario por abajo, izquierda y arriba hasta 318° (abertura arriba-derecha).
    ctx.set_source(relleno_g)
    ctx.set_line_width(GROSOR)
    ctx.set_line_cap(cairo.LINE_CAP_BUTT)
    ctx.arc(0, 0, R_MEDIO, 0, math.radians(318))
    ctx.stroke()
    # Remate redondeado solo en el extremo superior de la abertura.
    fin = math.radians(318)
    ctx.arc(R_MEDIO * math.cos(fin), R_MEDIO * math.sin(fin), GROSOR / 2, 0, 2 * math.pi)
    ctx.fill()

    # 2. Travesaño de la G: del centro hacia el anillo, recortado por el círculo
    #    exterior para que su extremo quede a ras de la curva.
    alto_barra = GROSOR * 0.8
    x_inicio_barra = 40
    ctx.save()
    ctx.arc(0, 0, R_EXTERIOR, 0, 2 * math.pi)
    ctx.clip()
    ctx.rectangle(x_inicio_barra, -alto_barra / 2, R_EXTERIOR - x_inicio_barra, alto_barra)
    ctx.fill()
    ctx.restore()

    # 3. Disco de pesas en el extremo interior del travesaño (no se solapa con el anillo).
    ctx.set_source_rgb(*WHITE)
    _rect_redondeado(ctx, -4, -105, 56, 210, 18)
    ctx.fill()
    ctx.set_source_rgb(*(WHITE if monocromo else SILVER))
    _rect_redondeado(ctx, -54, -72, 40, 144, 14)
    ctx.fill()

    ctx.restore()


def _guardar(superficie, nombre, modo):
    ruta = os.path.join(ASSETS_DIR, nombre)
    temporal = ruta + '.tmp.png'
    superficie.write_to_png(temporal)
    with Image.open(temporal) as im:
        im.convert(modo).save(ruta, 'PNG', optimize=True, compress_level=9)
    os.remove(temporal)
    print(f'{nombre}: {modo}, {os.path.getsize(ruta)} bytes')
    return ruta


def _superficie(con_fondo):
    formato = cairo.FORMAT_RGB24 if con_fondo else cairo.FORMAT_ARGB32
    superficie = cairo.ImageSurface(formato, SIZE, SIZE)
    ctx = cairo.Context(superficie)
    if con_fondo:
        ctx.set_source_rgb(*BG_COLOR)
        ctx.paint()
    return superficie, ctx


def generar():
    os.makedirs(ASSETS_DIR, exist_ok=True)

    # icon.png / adaptive-icon.png: 1024×1024 RGB sin alfa.
    s, ctx = _superficie(con_fondo=True)
    dibujar_emblema(ctx, SIZE / 2, SIZE / 2)
    ruta_icono = _guardar(s, 'icon.png', 'RGB')
    _guardar(s, 'adaptive-icon.png', 'RGB')

    # android-icon-foreground.png: RGBA transparente, emblema dentro de la zona segura.
    s, ctx = _superficie(con_fondo=False)
    dibujar_emblema(ctx, SIZE / 2, SIZE / 2)
    _guardar(s, 'android-icon-foreground.png', 'RGBA')

    # android-icon-background.png: color sólido #0F172A.
    s, _ = _superficie(con_fondo=True)
    _guardar(s, 'android-icon-background.png', 'RGB')

    # android-icon-monochrome.png: silueta blanca plana (Themed Icons, Android 13+).
    s, ctx = _superficie(con_fondo=False)
    dibujar_emblema(ctx, SIZE / 2, SIZE / 2, monocromo=True)
    _guardar(s, 'android-icon-monochrome.png', 'RGBA')

    # splash-icon.png: solo el emblema sobre transparente. Sin texto y dentro del
    # círculo central del 66%: Android 12+ recorta el icono de la splash en un
    # círculo, y el texto o un emblema más grande quedarían cortados.
    s, ctx = _superficie(con_fondo=False)
    dibujar_emblema(ctx, SIZE / 2, SIZE / 2)
    _guardar(s, 'splash-icon.png', 'RGBA')

    # favicon.png: 48×48 reducido desde el icono.
    with Image.open(ruta_icono) as im:
        ruta = os.path.join(ASSETS_DIR, 'favicon.png')
        im.resize((48, 48), Image.Resampling.LANCZOS).save(ruta, 'PNG', optimize=True)
        print(f'favicon.png: RGB, {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    generar()
