"""Atualiza os numeros de roubo de carga da tela "Areas de risco".

Fonte: base Sinesp VDE do Ministerio da Justica e Seguranca Publica (um arquivo XLSX por
ano, atualizado todo mes; os dados de um mes sao validados ate o dia 15 do mes seguinte).
Grava src/data/roubo-de-carga.json com as ocorrencias de roubo de carga por estado e mes.

Uso (na raiz do projeto):  python3 scripts/risk-data/atualizar.py 2024 2025 2026
Cada ano baixa de 20 a 30 MB. Depois rode os testes (npx vitest run src/lib/riskStats.test.ts).
"""
import datetime
import io
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

URL = "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/download/dnsp-base-de-dados/bancovde-{year}.xlsx/@@download/file"
PAGE = "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2015-a-2022"
OUT = Path(__file__).resolve().parents[2] / "src" / "data" / "roubo-de-carga.json"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split()


def col_idx(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def month_of(value):
    try:
        day = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(value)))
        return day.strftime("%Y-%m")
    except (TypeError, ValueError):
        return str(value)[:7]


def cargo_theft_by_month(xlsx: bytes):
    """{(uf, 'AAAA-MM'): ocorrencias} do evento 'Roubo de carga'."""
    book = zipfile.ZipFile(io.BytesIO(xlsx))
    names = book.namelist()
    shared = []
    if "xl/sharedStrings.xml" in names:
        for _, el in ET.iterparse(book.open("xl/sharedStrings.xml")):
            if el.tag == NS + "si":
                shared.append("".join(t.text or "" for t in el.iter(NS + "t")))
                el.clear()
    totals = defaultdict(int)
    for sheet in sorted(n for n in names if re.match(r"xl/worksheets/sheet\d+\.xml", n)):
        header = None
        for _, row in ET.iterparse(book.open(sheet)):
            if row.tag != NS + "row":
                continue
            values = {}
            for cell in row.iter(NS + "c"):
                v = cell.find(NS + "v")
                if v is None:
                    inline = cell.find(NS + "is")
                    value = "".join(x.text or "" for x in inline.iter(NS + "t")) if inline is not None else None
                else:
                    value = shared[int(v.text)] if cell.get("t") == "s" else v.text
                values[col_idx(cell.get("r"))] = value
            row.clear()
            if header is None:
                header = {str(v).strip().lower(): k for k, v in values.items() if v is not None}
                continue
            if str(values.get(header["evento"]) or "").strip().lower() != "roubo de carga":
                continue
            try:
                total = int(float(values.get(header["total"]) or 0))
            except ValueError:
                total = 0
            totals[(values.get(header["uf"]), month_of(values.get(header["data_referencia"])))] += total
    return totals


def main(years):
    data = json.loads(OUT.read_text()) if OUT.exists() else {"byState": {}}
    by_state = data.get("byState", {})
    latest = data.get("latestMonth", "")
    for year in years:
        print(f"baixando {year}...", file=sys.stderr)
        with urllib.request.urlopen(URL.format(year=year), timeout=300) as response:
            totals = cargo_theft_by_month(response.read())
        months = sorted({m for (_, m) in totals if m.startswith(str(year))})
        if not months:
            sys.exit(f"{year}: nenhum dado de roubo de carga encontrado")
        last = int(months[-1][5:7])
        for uf in UFS:
            by_state.setdefault(uf, {})[str(year)] = [totals.get((uf, f"{year}-{m:02d}"), 0) for m in range(1, last + 1)]
        latest = max(latest, months[-1])
        print(f"{year}: {last} meses, {sum(v for (_, m), v in totals.items() if m.startswith(str(year)))} ocorrencias", file=sys.stderr)
    OUT.write_text(json.dumps({
        "source": "Sinesp VDE — Ministério da Justiça e Segurança Pública",
        "sourceUrl": PAGE,
        "updatedAt": datetime.date.today().isoformat(),
        "latestMonth": latest,
        "byState": dict(sorted(by_state.items())),
    }, ensure_ascii=False, indent=1) + "\n")
    print(f"gravado {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main([int(y) for y in sys.argv[1:]] or [datetime.date.today().year])
