"""
transformar_a_mongo.py

Transforma el CSV real de US Accidents (muestra de 27,049 filas) al
modelo documental de MongoDB, y lo guarda como NDJSON (un documento
JSON por linea) usando Extended JSON para que mongoimport reconozca
las fechas como BSON Date reales, no como texto.

Uso:
    python transformar_a_mongo.py

Genera: accidentes_mongo.jsonl
"""

import pandas as pd
import json
import math

RUTA_ORIGEN = "us_accidents_sample_10k.csv"
RUTA_DESTINO = "accidentes_mongo.jsonl"


def es_nulo(valor):
    """pandas devuelve NaN (float) para celdas vacias; lo detectamos asi."""
    return valor is None or (isinstance(valor, float) and math.isnan(valor))


def fecha_a_extended_json(valor_str):
    """Convierte 'YYYY-MM-DD HH:MM:SS' a formato Extended JSON $date (ISO 8601 con Z)."""
    if es_nulo(valor_str):
        return None
    # Start_Time/End_Time vienen como 'YYYY-MM-DD HH:MM:SS' o con microsegundos
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
            "coordinates": [float(fila["Start_Lng"]), float(fila["Start_Lat"])]
        },
        "distance_mi": None if es_nulo(fila["Distance(mi)"]) else float(fila["Distance(mi)"]),
        "description": None if es_nulo(fila["Description"]) else str(fila["Description"]),
        "address": {
            "street": None if es_nulo(fila["Street"]) else str(fila["Street"]),
            "city": None if es_nulo(fila["City"]) else str(fila["City"]),
            "county": None if es_nulo(fila["County"]) else str(fila["County"]),
            "state": str(fila["State"]),
            "zipcode": None if es_nulo(fila["Zipcode"]) else str(fila["Zipcode"])
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
            "turning_loop": bool(fila["Turning_Loop"])
        },
        "sunrise_sunset": None if es_nulo(fila["Sunrise_Sunset"]) else str(fila["Sunrise_Sunset"])
    }

    # end_time puede venir nulo en teoria; si asi fuera, lo quitamos del doc
    if doc["end_time"] is None:
        del doc["end_time"]

    # subdocumento weather: solo se agregan los campos que si vienen (evita
    # llenar el documento de nulls en campos que ya sabemos mayormente vacios,
    # como Precipitation(in) y Wind_Chill(F))
    campos_clima = {
        "temperature_f": "Temperature(F)",
        "wind_chill_f": "Wind_Chill(F)",
        "humidity_pct": "Humidity(%)",
        "pressure_in": "Pressure(in)",
        "visibility_mi": "Visibility(mi)",
        "wind_direction": "Wind_Direction",
        "wind_speed_mph": "Wind_Speed(mph)",
        "precipitation_in": "Precipitation(in)",
        "condition": "Weather_Condition"
    }
    for campo_mongo, columna_csv in campos_clima.items():
        valor = fila[columna_csv]
        if not es_nulo(valor):
            if columna_csv == "Weather_Condition" or columna_csv == "Wind_Direction":
                doc["weather"][campo_mongo] = str(valor)
            else:
                doc["weather"][campo_mongo] = float(valor)

    if not doc["weather"]:
        del doc["weather"]

    return doc


def main():
    df = pd.read_csv(RUTA_ORIGEN, low_memory=False)
    total = len(df)
    escritos = 0

    with open(RUTA_DESTINO, "w", encoding="utf-8") as f:
        for _, fila in df.iterrows():
            doc = transformar_fila(fila)
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
            escritos += 1

    print(f"Filas leidas: {total}")
    print(f"Documentos escritos: {escritos}")
    print(f"Archivo generado: {RUTA_DESTINO}")


if __name__ == "__main__":
    main()
