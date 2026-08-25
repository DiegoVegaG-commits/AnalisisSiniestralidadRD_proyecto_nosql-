#!/usr/bin/env python3
"""Carga reproducible de accidentes_mongo.jsonl en MongoDB.

No guarda contraseñas en el código. Solicita las credenciales durante la ejecución.
Pensado como alternativa cuando `mongoimport` no está disponible en Learner Lab.
"""

from __future__ import annotations

import argparse
from getpass import getpass
from pathlib import Path

from bson import json_util
from pymongo import MongoClient


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Importa un JSONL BSON/Extended JSON a MongoDB")
    parser.add_argument("--archivo", default="accidentes_mongo.jsonl")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=27017)
    parser.add_argument("--db", default="proyecto_accidentes_db")
    parser.add_argument("--collection", default="accidentes")
    parser.add_argument("--usuario", default="root_admin")
    parser.add_argument("--auth-db", default="admin")
    parser.add_argument("--lote", type=int, default=1000)
    parser.add_argument("--sin-drop", action="store_true", help="No elimina la colección antes de importar")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    archivo = Path(args.archivo)
    if not archivo.is_file():
        raise SystemExit(f"ERROR: no se encontró {archivo}")

    password = getpass(f"Contraseña de {args.usuario}: ")
    client = MongoClient(
        host=args.host,
        port=args.port,
        username=args.usuario,
        password=password,
        authSource=args.auth_db,
        directConnection=True,
    )

    # Verifica autenticación antes de modificar datos.
    client.admin.command("ping")

    col = client[args.db][args.collection]
    if not args.sin_drop:
        col.drop()

    lote: list[dict] = []
    total = 0

    with archivo.open("r", encoding="utf-8") as fh:
        for linea in fh:
            linea = linea.strip()
            if not linea:
                continue
            lote.append(json_util.loads(linea))
            if len(lote) >= args.lote:
                col.insert_many(lote)
                total += len(lote)
                print(f"Importados: {total}")
                lote.clear()

    if lote:
        col.insert_many(lote)
        total += len(lote)

    conteo = col.count_documents({})
    print(f"\nIMPORTACIÓN TERMINADA: {total} documentos")
    print(f"Conteo MongoDB: {conteo}")


if __name__ == "__main__":
    main()
