#!/usr/bin/env python3
"""
Generador de assets de marca oficiales para GymFor.
Crea los iconos y splash screen requeridos en assets/ con gráficos vectoriales (Cairo)
y compresión PNG sin pérdida (Pillow).
"""

import math
import os
import cairo
from PIL import Image

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')

SIZE = 1024
BG_COLOR = (15 / 255, 23 / 255, 42 / 255)  # #0F172A (Deep Slate Obsidian)

# Paleta GymFor
CYAN = (56 / 255, 189 / 255, 248 / 255)       # #38BDF8
ELECTRIC = (14 / 255, 165 / 255, 233 / 255)  # #0EA5E9
ROYAL = (37 / 255, 99 / 255, 235 / 255)      # #2563EB
WHITE = (1.0, 1.0, 1.0)
SILVER = (203 / 255, 213 / 255, 225 / 255)   # #CBD5E1


def dibujar_emblema_gymfor(ctx, cx, cy, scale=1.0, monocromo=False):
    """
    Dibuja el emblema de GymFor: Monograma 'G' atlético integrado con barra y discos olímpicos.
    El diámetro máximo a escala 1.0 es ~560 px, situado holgadamente dentro de la zona segura
    de Android (diámetro 66% = ~682 px).
    """
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)

    r_mid = 230
    stroke_w = 94

    # 1. Arco exterior de la letra G
    if monocromo:
        ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
    else:
        grad = cairo.LinearGradient(-220, -220, 220, 220)
        grad.add_color_stop_rgb(0.0, *CYAN)
        grad.add_color_stop_rgb(0.5, *ELECTRIC)
        grad.add_color_stop_rgb(1.0, *ROYAL)
        ctx.set_source(grad)

    ctx.set_line_width(stroke_w)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)

    # El arco recorre desde 12° en sentido horario hasta 318°
    ctx.arc(0, 0, r_mid, math.radians(12), math.radians(318))
    ctx.stroke()

    # Barra horizontal de entrada de la G
    ctx.move_to(r_mid, 10)
    ctx.line_to(10, 10)
    ctx.stroke()

    # 2. Barra de levantamiento (Barbell shaft)
    if monocromo:
        ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
    else:
        ctx.set_source_rgb(*WHITE)

    ctx.set_line_width(22)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.move_to(-140, 10)
    ctx.line_to(140, 10)
    ctx.stroke()

    # Función auxiliar para dibujar discos redondeados
    def dibujar_disco(x, y, w, h, r, col):
        if monocromo:
            ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
        else:
            ctx.set_source_rgb(*col)
        ctx.new_sub_path()
        ctx.arc(x + r, y + r, r, math.radians(180), math.radians(270))
        ctx.arc(x + w - r, y + r, r, math.radians(270), math.radians(360))
        ctx.arc(x + w - r, y + h - r, r, math.radians(0), math.radians(90))
        ctx.arc(x + r, y + h - r, r, math.radians(90), math.radians(180))
        ctx.close_path()
        ctx.fill()

    plate_h = 170
    plate_w = 26

    # Discos del lado izquierdo
    dibujar_disco(-120 - plate_w, 10 - plate_h / 2, plate_w, plate_h, 6, WHITE)
    dibujar_disco(-120 - plate_w * 2 - 6, 10 - (plate_h - 32) / 2, plate_w, plate_h - 32, 5, SILVER)
    dibujar_disco(-120 + 6, 10 - 45, 12, 90, 4, CYAN)  # collar

    # Discos del lado derecho
    dibujar_disco(120 - plate_w + 14, 10 - plate_h / 2, plate_w, plate_h, 6, WHITE)
    dibujar_disco(120 + 20, 10 - (plate_h - 32) / 2, plate_w, plate_h - 32, 5, SILVER)
    dibujar_disco(120 - plate_w - 6, 10 - 45, 12, 90, 4, CYAN)  # collar

    # Chevron central de progresión / 1RM
    if monocromo:
        ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
    else:
        ctx.set_source_rgb(*CYAN)
    ctx.set_line_width(12)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.move_to(-28, 24)
    ctx.line_to(0, -6)
    ctx.line_to(28, 24)
    ctx.stroke()

    ctx.restore()


def guardar_png_optimizado(superficie_cairo, ruta_destino, modo_final='RGBA'):
    """Guarda una superficie Cairo en PNG aplicando compresión sin pérdida."""
    temp_path = ruta_destino + '.tmp.png'
    superficie_cairo.write_to_png(temp_path)
    with Image.open(temp_path) as im:
        im_convertida = im.convert(modo_final)
        im_convertida.save(ruta_destino, 'PNG', optimize=True, compress_level=9)
    if os.path.exists(temp_path):
        os.remove(temp_path)
    print(f'Generado {os.path.basename(ruta_destino)}: {im_convertida.size}, modo={im_convertida.mode}, peso={os.path.getsize(ruta_destino)} bytes')


def generar_todos_los_assets():
    os.makedirs(ASSETS_DIR, exist_ok=True)

    # 1. icon.png (1024x1024 RGB, sin canal alfa)
    surf_icon = cairo.ImageSurface(cairo.FORMAT_RGB24, SIZE, SIZE)
    ctx_icon = cairo.Context(surf_icon)
    ctx_icon.set_source_rgb(*BG_COLOR)
    ctx_icon.paint()
    dibujar_emblema_gymfor(ctx_icon, SIZE / 2, SIZE / 2, 1.0, monocromo=False)
    guardar_png_optimizado(surf_icon, os.path.join(ASSETS_DIR, 'icon.png'), modo_final='RGB')

    # 2. adaptive-icon.png (1024x1024 RGB, sin canal alfa para compatibilidad Android legacy)
    guardar_png_optimizado(surf_icon, os.path.join(ASSETS_DIR, 'adaptive-icon.png'), modo_final='RGB')

    # 3. android-icon-foreground.png (1024x1024 RGBA, fondo transparente, zona segura 66%)
    surf_fg = cairo.ImageSurface(cairo.FORMAT_ARGB32, SIZE, SIZE)
    ctx_fg = cairo.Context(surf_fg)
    dibujar_emblema_gymfor(ctx_fg, SIZE / 2, SIZE / 2, 1.0, monocromo=False)
    guardar_png_optimizado(surf_fg, os.path.join(ASSETS_DIR, 'android-icon-foreground.png'), modo_final='RGBA')

    # 4. android-icon-background.png (1024x1024 RGB sólido #0F172A)
    surf_bg = cairo.ImageSurface(cairo.FORMAT_RGB24, SIZE, SIZE)
    ctx_bg = cairo.Context(surf_bg)
    ctx_bg.set_source_rgb(*BG_COLOR)
    ctx_bg.paint()
    guardar_png_optimizado(surf_bg, os.path.join(ASSETS_DIR, 'android-icon-background.png'), modo_final='RGB')

    # 5. android-icon-monochrome.png (1024x1024 RGBA, silueta plana blanca sobre transparente)
    surf_mono = cairo.ImageSurface(cairo.FORMAT_ARGB32, SIZE, SIZE)
    ctx_mono = cairo.Context(surf_mono)
    dibujar_emblema_gymfor(ctx_mono, SIZE / 2, SIZE / 2, 1.0, monocromo=True)
    guardar_png_optimizado(surf_mono, os.path.join(ASSETS_DIR, 'android-icon-monochrome.png'), modo_final='RGBA')

    # 6. splash-icon.png (1024x1024 RGBA, emblema + tipografía GymFor centrada)
    surf_splash = cairo.ImageSurface(cairo.FORMAT_ARGB32, SIZE, SIZE)
    ctx_splash = cairo.Context(surf_splash)
    dibujar_emblema_gymfor(ctx_splash, SIZE / 2, 430, 0.88, monocromo=False)

    # Tipografía G Y M F O R
    ctx_splash.select_font_face('DejaVu Sans', cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx_splash.set_font_size(60)
    ctx_splash.set_source_rgb(*WHITE)

    letras = ['G', 'Y', 'M', 'F', 'O', 'R']
    espacio = 20
    anchos = [ctx_splash.text_extents(ch).x_advance for ch in letras]
    ancho_total = sum(anchos) + espacio * (len(letras) - 1)
    x_cursor = (SIZE - ancho_total) / 2
    y_texto = 770

    for ch in letras:
        ctx_splash.move_to(x_cursor, y_texto)
        ctx_splash.show_text(ch)
        x_cursor += ctx_splash.text_extents(ch).x_advance + espacio

    # Subtítulo descriptivo TRACKER
    ctx_splash.select_font_face('DejaVu Sans', cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
    ctx_splash.set_font_size(24)
    ctx_splash.set_source_rgb(*CYAN)
    sub = 'T R A C K E R'
    sub_ext = ctx_splash.text_extents(sub)
    ctx_splash.move_to((SIZE - sub_ext.width) / 2 - sub_ext.x_bearing, y_texto + 48)
    ctx_splash.show_text(sub)

    guardar_png_optimizado(surf_splash, os.path.join(ASSETS_DIR, 'splash-icon.png'), modo_final='RGBA')

    # 7. favicon.png (48x48 RGBA, downscaling Lanczos de alta calidad)
    with Image.open(os.path.join(ASSETS_DIR, 'icon.png')) as im_icon:
        fav = im_icon.resize((48, 48), Image.Resampling.LANCZOS)
        fav_path = os.path.join(ASSETS_DIR, 'favicon.png')
        fav.save(fav_path, 'PNG', optimize=True, compress_level=9)
        print(f'Generado favicon.png: (48, 48), modo={fav.mode}, peso={os.path.getsize(fav_path)} bytes')


if __name__ == '__main__':
    generar_todos_los_assets()
