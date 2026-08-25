"""
transformar_a_mongo.py

Transforma una muestra del dataset US Accidents al modelo documental de MongoDB
y la guarda como NDJSON/JSON Lines usando Extended JSON para las fechas.

Uso:
    python transformar_a_mongo.py us_accidents_sample_27049.csv

Si no se indica archivo, usa "us_accidents_sample_27049.csv".
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import pandas as pd

RUTA_DESTINO = "accidentes_mongo.jsonl"


def es_nulo(valor) -> bool:
    """Detecta valores nulos de pandas de forma simple para esta transformación."""
    return valor is None or (isinstance(valor, float) and math.isnan(valor))


def fecha_a_extended_json(valor_str):
    """Convierte la fecha a Extended JSON $date.

    El CSV fuente no incluye una zona horaria explícita por registro. Por ello el sufijo Z
    se usa como representación uniforme de almacenamiento para el proyecto; no debe
    interpretarse como una conversión verificada desde la hora local de cada estado.
    """
    if es_nulo(valor_str):
        return None
    fecha = pd.to_datetime(valor_str)
    return {"$date": fecha.strftime("%Y-%m-%dT%H:%M:%S.000Z")}


def transformar_fila(fila):
    doc = {
        "_id": fila["ID"],
        "source": fila["Source"],
        "severity": int(fila["Severity"]),
        "start_time": fecha_a_extended_json(fila["Start_Time"]),
        "end_time": fecha_a_extended_json(fila["End_Time"]),
        "location": {
            "type": "Point",
            "coordinates": [float(fila["Start_Lng"]), float(fila["Start_Lat"])],
        },
        "distance_mi": None if es_nulo(fila["Distance(mi)"]) else float(fila["Distance(mi)"]),
        "description": None if es_nulo(fila["Description"]) else str(fila["Description"]),
        "address": {
            "street": None if es_nulo(fila["Street"]) else str(fila["Street"]),
            "city": None if es_nulo(fila["City"]) else str(fila["City"]),
            "county": None if es_nulo(fila["County"]) else str(fila["County"]),
            "state": str(fila["State"]),
            "zipcode": None if es_nulo(fila["Zipcode"]) else str(fila["Zipcode"]),
        },
        "weather": {},
        "road_features": {
            "amenity": bool(fila["Amenity"]),
            "bump": bool(fila["Bump"]),
            "crossing": bool(fila["Crossing"]),
            "give_way": bool(fila["Give_Way"]),
            "junction": bool(fila["Junction"]),
            "no_exit": bool(fila["No_Exit"]),
            "railway": bool(fila["Railway"]),
            "roundabout": bool(fila["Roundabout"]),
            "station": bool(fila["Station"]),
            "stop": bool(fila["Stop"]),
            "traffic_calming": bool(fila["Traffic_Calming"]),
            "traffic_signal": bool(fila["Traffic_Signal"]),
            "turning_loop": bool(fila["Turning_Loop"]),
        },
        "sunrise_sunset": None if es_nulo(fila["Sunrise_Sunset"]) else str(fila["Sunrise_Sunset"]),
    }

    if doc["end_time"] is None:
        del doc["end_time"]

    campos_clima = {
        "temperature_f": "Temperature(F)",
        "wind_chill_f": "Wind_Chill(F)",
        "humidity_pct": "Humidity(%)",
        "pressure_in": "Pressure(in)",
        "visibility_mi": "Visibility(mi)",
        "wind_direction": "Wind_Direction",
        "wind_speed_mph": "Wind_Speed(mph)",
        "precipitation_in": "Precipitation(in)",
        "condition": "Weather_Condition",
    }
    for campo_mongo, columna_csv in campos_clima.items():
        valor = fila[columna_csv]
        if not es_nulo(valor):
            if columna_csv in {"Weather_Condition", "Wind_Direction"}:
                doc["weather"][campo_mongo] = str(valor)
            else:
                doc["weather"][campo_mongo] = float(valor)

    if not doc["weather"]:
        del doc["weather"]

    return doc


def main() -> None:
    parser = argparse.ArgumentParser(description="Transforma US Accidents a JSONL para MongoDB")
    parser.add_argument(
        "csv",
        nargs="?",
        default="us_accidents_sample_27049.csv",
        help="Ruta del CSV de entrada",
    )
    parser.add_argument(
        "--salida",
        default=RUTA_DESTINO,
        help="Ruta del JSONL de salida (default: accidentes_mongo.jsonl)",
    )
    args = parser.parse_args()

    ruta_origen = Path(args.csv)
    if not ruta_origen.exists():
        raise FileNotFoundError(
            f"No se encontró el CSV: {ruta_origen}. Indica la ruta real como argumento."
        )

    df = pd.read_csv(ruta_origen, low_memory=False)
    total = len(df)
    escritos = 0
    omitidos_coord = 0

    with open(args.salida, "w", encoding="utf-8") as f:
        for _, fila in df.iterrows():
            lat = fila["Start_Lat"]
            lng = fila["Start_Lng"]
            if es_nulo(lat) or es_nulo(lng) or not (-90 <= float(lat) <= 90) or not (-180 <= float(lng) <= 180):
                omitidos_coord += 1
                continue
            doc = transformar_fila(fila)
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
            escritos += 1

    print(f"Filas leídas: {total}")
    print(f"Documentos escritos: {escritos}")
    print(f"Filas omitidas por coordenadas inválidas: {omitidos_coord}")
    print(f"Archivo generado: {args.salida}")


if __name__ == "__main__":
    main()
