"""Genera le icone PNG dell'app a partire dal disegno di `public/icon.svg`.

Le forme sono ridisegnate qui perché il progetto non ha (e non vuole) una
libreria di rasterizzazione: sono quattro rettangoli e otto cerchi, ripetuti
qui in una ventina di righe. Se cambia `icon.svg`, cambia anche questo file.

    python tools/genera-icone.py
"""
import struct
import zlib
from pathlib import Path

USCITA = Path(__file__).resolve().parent.parent / 'public'

SFONDO_ALTO = (0x25, 0x63, 0xEB)
SFONDO_BASSO = (0x1E, 0x3A, 0x8A)
ANELLO = (0xCB, 0xD5, 0xE1)
FOGLIO = (0xF8, 0xFA, 0xFC)
BANDA = (0x0F, 0x17, 0x2A)

PALLINI = [
    (160, 258, (0xEF, 0x44, 0x44)), (232, 258, (0xF5, 0x9E, 0x0B)),
    (304, 258, (0x22, 0xC5, 0x5E)), (376, 258, ANELLO),
    (160, 342, ANELLO), (232, 342, (0x8B, 0x5C, 0xF6)),
    (304, 342, (0x22, 0xC5, 0x5E)), (376, 342, ANELLO),
]


def dentro_rettangolo(x, y, rx, ry, w, h, raggio):
    """Rettangolo con angoli arrotondati, in coordinate 512x512."""
    if not (rx <= x <= rx + w and ry <= y <= ry + h):
        return False
    cx = min(max(x, rx + raggio), rx + w - raggio)
    cy = min(max(y, ry + raggio), ry + h - raggio)
    return (x - cx) ** 2 + (y - cy) ** 2 <= raggio ** 2


def colore(x, y):
    """Colore RGBA del punto, in coordinate 512x512. Alpha 0 fuori dall'icona."""
    if not dentro_rettangolo(x, y, 0, 0, 512, 512, 104):
        return (0, 0, 0, 0)

    for cx, cy, tinta in PALLINI:
        if (x - cx) ** 2 + (y - cy) ** 2 <= 24 ** 2:
            return tinta + (255,)

    if dentro_rettangolo(x, y, 96, 124, 320, 292, 36):
        return (BANDA if y < 198 else FOGLIO) + (255,)

    if dentro_rettangolo(x, y, 168, 92, 30, 70, 15) or dentro_rettangolo(x, y, 314, 92, 30, 70, 15):
        return ANELLO + (255,)

    quota = y / 512
    return tuple(round(a + (b - a) * quota) for a, b in zip(SFONDO_ALTO, SFONDO_BASSO)) + (255,)


def disegna(lato, campioni):
    """Righe RGBA del PNG. `campioni` è il sovracampionamento per lato."""
    passo = 512 / (lato * campioni)
    mezzo = passo / 2
    peso = campioni * campioni
    righe = []

    for py in range(lato):
        riga = bytearray()
        for px in range(lato):
            somma = [0, 0, 0, 0]
            for sy in range(campioni):
                y = (py * campioni + sy) * passo + mezzo
                for sx in range(campioni):
                    x = (px * campioni + sx) * passo + mezzo
                    r, g, b, a = colore(x, y)
                    # Premoltiplicato: sui bordi il colore non sbava sul trasparente.
                    somma[0] += r * a
                    somma[1] += g * a
                    somma[2] += b * a
                    somma[3] += a
            alpha = somma[3] / peso
            if alpha == 0:
                riga += b'\x00\x00\x00\x00'
            else:
                riga += bytes([round(somma[i] / somma[3]) for i in range(3)] + [round(alpha)])
        righe.append(bytes(riga))
    return righe


def scrivi_png(percorso, lato, righe):
    grezzo = b''.join(b'\x00' + riga for riga in righe)

    def blocco(tipo, dati):
        return (struct.pack('>I', len(dati)) + tipo + dati
                + struct.pack('>I', zlib.crc32(tipo + dati) & 0xFFFFFFFF))

    percorso.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + blocco(b'IHDR', struct.pack('>IIBBBBB', lato, lato, 8, 6, 0, 0, 0))
        + blocco(b'IDAT', zlib.compress(grezzo, 9))
        + blocco(b'IEND', b'')
    )


for nome, lato, campioni in [('icon-192.png', 192, 4), ('icon-512.png', 512, 2), ('apple-touch-icon.png', 180, 4)]:
    scrivi_png(USCITA / nome, lato, disegna(lato, campioni))
    print(nome, 'creato')
