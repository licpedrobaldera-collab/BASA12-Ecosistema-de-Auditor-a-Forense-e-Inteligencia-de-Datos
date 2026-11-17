import os
import re
import io
import json
import math
import sqlite3
import hashlib
from collections import Counter
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional

import numpy as np
import pandas as pd
import requests
import streamlit as st
import plotly.express as px

import docx
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from pypdf import PdfReader

try:
    from google import genai
    from google.genai.errors import APIError
    HAS_GENAI = True
except Exception:
    genai = None
    APIError = Exception
    HAS_GENAI = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

# ==============================================================================
# CONFIGURACIÓN GLOBAL DE PRODUCCIÓN (BASA12 / BASA13 UNIFICADO v8.0.0-FINAL-PROD)
# ==============================================================================
APP_TITLE = "BASA13 HALLAZGOS INTELIGENTE PRO"
APP_VERSION = (
    "v8.0.0-FINAL-PROD (Autonomía Inteligente + Pre-Check Motores + "
    "Fusión SQLite + Heatmap 0–10 + Benford + CRUD Completo)"
)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "basa13_hallazgos_prod.db")

MODELOS_GEMINI_ACTIVOS = [
    "gemini-3.8-flash",
    "gemini-4-hydrogen",
    "gemini-3.8-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-pro",
]

MATRIX_COLUMNS = [
    "ID_BD",
    "Verificado",
    "Sección",
    "Código",
    "Hallazgo actual",
    "Transcripción íntegra",
    "Condición",
    "Criterio",
    "Causa",
    "Efecto",
    "Riesgo",
    "Evidencia",
    "Cuantificación",
    "Responsabilidad",
    "Recomendación actual",
    "Deficiencias",
    "Duplicidad",
    "Hallazgo relacionado",
    "Clasificación",
    "Justificación de conservar/eliminar/consolidar",
    "Puntaje 0–10",
    "Nivel",
    "Qué falta para 10/10",
    "Versión mejorada 10/10",
    "Referencias normativas",
    "Ubicación",
]

# ==============================================================================
# VERIFICACIÓN DE SALUD DE MOTORES Y AUTO-GESTIÓN DE IA (SIN PEDIR CLAVES EN UI)
# ==============================================================================
def check_ollama_available(ollama_url: str = "http://127.0.0.1:11434", timeout: float = 1.2) -> Tuple[bool, str, str]:
    """Comprueba rápidamente en ~1 segundo si Ollama está corriendo localmente sin colgar el flujo."""
    try:
        resp = requests.get(f"{ollama_url.rstrip('/')}/api/tags", timeout=timeout)
        if resp.status_code == 200:
            models = [str(m.get("name", "")) for m in resp.json().get("models", []) if m.get("name")]
            chosen = ""
            if models:
                for pref in ["llama3.1", "llama3", "qwen2.5", "mistral", "gemma2"]:
                    match = next((m for m in models if pref in m.lower()), None)
                    if match:
                        chosen = match
                        break
                if not chosen:
                    chosen = models[0]
            detail = ", ".join(models) if models else "Activo (sin modelos descargados)"
            return True, detail, chosen
        return False, f"HTTP {resp.status_code}", ""
    except Exception:
        return False, "Servicio Ollama apagado (puerto 11434 cerrado)", ""


def get_server_gemini_key() -> str:
    """Obtiene la clave únicamente desde st.secrets o variables de entorno del servidor (nunca desde UI)."""
    key = ""
    try:
        key = str(st.secrets.get("GEMINI_API_KEY", "") or "").strip()
    except Exception:
        key = ""
    if not key:
        key = os.environ.get("GEMINI_API_KEY", "").strip()
    return key


def detectar_motores_ia_disponibles(ollama_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Pre-Check unificado de motores disponibles sin solicitar credenciales en la interfaz:
    1) IA Local Confidencial (Ollama)
    2) IA Cloud Autogestionada (Google Gemini multi-modelo desde Secrets/env)
    3) Motor Documental Forense Autónomo (100% gratuito, offline, cero invención)
    """
    url_use = (ollama_url or os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")).rstrip("/")
    ollama_ok, ollama_msg, ollama_model = check_ollama_available(url_use, timeout=1.0)
    gemini_key = get_server_gemini_key()
    gemini_ok = bool(HAS_GENAI and gemini_key)
    return {
        "ollama_ok": ollama_ok and bool(ollama_model),
        "ollama_service_up": ollama_ok,
        "ollama_url": url_use,
        "ollama_model": ollama_model or "llama3.1",
        "ollama_msg": ollama_msg,
        "gemini_ok": gemini_ok,
        "gemini_key": gemini_key,
    }


def consultar_gemini_blindado(api_key: str, prompt: str) -> Tuple[Optional[str], str]:
    """Rotación multi-modelo con respaldo silencioso ante 404 / 429 / 503."""
    if not HAS_GENAI or not api_key:
        return None, ""
    try:
        client = genai.Client(api_key=api_key.strip())
    except Exception:
        return None, ""

    for modelo in MODELOS_GEMINI_ACTIVOS:
        try:
            response = client.models.generate_content(
                model=modelo,
                contents=prompt,
            )
            if getattr(response, "text", None):
                return response.text, modelo
        except APIError as e:
            err_txt = str(e).upper()
            if getattr(e, "code", None) in (404, 429, 503) or any(x in err_txt for x in ("NOT_FOUND", "404", "429", "503")):
                continue
            return None, ""
        except Exception:
            continue
    return None, ""


# ==============================================================================
# GESTOR DE BASE DE DATOS SQLITE (LIMPIA, TRANSACCIONAL Y CON FUSIÓN DE BDs)
# ==============================================================================
def get_db_connection(db_file: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_file, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS configuracion (
            clave TEXT PRIMARY KEY,
            valor TEXT NOT NULL,
            actualizado_en TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS auditorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_archivo TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            fecha_carga TEXT NOT NULL,
            motor_usado TEXT NOT NULL,
            total_paginas_lineas TEXT,
            total_hallazgos INTEGER DEFAULT 0,
            promedio_puntaje REAL DEFAULT 0.0,
            estado TEXT DEFAULT 'EN REVISIÓN',
            observaciones_generales TEXT DEFAULT ''
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS hallazgos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            auditoria_id INTEGER NOT NULL,
            verificado INTEGER DEFAULT 0,
            seccion TEXT,
            codigo TEXT NOT NULL,
            hallazgo_actual TEXT,
            transcripcion_integra TEXT,
            condicion TEXT,
            criterio TEXT,
            causa TEXT,
            efecto TEXT,
            riesgo TEXT,
            evidencia TEXT,
            cuantificacion TEXT,
            responsabilidad TEXT,
            recomendacion_actual TEXT,
            deficiencias TEXT,
            duplicidad TEXT,
            hallazgo_relacionado TEXT,
            clasificacion TEXT,
            justificacion TEXT,
            puntaje REAL DEFAULT 0.0,
            nivel TEXT,
            que_falta TEXT,
            version_mejorada TEXT,
            referencias_normativas TEXT,
            ubicacion TEXT,
            ultima_modificacion TEXT,
            FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE CASCADE
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS bitacora_operaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operacion TEXT NOT NULL,
            detalle TEXT,
            fecha TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def registrar_bitacora(operacion: str, detalle: str) -> None:
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO bitacora_operaciones (operacion, detalle, fecha) VALUES (?, ?, ?)",
        (operacion, detalle, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    conn.commit()
    conn.close()


def db_list_bitacora(limit: int = 100) -> pd.DataFrame:
    conn = get_db_connection()
    df = pd.read_sql_query(
        "SELECT id AS ID, operacion AS Operación, detalle AS Detalle, fecha AS Fecha FROM bitacora_operaciones ORDER BY id DESC LIMIT ?",
        conn,
        params=(limit,),
    )
    conn.close()
    return df


def reset_clean_database() -> Dict[str, int]:
    """Purga todos los registros de análisis anteriores y compacta la BD (VACUUM) dejándola en 0."""
    conteo = {"auditorias": 0, "hallazgos": 0, "bitacora_operaciones": 0}
    conn = get_db_connection()
    cur = conn.cursor()
    for t in list(conteo.keys()):
        try:
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            conteo[t] = cur.fetchone()[0]
            cur.execute(f"DELETE FROM {t}")
        except Exception:
            pass
    try:
        cur.execute("DELETE FROM sqlite_sequence")
    except Exception:
        pass
    conn.commit()
    conn.close()

    conn_vac = sqlite3.connect(DB_PATH)
    conn_vac.execute("VACUUM")
    conn_vac.close()

    registrar_bitacora("LIMPIEZA_TOTAL_BD", f"BD purgada y compactada para producción: {json.dumps(conteo)}")
    return conteo


def fusionar_base_datos_secundaria(ruta_db_sec: str) -> Dict[str, Any]:
    """Fusiona auditorías, hallazgos y configuraciones no sensibles desde otra BD SQLite hacia la BD principal."""
    resumen = {
        "auditorias_fusionadas": 0,
        "hallazgos_fusionados": 0,
        "configuraciones_incorporadas": 0,
    }
    conn_main = get_db_connection(DB_PATH)
    cur_main = conn_main.cursor()

    conn_sec = sqlite3.connect(ruta_db_sec)
    conn_sec.row_factory = sqlite3.Row
    cur_sec = conn_sec.cursor()

    tablas_sec = {r["name"] for r in cur_sec.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}

    for t_cfg in ["configuracion", "parametros_auditoria", "parametros"]:
        if t_cfg in tablas_sec:
            for r in cur_sec.execute(f"SELECT * FROM {t_cfg}").fetchall():
                d = dict(r)
                k = d.get("clave") or d.get("parametro")
                v = d.get("valor")
                if k and v is not None and "api_key" not in str(k).lower():
                    cur_main.execute("""
                        INSERT OR IGNORE INTO configuracion (clave, valor, actualizado_en)
                        VALUES (?, ?, ?)
                    """, (str(k), str(v), datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
                    if cur_main.rowcount > 0:
                        resumen["configuraciones_incorporadas"] += 1

    if "auditorias" in tablas_sec and "hallazgos" in tablas_sec:
        for aud in cur_sec.execute("SELECT * FROM auditorias").fetchall():
            a = dict(aud)
            cur_main.execute("""
                INSERT INTO auditorias (
                    nombre_archivo, sha256, fecha_carga, motor_usado,
                    total_paginas_lineas, total_hallazgos, promedio_puntaje, estado, observaciones_generales
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"[FUSIÓN] {a.get('nombre_archivo', 'Sin nombre')}",
                a.get("sha256", "FUSIONADO"),
                a.get("fecha_carga", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                a.get("motor_usado", "Fusión BD"),
                a.get("total_paginas_lineas", ""),
                a.get("total_hallazgos", 0),
                a.get("promedio_puntaje", 0.0),
                a.get("estado", "EN REVISIÓN"),
                a.get("observaciones_generales", ""),
            ))
            nuevo_aud_id = cur_main.lastrowid
            resumen["auditorias_fusionadas"] += 1

            for hall in cur_sec.execute("SELECT * FROM hallazgos WHERE auditoria_id = ?", (a["id"],)).fetchall():
                h = dict(hall)
                cur_main.execute("""
                    INSERT INTO hallazgos (
                        auditoria_id, verificado, seccion, codigo, hallazgo_actual,
                        transcripcion_integra, condicion, criterio, causa, efecto,
                        riesgo, evidencia, cuantificacion, responsabilidad,
                        recomendacion_actual, deficiencias, duplicidad,
                        hallazgo_relacionado, clasificacion, justificacion,
                        puntaje, nivel, que_falta, version_mejorada,
                        referencias_normativas, ubicacion, ultima_modificacion
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    nuevo_aud_id,
                    h.get("verificado", 0),
                    h.get("seccion", ""),
                    h.get("codigo", ""),
                    h.get("hallazgo_actual", ""),
                    h.get("transcripcion_integra", ""),
                    h.get("condicion", ""),
                    h.get("criterio", ""),
                    h.get("causa", ""),
                    h.get("efecto", ""),
                    h.get("riesgo", ""),
                    h.get("evidencia", ""),
                    h.get("cuantificacion", ""),
                    h.get("responsabilidad", ""),
                    h.get("recomendacion_actual", ""),
                    h.get("deficiencias", ""),
                    h.get("duplicidad", ""),
                    h.get("hallazgo_relacionado", ""),
                    h.get("clasificacion", "MEJORAR"),
                    h.get("justificacion", ""),
                    h.get("puntaje", 0.0),
                    h.get("nivel", ""),
                    h.get("que_falta", ""),
                    h.get("version_mejorada", ""),
                    h.get("referencias_normativas", ""),
                    h.get("ubicacion", ""),
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                ))
                resumen["hallazgos_fusionados"] += 1

    conn_sec.close()
    conn_main.commit()
    conn_main.close()
    registrar_bitacora("FUSION_BD_SECUNDARIA", json.dumps(resumen))
    return resumen


def db_save_audit(nombre_archivo: str, sha256: str, motor_usado: str, meta_doc: str, df: pd.DataFrame) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    promedio = float(df["Puntaje 0–10"].mean()) if not df.empty else 0.0

    cur.execute("""
        INSERT INTO auditorias (
            nombre_archivo, sha256, fecha_carga, motor_usado,
            total_paginas_lineas, total_hallazgos, promedio_puntaje, estado, observaciones_generales
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (nombre_archivo, sha256, now_str, motor_usado, meta_doc, len(df), round(promedio, 2), "EN REVISIÓN", ""))
    auditoria_id = cur.lastrowid

    for _, row in df.iterrows():
        cur.execute("""
            INSERT INTO hallazgos (
                auditoria_id, verificado, seccion, codigo, hallazgo_actual,
                transcripcion_integra, condicion, criterio, causa, efecto,
                riesgo, evidencia, cuantificacion, responsabilidad,
                recomendacion_actual, deficiencias, duplicidad,
                hallazgo_relacionado, clasificacion, justificacion,
                puntaje, nivel, que_falta, version_mejorada,
                referencias_normativas, ubicacion, ultima_modificacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            auditoria_id,
            1 if row.get("Verificado", False) else 0,
            str(row.get("Sección", "")),
            str(row.get("Código", "")),
            str(row.get("Hallazgo actual", "")),
            str(row.get("Transcripción íntegra", "")),
            str(row.get("Condición", "")),
            str(row.get("Criterio", "")),
            str(row.get("Causa", "")),
            str(row.get("Efecto", "")),
            str(row.get("Riesgo", "")),
            str(row.get("Evidencia", "")),
            str(row.get("Cuantificación", "")),
            str(row.get("Responsabilidad", "")),
            str(row.get("Recomendación actual", "")),
            str(row.get("Deficiencias", "")),
            str(row.get("Duplicidad", "")),
            str(row.get("Hallazgo relacionado", "")),
            str(row.get("Clasificación", "MEJORAR")),
            str(row.get("Justificación de conservar/eliminar/consolidar", "")),
            float(row.get("Puntaje 0–10", 0.0)),
            str(row.get("Nivel", "")),
            str(row.get("Qué falta para 10/10", "")),
            str(row.get("Versión mejorada 10/10", "")),
            str(row.get("Referencias normativas", "")),
            str(row.get("Ubicación", "")),
            now_str,
        ))

    conn.commit()
    conn.close()
    registrar_bitacora("NUEVA_AUDITORIA", f"ID #{auditoria_id} - {nombre_archivo} ({len(df)} hallazgos)")
    return auditoria_id


def db_list_audits() -> pd.DataFrame:
    conn = get_db_connection()
    df = pd.read_sql_query("""
        SELECT
            a.id AS ID,
            a.nombre_archivo AS Archivo,
            a.fecha_carga AS Fecha,
            a.motor_usado AS Motor,
            (SELECT COUNT(*) FROM hallazgos h WHERE h.auditoria_id = a.id) AS Hallazgos,
            COALESCE(ROUND((SELECT AVG(puntaje) FROM hallazgos h WHERE h.auditoria_id = a.id), 2), 0.0) AS Promedio,
            (SELECT COUNT(*) FROM hallazgos h WHERE h.auditoria_id = a.id AND h.verificado = 1) AS Verificados,
            a.estado AS Estado,
            COALESCE(a.observaciones_generales, '') AS Observaciones,
            SUBSTR(a.sha256, 1, 16) || '...' AS SHA256_Corto,
            a.sha256 AS SHA256_Full
        FROM auditorias a
        ORDER BY a.id DESC
    """, conn)
    conn.close()
    return df


def db_update_audit_metadata(auditoria_id: int, nuevo_nombre: str, nuevo_estado: str, observaciones: str) -> None:
    conn = get_db_connection()
    conn.execute("""
        UPDATE auditorias
        SET nombre_archivo = ?, estado = ?, observaciones_generales = ?
        WHERE id = ?
    """, (nuevo_nombre.strip(), nuevo_estado, observaciones, auditoria_id))
    conn.commit()
    conn.close()
    registrar_bitacora("EDICION_METADATOS", f"ID #{auditoria_id} -> {nuevo_nombre.strip()} ({nuevo_estado})")


def db_load_hallazgos(auditoria_id: int) -> pd.DataFrame:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM hallazgos WHERE auditoria_id = ? ORDER BY id ASC", (auditoria_id,)).fetchall()
    conn.close()
    if not rows:
        return pd.DataFrame(columns=MATRIX_COLUMNS)

    data = []
    for r in rows:
        data.append({
            "ID_BD": r["id"],
            "Verificado": bool(r["verificado"]),
            "Sección": r["seccion"],
            "Código": r["codigo"],
            "Hallazgo actual": r["hallazgo_actual"],
            "Transcripción íntegra": r["transcripcion_integra"],
            "Condición": r["condicion"],
            "Criterio": r["criterio"],
            "Causa": r["causa"],
            "Efecto": r["efecto"],
            "Riesgo": r["riesgo"],
            "Evidencia": r["evidencia"],
            "Cuantificación": r["cuantificacion"],
            "Responsabilidad": r["responsabilidad"],
            "Recomendación actual": r["recomendacion_actual"],
            "Deficiencias": r["deficiencias"],
            "Duplicidad": r["duplicidad"],
            "Hallazgo relacionado": r["hallazgo_relacionado"],
            "Clasificación": r["clasificacion"],
            "Justificación de conservar/eliminar/consolidar": r["justificacion"],
            "Puntaje 0–10": float(r["puntaje"]),
            "Nivel": r["nivel"],
            "Qué falta para 10/10": r["que_falta"],
            "Versión mejorada 10/10": r["version_mejorada"],
            "Referencias normativas": r["referencias_normativas"],
            "Ubicación": r["ubicacion"],
        })
    return pd.DataFrame(data)


def db_update_hallazgos_bulk(auditoria_id: int, edited_df: pd.DataFrame, nuevo_estado: Optional[str] = None) -> None:
    conn = get_db_connection()
    cur = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    existing_ids = {
        row[0] for row in cur.execute("SELECT id FROM hallazgos WHERE auditoria_id = ?", (auditoria_id,)).fetchall()
    }
    kept_ids = set()

    for _, row in edited_df.iterrows():
        row_id = row.get("ID_BD")
        puntaje = float(row.get("Puntaje 0–10", 0.0))
        nivel = calcular_nivel(puntaje)

        if pd.notna(row_id) and int(row_id) in existing_ids:
            rid = int(row_id)
            kept_ids.add(rid)
            cur.execute("""
                UPDATE hallazgos SET
                    verificado = ?, seccion = ?, codigo = ?, hallazgo_actual = ?,
                    transcripcion_integra = ?, condicion = ?, criterio = ?, causa = ?,
                    efecto = ?, riesgo = ?, evidencia = ?, cuantificacion = ?,
                    responsabilidad = ?, recomendacion_actual = ?, deficiencias = ?,
                    duplicidad = ?, hallazgo_relacionado = ?, clasificacion = ?,
                    justificacion = ?, puntaje = ?, nivel = ?, que_falta = ?,
                    version_mejorada = ?, referencias_normativas = ?, ubicacion = ?,
                    ultima_modificacion = ?
                WHERE id = ? AND auditoria_id = ?
            """, (
                1 if row.get("Verificado", False) else 0,
                str(row.get("Sección", "")),
                str(row.get("Código", "")),
                str(row.get("Hallazgo actual", "")),
                str(row.get("Transcripción íntegra", "")),
                str(row.get("Condición", "")),
                str(row.get("Criterio", "")),
                str(row.get("Causa", "")),
                str(row.get("Efecto", "")),
                str(row.get("Riesgo", "")),
                str(row.get("Evidencia", "")),
                str(row.get("Cuantificación", "")),
                str(row.get("Responsabilidad", "")),
                str(row.get("Recomendación actual", "")),
                str(row.get("Deficiencias", "")),
                str(row.get("Duplicidad", "")),
                str(row.get("Hallazgo relacionado", "")),
                str(row.get("Clasificación", "MEJORAR")),
                str(row.get("Justificación de conservar/eliminar/consolidar", "")),
                puntaje,
                nivel,
                str(row.get("Qué falta para 10/10", "")),
                str(row.get("Versión mejorada 10/10", "")),
                str(row.get("Referencias normativas", "")),
                str(row.get("Ubicación", "")),
                now_str,
                rid,
                auditoria_id,
            ))
        else:
            cur.execute("""
                INSERT INTO hallazgos (
                    auditoria_id, verificado, seccion, codigo, hallazgo_actual,
                    transcripcion_integra, condicion, criterio, causa, efecto,
                    riesgo, evidencia, cuantificacion, responsabilidad,
                    recomendacion_actual, deficiencias, duplicidad,
                    hallazgo_relacionado, clasificacion, justificacion,
                    puntaje, nivel, que_falta, version_mejorada,
                    referencias_normativas, ubicacion, ultima_modificacion
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                auditoria_id,
                1 if row.get("Verificado", False) else 0,
                str(row.get("Sección", "")),
                str(row.get("Código", "")),
                str(row.get("Hallazgo actual", "")),
                str(row.get("Transcripción íntegra", "")),
                str(row.get("Condición", "")),
                str(row.get("Criterio", "")),
                str(row.get("Causa", "")),
                str(row.get("Efecto", "")),
                str(row.get("Riesgo", "")),
                str(row.get("Evidencia", "")),
                str(row.get("Cuantificación", "")),
                str(row.get("Responsabilidad", "")),
                str(row.get("Recomendación actual", "")),
                str(row.get("Deficiencias", "")),
                str(row.get("Duplicidad", "")),
                str(row.get("Hallazgo relacionado", "")),
                str(row.get("Clasificación", "MEJORAR")),
                str(row.get("Justificación de conservar/eliminar/consolidar", "")),
                puntaje,
                nivel,
                str(row.get("Qué falta para 10/10", "")),
                str(row.get("Versión mejorada 10/10", "")),
                str(row.get("Referencias normativas", "")),
                str(row.get("Ubicación", "")),
                now_str,
            ))

    for del_id in (existing_ids - kept_ids):
        cur.execute("DELETE FROM hallazgos WHERE id = ? AND auditoria_id = ?", (del_id, auditoria_id))

    avg_val = float(edited_df["Puntaje 0–10"].mean()) if not edited_df.empty else 0.0
    if nuevo_estado:
        cur.execute(
            "UPDATE auditorias SET total_hallazgos = ?, promedio_puntaje = ?, estado = ? WHERE id = ?",
            (len(edited_df), round(avg_val, 2), nuevo_estado, auditoria_id),
        )
    else:
        cur.execute(
            "UPDATE auditorias SET total_hallazgos = ?, promedio_puntaje = ? WHERE id = ?",
            (len(edited_df), round(avg_val, 2), auditoria_id),
        )

    conn.commit()
    conn.close()
    registrar_bitacora("EDICION_HALLAZGOS", f"ID #{auditoria_id} ({len(edited_df)} filas actualizadas)")


def db_delete_audit(auditoria_id: int) -> None:
    conn = get_db_connection()
    conn.execute("DELETE FROM auditorias WHERE id = ?", (auditoria_id,))
    conn.commit()
    conn.close()
    registrar_bitacora("ELIMINACION_AUDITORIA", f"Auditoría ID #{auditoria_id} eliminada permanentemente.")


# ==============================================================================
# GENERADOR DE INFORME WORD (.DOCX) MODELO PARA CONFIGURACIÓN (REEMPLAZABLE)
# ==============================================================================
def generar_informe_ejemplo_docx(entidad: str = "Entidad Pública Modelo (Configuración BASA13)") -> bytes:
    """
    Genera un documento Word (.docx) real con estructura de informe de auditoría,
    estilos Heading 1/2/3, tabla incrustada, comunicaciones y normativa real,
    listo para configurar la BD y generar Excel/Word o ser sustituido por cualquier otro informe.
    """
    d = docx.Document()
    d.add_heading(f"INFORME DE AUDITORÍA E INVESTIGACIÓN ESPECIAL — {entidad}", level=0)
    d.add_paragraph(
        "Documento modelo configurable en formato Word (.docx). Puede ejecutarse de inmediato para "
        "poblar la base de datos SQLite y descargar Excel/Word, y reemplazarse luego por cualquier otro informe real."
    )
    d.add_heading("3. RESULTADOS DE LA AUDITORÍA E INVESTIGACIÓN ESPECIAL", level=1)

    d.add_heading("3.1 Aspectos Institucionales y de Control Interno", level=2)
    d.add_heading("3.1.01 Debilidades en la formalización y aprobación de instrumentos institucionales (POA, PACC y manuales)", level=3)
    d.add_paragraph(
        "Condición: Al examinar una muestra de 14 instrumentos de planificación y control interno correspondientes al período auditado, "
        "se evidenció que el Plan Operativo Anual (POA) y tres manuales de procedimientos carecían de firma de aprobación del Titular "
        "y fecha cierta de vigencia, operando sin políticas formales actualizadas."
    )
    d.add_paragraph(
        "Criterio: Ley núm. 41-08 de Función Pública, Decreto núm. 527-09, Decreto núm. 543-12 y Normas Básicas de Control Interno (NOBACI) "
        "emitidas por la Contraloría General de la República."
    )
    d.add_paragraph("Causa: Debilidad en la supervisión preventiva de la Dirección de Planificación y ausencia de calendario formal de actualización.")
    d.add_paragraph("Efecto: Genera riesgo de ejecución administrativa discrecional y falta de trazabilidad en autorizaciones.")
    d.add_paragraph(
        "Evidencia y Comunicaciones: Mediante Oficio núm. DP-045-2025 el Encargado de Planificación remitió copias simples sin firma "
        "e informó en comunicación de descargo que los instrumentos continuaban en revisión."
    )
    tbl = d.add_table(rows=4, cols=3)
    headers = ["Instrumento Auditado", "Estado Documental", "Impacto / Muestra"]
    rows_data = [
        ["Plan Operativo Anual (POA)", "Sin firma ni sello de aprobación", "100% del presupuesto operativo"],
        ["Plan Anual de Compras (PACC)", "Versión preliminar sin fecha", "RD$12,450,000.00 programados"],
        ["Manual de Políticas Internas", "Borrador no oficializado", "3 unidades administrativas"],
    ]
    for ci, h in enumerate(headers):
        tbl.rows[0].cells[ci].text = h
    for ri, rdata in enumerate(rows_data, start=1):
        for ci, val in enumerate(rdata):
            tbl.rows[ri].cells[ci].text = val
    d.add_paragraph(
        "Recomendación: Se recomienda instruir al Titular/MAE y a la Dirección de Planificación a formalizar, firmar y aprobar "
        "mediante resolución interna los instrumentos POA, PACC y manuales en un plazo de 30 días."
    )

    d.add_heading("3.1.02 Inconsistencias en la custodia de expedientes de compras menores sin PACC actualizado", level=3)
    d.add_paragraph(
        "Condición: De un universo de 28 expedientes de compras menores por RD$4,850,200.00, se verificó en 9 procesos la ausencia de "
        "constancia de disponibilidad presupuestaria previa y actas de adjudicación firmadas por el Comité de Compras."
    )
    d.add_paragraph("Criterio: Ley núm. 340-06 sobre Compras y Contrataciones Públicas, Artículos 15 y 21, y Decreto núm. 543-12.")
    d.add_paragraph("Causa: Falta de verificación previa en la Unidad Operativa de Compras y Contrataciones.")
    d.add_paragraph("Efecto: Exposición a nulidad contractual y observación bajo la Ley núm. 18-24.")
    d.add_paragraph("Evidencia: Expedientes CM-2025-011 al CM-2025-019 verificados en archivo.")
    d.add_paragraph("Recomendación: Instruir a la Dirección Administrativa y Financiera implementar lista de cotejo vinculada al PACC.")

    d.add_heading("3.2 Gestión Financiera y Ciclo de Pagos", level=2)
    d.add_heading("3.2.01 Egresos ejecutados con documentación justificativa incompleta en el ciclo de pagos", level=3)
    d.add_paragraph(
        "Condición: Se verificaron 6 libramientos de pago ascendentes a RD$1,925,400.00 sin informes de recepción conforme ni facturas válidas."
    )
    d.add_paragraph("Evidencia: Ver libramientos SP-104, SP-118 y SP-142 en Tesorería.")

    d.add_heading("3.3 Gestión de Recursos Humanos", level=2)
    d.add_heading("3.3.01 Expedientes de personal sin evaluación de desempeño conforme a la Ley 41-08", level=3)
    d.add_paragraph(
        "Condición: Al revisar 25 expedientes de servidores públicos, el 40% carecía de formulario de evaluación anual de desempeño."
    )
    d.add_paragraph("Criterio: Ley núm. 41-08 de Función Pública y Decreto núm. 523-09.")
    d.add_paragraph("Causa: Omisión de seguimiento periódico en Recursos Humanos.")
    d.add_paragraph("Efecto: Limita la medición objetiva del mérito administrativo.")
    d.add_paragraph("Recomendación: Instruir a la Dirección de Recursos Humanos completar el 100% de los expedientes activos.")

    d.add_heading("3.4 Tecnología y Transparencia", level=2)
    d.add_heading("3.4.1 Desactualización de publicaciones obligatorias en el Portal de Transparencia", level=3)
    d.add_paragraph(
        "Condición: Al cierre de la revisión, la publicación mensual de nómina y estados financieros presentaba atraso de cuatro (4) meses."
    )
    d.add_paragraph("Criterio: Ley núm. 200-04 de Libre Acceso a la Información Pública y NOBACI.")
    d.add_paragraph("Causa: Ausencia de protocolo mensual entre Contabilidad, RR. HH. y el RAI.")
    d.add_paragraph("Efecto: Afecta la rendición de cuentas institucional.")
    d.add_paragraph("Recomendación: Instruir al RAI automatizar la publicación antes del día 10 de cada mes.")

    out = io.BytesIO()
    d.save(out)
    return out.getvalue()


# ==============================================================================
# FASE 1, 2 Y 3: EXTRACTOR XML MULTINIVEL DE WORD + PDF + EXCEL + TEXTO
# ==============================================================================
def compute_sha256(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def normalize_spaces(text: str) -> str:
    return text.replace("\xa0", " ").replace("\t", " ").strip()


def iter_docx_blocks(doc: docx.Document):
    parent_elm = doc.element.body
    for child in parent_elm.iterchildren():
        if child.tag.endswith("p"):
            yield docx.text.paragraph.Paragraph(child, doc)
        elif child.tag.endswith("tbl"):
            yield docx.table.Table(child, doc)


def get_heading_level(paragraph: docx.text.paragraph.Paragraph) -> int:
    style_name = (paragraph.style.name or "").strip().lower() if paragraph.style else ""
    m_style = re.search(r"(?:heading|t[íi]tulo)\s*([1-4])", style_name)
    if m_style:
        return int(m_style.group(1))

    pPr = paragraph._p.pPr
    if pPr is not None:
        if pPr.outlineLvl is not None and pPr.outlineLvl.val is not None:
            lvl = int(pPr.outlineLvl.val)
            if 0 <= lvl <= 3:
                return lvl + 1
        if pPr.numPr is not None and pPr.numPr.ilvl is not None:
            numId = str(pPr.numPr.numId.val) if pPr.numPr.numId is not None else "0"
            if numId != "0":
                ilvl = int(pPr.numPr.ilvl.val)
                if 0 <= ilvl <= 3:
                    return ilvl + 1
    return 0


def extract_structured_lines(file_name: str, file_bytes: bytes) -> Tuple[List[Dict[str, str]], str]:
    ext = os.path.splitext(file_name)[1].lower()
    records: List[Dict[str, str]] = []
    meta_info = ""

    if ext == ".docx":
        doc = docx.Document(io.BytesIO(file_bytes))
        idx = 0
        tbl_count = 0
        sec_counter = 0
        find_counter = 0
        in_cap3 = False

        for block in iter_docx_blocks(doc):
            if isinstance(block, docx.text.paragraph.Paragraph):
                raw_txt = block.text
                if not raw_txt or not raw_txt.strip():
                    continue
                idx += 1
                clean_txt = normalize_spaces(raw_txt)
                h_level = get_heading_level(block)

                m_explicit = re.match(r"^(3(?:\.\d+){1,2})\b", clean_txt)
                if m_explicit:
                    in_cap3 = True
                    parts = m_explicit.group(1).split(".")
                    if len(parts) == 2 and len(parts[1]) == 1:
                        sec_counter = int(parts[1])
                        find_counter = 0
                    elif len(parts) == 3:
                        sec_counter = int(parts[1])
                        find_counter = int(parts[2])
                elif h_level == 1:
                    if re.search(r"\b(?:HALLAZGOS|RESULTADOS|OBSERVACIONES)\b", clean_txt, re.IGNORECASE) or clean_txt.startswith("3"):
                        in_cap3 = True
                        sec_counter = 0
                        find_counter = 0
                    elif in_cap3 and re.match(r"^(?:4|IV|CONCLUSIONES|RECOMENDACIONES|ANEXOS)", clean_txt, re.IGNORECASE):
                        in_cap3 = False
                elif in_cap3 and h_level == 2:
                    sec_counter += 1
                    find_counter = 0
                    clean_txt = f"3.{sec_counter} {clean_txt}"
                elif in_cap3 and h_level == 3:
                    find_counter += 1
                    sec_use = sec_counter if sec_counter > 0 else 1
                    clean_txt = f"3.{sec_use}.{find_counter:02d} {clean_txt}"

                records.append({
                    "loc": f"Párrafo {idx}",
                    "type": "text",
                    "content": clean_txt,
                    "h_level": str(h_level),
                })

            elif isinstance(block, docx.table.Table):
                tbl_count += 1
                rows_txt = []
                for row in block.rows:
                    cells = [normalize_spaces(c.text).replace("\n", " ") for c in row.cells]
                    rows_txt.append(" | ".join(cells))
                tbl_str = "\n".join(rows_txt).strip()
                if tbl_str:
                    idx += 1
                    records.append({
                        "loc": f"Párrafo/Tabla {idx} (Tabla #{tbl_count})",
                        "type": "table",
                        "content": f"[TABLA ADJUNTA]\n{tbl_str}",
                        "h_level": "0",
                    })
        meta_info = f"DOCX: {idx} bloques extraídos ({tbl_count} tablas)"

    elif ext == ".pdf":
        reader = PdfReader(io.BytesIO(file_bytes))
        total_pages = len(reader.pages)
        line_num = 0
        for p_idx, page in enumerate(reader.pages, start=1):
            page_txt = page.extract_text() or ""
            for raw_line in page_txt.splitlines():
                clean = normalize_spaces(raw_line)
                if clean:
                    line_num += 1
                    records.append({"loc": f"Pág. {p_idx} / Línea {line_num}", "type": "text", "content": clean, "h_level": "0"})
        meta_info = f"PDF: {total_pages} páginas / {line_num} líneas"

    elif ext in [".xlsx", ".xls"]:
        xls = pd.ExcelFile(io.BytesIO(file_bytes))
        row_counter = 0
        for sheet in xls.sheet_names:
            df_s = xls.parse(sheet).fillna("")
            for r_idx, row in df_s.iterrows():
                row_counter += 1
                joined = " | ".join([f"{col}: {val}" for col, val in row.items() if str(val).strip()])
                if joined:
                    records.append({"loc": f"Hoja '{sheet}' Fila {r_idx + 2}", "type": "table", "content": joined, "h_level": "0"})
        meta_info = f"Excel: {len(xls.sheet_names)} hojas / {row_counter} filas"

    else:
        text = file_bytes.decode("utf-8", errors="replace")
        for i, line in enumerate(text.splitlines(), start=1):
            clean = normalize_spaces(line)
            if clean:
                records.append({"loc": f"Línea {i}", "type": "text", "content": clean, "h_level": "0"})
        meta_info = f"Texto/CSV/MD: {len(records)} líneas"

    return records, meta_info


RE_SECTION_HEADER = re.compile(r"^(3\.[1-9]\d?)\s*[-–:.]?\s+([A-ZÁÉÍÓÚÑa-záéíóúñ].{3,220})$")
RE_FINDING_HEADER = re.compile(r"^(3\.(?:0[1-9]|[1-9]\d|[1-9]\.(?:0[1-9]|[1-9]\d?)))\s*[-–:.]?\s*(.+)$")
RE_CHAPTER_END = re.compile(r"^(?:4\.|IV\.|CONCLUSIONES\s+GENERALES|RECOMENDACIONES\s+GENERALES|ANEXOS\b)", re.IGNORECASE)


def is_valid_finding_code(code: str) -> bool:
    parts = code.split(".")
    if parts[0] != "3":
        return False
    if len(parts) == 2:
        return len(parts[1]) >= 2 and int(parts[1]) >= 1
    if len(parts) == 3:
        return int(parts[1]) >= 1 and int(parts[2]) >= 1
    return False


def segment_findings_from_records(records: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []
    current_section = "3. Hallazgos de Auditoría / Investigación Especial"
    active_finding: Optional[Dict[str, Any]] = None
    in_chapter_3 = False

    for rec in records:
        txt = rec["content"].strip()
        loc = rec["loc"]

        if re.search(r"(?:\.{3,}|\t+)\s*\d{1,3}$", txt):
            continue

        if in_chapter_3 and RE_CHAPTER_END.match(txt) and len(txt) < 120:
            if active_finding:
                findings.append(active_finding)
                active_finding = None
            break

        sec_match = RE_SECTION_HEADER.match(txt)
        if sec_match and not is_valid_finding_code(sec_match.group(1)):
            if active_finding:
                findings.append(active_finding)
                active_finding = None
            current_section = f"{sec_match.group(1)} {sec_match.group(2).strip()}"
            in_chapter_3 = True
            continue

        f_match = RE_FINDING_HEADER.match(txt)
        if f_match and is_valid_finding_code(f_match.group(1)):
            code = f_match.group(1).strip()
            title = f_match.group(2).strip()

            if len(title) < 6 or (len(title.split()) > 28 and title.endswith(".")):
                if active_finding is not None:
                    active_finding["blocks"].append(txt)
                    active_finding["end_loc"] = loc
                continue

            if active_finding:
                findings.append(active_finding)

            in_chapter_3 = True
            active_finding = {
                "seccion": current_section,
                "codigo": code,
                "titulo": title,
                "start_loc": loc,
                "end_loc": loc,
                "blocks": [txt],
            }
            continue

        if active_finding is not None:
            active_finding["blocks"].append(txt)
            active_finding["end_loc"] = loc

    if active_finding:
        findings.append(active_finding)

    by_code: Dict[str, Dict[str, Any]] = {}
    order_codes: List[str] = []
    for item in findings:
        full_text = "\n\n".join(item["blocks"])
        item["transcripcion_integra"] = full_text
        item["ubicacion"] = f"{item['start_loc']} → {item['end_loc']}"
        c = item["codigo"]
        if c not in by_code:
            by_code[c] = item
            order_codes.append(c)
        elif len(full_text) > len(by_code[c]["transcripcion_integra"]):
            by_code[c] = item

    return [by_code[c] for c in order_codes]


# ==============================================================================
# FASE 4: ANÁLISIS FORENSE / OLLAMA / GEMINI BLINDADO + CERO INVENCIÓN
# ==============================================================================
NORM_PATTERNS = [
    r"Ley\s+(?:núm\.|n\.°|No\.|N°|#)?\s*\d+[-–]\d+[^,.;\n]*",
    r"Decreto\s+(?:núm\.|n\.°|No\.|N°|#)?\s*\d+[-–]\d+[^,.;\n]*",
    r"Resolución\s+(?:núm\.|n\.°|No\.|N°|#)?\s*[\w\d/-]+[^,.;\n]*",
    r"NOBACI[^,.;\n]*",
    r"ADC-\d+-\d+(?:\.\d+)?",
    r"Artículo(?:s)?\s+\d+[^,.;\n]*",
    r"Constitución\s+de\s+la\s+República[^,.;\n]*",
    r"\b(?:POA|PACC|PEI)\b",
]


def extract_normative_references(text: str) -> str:
    found = []
    for pat in NORM_PATTERNS:
        for m in re.findall(pat, text, flags=re.IGNORECASE):
            clean = re.sub(r"\s+", " ", m).strip(" ,.;:")
            if len(clean) >= 3 and clean not in found:
                found.append(clean)
    return "; ".join(found[:18]) if found else "No explicitado en el texto del informe"


def compute_similarity_matrix(corpus: List[str]) -> np.ndarray:
    n = len(corpus)
    mat = np.zeros((n, n))
    if n <= 1:
        return mat

    if HAS_SKLEARN:
        try:
            vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
            tfidf = vec.fit_transform(corpus)
            return cosine_similarity(tfidf)
        except Exception:
            pass

    counters = [Counter(re.findall(r"\w+", doc.lower())) for doc in corpus]
    for i in range(n):
        for j in range(i + 1, n):
            c1, c2 = counters[i], counters[j]
            common = set(c1.keys()) & set(c2.keys())
            num = sum(c1[k] * c2[k] for k in common)
            den = math.sqrt(sum(v * v for v in c1.values())) * math.sqrt(sum(v * v for v in c2.values()))
            sim = (num / den) if den > 0 else 0.0
            mat[i, j] = sim
            mat[j, i] = sim
    return mat


def split_forensic_attributes(full_text: str, title: str) -> Dict[str, str]:
    paragraphs = [p.strip() for p in full_text.split("\n\n") if p.strip()]
    body_paras = paragraphs[1:] if len(paragraphs) > 1 else paragraphs

    condicion_list, criterio_list, causa_list, efecto_list = [], [], [], []
    evidencia_list, recom_list = [], []

    for p in body_paras:
        p_low = p.lower()
        if p_low.startswith("criterio:") or any(k in p_low for k in ["ley ", "decreto ", "nobaci", "adc-", "artículo", "resolución", "norma ", "reglamento"]):
            criterio_list.append(p)
        elif p_low.startswith("recomendación:") or any(k in p_low for k in ["se recomienda", "debe instruir", "deberá proceder", "instruir al", "instruir a la"]):
            recom_list.append(p)
        elif p_low.startswith("causa:") or any(k in p_low for k in ["debido a", "originado por", "la causa", "obedece a", "producto de la falta"]):
            causa_list.append(p)
        elif p_low.startswith("efecto:") or any(k in p_low for k in ["lo que ocasionó", "generando", "el efecto", "genera riesgo", "exposición a", "afecta la", "limita la"]):
            efecto_list.append(p)
        else:
            condicion_list.append(p)

        if p_low.startswith("evidencia") or any(k in p_low for k in ["anexo", "comunicación", "oficio", "certificación", "expediente", "contrato", "factura", "tabla adjunta", "muestra", "libramiento"]):
            evidencia_list.append(p)

    condicion = "\n".join(condicion_list) if condicion_list else title
    criterio = "\n".join(criterio_list) if criterio_list else "No explicitado en el texto del informe"
    causa = "\n".join(causa_list) if causa_list else "No explicitado en el texto del informe"
    efecto_raw = "\n".join(efecto_list) if efecto_list else "No explicitado en el texto del informe"
    evidencia = "\n".join(evidencia_list) if evidencia_list else "No explicitado en el texto del informe"

    nums = re.findall(
        r"(?:RD\$|\$|US\$)\s*[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*%|\b\d+\s*(?:expedientes|contratos|libramientos|procesos|servidores|instrumentos|meses)\b",
        full_text,
        flags=re.IGNORECASE,
    )
    cuantificacion = ", ".join(dict.fromkeys(nums[:15])) if nums else "No explicitado en el texto del informe"

    cargos = re.findall(
        r"(?:Director(?:a)?(?:\s+[\w\s]{2,35})?|Encargado(?:a)?(?:\s+[\w\s]{2,35})?|Titular|MAE|Comit[eé]\s+de\s+Compras|RAI|Tesorer[ií]a|Consultor(?:a)?\s+Jur[ií]dic[oa])",
        full_text,
        flags=re.IGNORECASE,
    )
    responsabilidad = ", ".join(dict.fromkeys([re.sub(r"\s+", " ", c).strip() for c in cargos[:8]])) if cargos else "No explicitado en el texto del informe"
    recomendacion = "\n".join(recom_list) if recom_list else "No explicitado en el texto del informe"

    return {
        "condicion": condicion,
        "criterio": criterio,
        "causa": causa,
        "efecto": efecto_raw,
        "riesgo": efecto_raw if ("riesgo" in efecto_raw.lower() or "exposición" in efecto_raw.lower()) else "No explicitado en el texto del informe",
        "evidencia": evidencia,
        "cuantificacion": cuantificacion,
        "responsabilidad": responsabilidad,
        "recomendacion": recomendacion,
    }


def calcular_nivel(puntaje: float) -> str:
    if puntaje >= 9.0:
        return "EXCELENTE (10/10)"
    if puntaje >= 7.5:
        return "SÓLIDO (CONSERVAR)"
    if puntaje >= 5.0:
        return "MEJORABLE (REFORZAR)"
    return "CRÍTICO (< 5.0 DEPURAR)"


def build_ai_prompt(finding: Dict[str, Any]) -> str:
    return f"""Eres un Auditor Forense y Supervisor de Control Gubernamental en República Dominicana (Ley 18-24, Ley 10-07, Ley 41-08, Ley 340-06 y NOBACI).
REGLA ESTRICTA DE INTEGRIDAD: Analiza ÚNICAMENTE el contenido real transcrito del informe. NO inventes montos, fechas, cargos ni leyes que no aparezcan en el texto. Si un elemento falta en el texto original, indícalo expresamente.

CÓDIGO: {finding['codigo']}
SECCIÓN: {finding['seccion']}
TÍTULO: {finding['titulo']}
TRANSCRIPCIÓN ÍNTEGRA TEXTUAL DEL INFORME:
\"\"\"
{finding['transcripcion_integra'][:14000]}
\"\"\"

Responde ÚNICAMENTE con un objeto JSON válido (sin bloques markdown ```json) con estas claves exactas:
condicion, criterio, causa, efecto, riesgo, evidencia, cuantificacion, responsabilidad, recomendacion, deficiencias, clasificacion, justificacion, puntaje, que_falta, version_mejorada."""


def parse_ai_json_safe(raw: str, fallback_attrs: Dict[str, str]) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    try:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE | re.MULTILINE).strip()
        m = re.search(r"\{[\s\S]*\}", cleaned)
        parsed = json.loads(m.group(0) if m else cleaned)
        if isinstance(parsed, dict):
            merged = {**fallback_attrs}
            for k, v in parsed.items():
                if v is not None and str(v).strip() != "":
                    merged[k] = v
            return merged
    except Exception:
        return None
    return None


def evaluate_with_ollama(finding: Dict[str, Any], attrs: Dict[str, str], ollama_url: str, model_name: str) -> Optional[Dict[str, Any]]:
    try:
        resp = requests.post(
            f"{ollama_url.rstrip('/')}/api/generate",
            json={"model": model_name, "prompt": build_ai_prompt(finding), "stream": False, "format": "json"},
            timeout=90,
        )
        resp.raise_for_status()
        return parse_ai_json_safe(resp.json().get("response", ""), attrs)
    except Exception:
        return None


def evaluate_deterministic_forensic(
    finding: Dict[str, Any],
    attrs: Dict[str, str],
    refs: str,
    sim_pct: float,
    related_code: str,
) -> Dict[str, Any]:
    full_txt = finding["transcripcion_integra"]
    word_count = len(full_txt.split())

    score = 0.0
    deficiencias = []
    que_falta = []

    if len(attrs["condicion"]) > 80 and word_count >= 35:
        score += 2.5
    elif len(attrs["condicion"]) > 25:
        score += 1.5
        deficiencias.append("Condición breve en el texto.")
        que_falta.append("Ampliar detalle fáctico de la condición.")
    else:
        deficiencias.append("Condición ausente o limitada al título.")
        que_falta.append("Incorporar hechos verificables de la condición.")

    if not attrs["criterio"].startswith("No explicitado") and not refs.startswith("No explicitado"):
        score += 2.5
        if len(attrs["criterio"]) > 1800:
            score -= 0.5
            deficiencias.append("Transcripción extensa de artículos/numerales que pueden depurarse.")
            que_falta.append("Depurar numerales sin relación directa con la condición.")
    else:
        deficiencias.append("Criterio normativo no explicitado en el bloque.")
        que_falta.append("Vincular base legal/normativa aplicable.")

    if not attrs["evidencia"].startswith("No explicitado"):
        score += 1.5
    else:
        deficiencias.append("Sin referencia explícita a anexos o soportes.")
        que_falta.append("Citar anexos, comunicaciones y evidencias.")

    if not attrs["cuantificacion"].startswith("No explicitado"):
        score += 1.0
    else:
        deficiencias.append("Sin cuantificación monetaria o muestral.")
        que_falta.append("Cuantificar universo, muestra o impacto económico.")

    if not attrs["causa"].startswith("No explicitado"):
        score += 0.75
    else:
        deficiencias.append("Causa raíz no explicitada.")
        que_falta.append("Redactar párrafo expreso de causa raíz.")

    if not attrs["efecto"].startswith("No explicitado"):
        score += 0.75
    else:
        deficiencias.append("Efecto/riesgo no explicitado.")
        que_falta.append("Explicitar efecto material y riesgo institucional.")

    if not attrs["responsabilidad"].startswith("No explicitado"):
        score += 0.5
    else:
        deficiencias.append("Cargo responsable no delimitado.")
        que_falta.append("Delimitar el cargo titular responsable.")

    if not attrs["recomendacion"].startswith("No explicitado"):
        score += 0.5
    else:
        deficiencias.append("Sin recomendación específica vinculada.")
        que_falta.append("Incluir recomendación correctiva dirigida al Titular/MAE.")

    score = round(max(0.0, min(10.0, score)), 2)

    if word_count < 20 and score < 3.0:
        clasificacion = "ELIMINAR"
        justificacion = f"Bloque {finding['codigo']} sin desarrollo sustantivo ({word_count} palabras); revisar eliminación."
    elif sim_pct >= 72.0 and related_code:
        clasificacion = "CONSOLIDAR"
        justificacion = f"Similitud real del {sim_pct:.1f}% con {related_code}; consolidar conservando normativa ({refs})."
    elif score >= 7.5:
        clasificacion = "CONSERVAR"
        justificacion = f"Hallazgo sustentado ({score}/10) con evidencia y normativa real ({refs})."
    else:
        clasificacion = "MEJORAR"
        justificacion = f"Hallazgo válido que requiere completar brechas ({', '.join(deficiencias[:3])}) sobre ({refs})."

    version_10 = (
        f"[{finding['codigo']} — {finding['titulo']}]\n"
        f"• CONDICIÓN (Factual del informe): {attrs['condicion']}\n"
        f"• CRITERIO NORMATIVO APLICABLE: {attrs['criterio']}\n"
        f"• EVIDENCIA Y CUANTIFICACIÓN: {attrs['evidencia']} | Datos: {attrs['cuantificacion']}\n"
        f"• BRECHAS A COMPLETAR (Sin datos inventados): {'; '.join(que_falta) if que_falta else 'Completo (10/10).'}"
    )

    result = {**attrs}
    result.update({
        "deficiencias": "; ".join(deficiencias) if deficiencias else "Ninguna deficiencia crítica.",
        "clasificacion": clasificacion,
        "justificacion": justificacion,
        "puntaje": score,
        "que_falta": "; ".join(que_falta) if que_falta else "Cumple estándares técnicos (10/10).",
        "version_mejorada": version_10,
    })
    return result


def analyze_findings_pipeline(
    findings: List[Dict[str, Any]],
    ai_status: Dict[str, Any],
    modo_motor: str = "Auto-Cascada Inteligente",
) -> Tuple[pd.DataFrame, str]:
    if not findings:
        return pd.DataFrame(columns=MATRIX_COLUMNS), "Sin hallazgos"

    ollama_activo = False
    gemini_activo = False
    motor_efectivo = "Motor Documental Forense Autónomo (100% Gratuito)"

    # Pre-Check único antes del bucle (evita repetir errores por cada hallazgo)
    if "Ollama" in modo_motor:
        if ai_status.get("ollama_ok"):
            ollama_activo = True
            motor_efectivo = f"IA Local Confidencial (Ollama: {ai_status['ollama_model']})"
        elif ai_status.get("gemini_ok"):
            gemini_activo = True
            motor_efectivo = "IA Cloud Autogestionada (Auto-Respaldo por Ollama apagado)"
            st.info("Ollama no detectado en puerto local. Conmutando automáticamente a IA Cloud Autogestionada.")
        else:
            st.info("Ollama no detectado en puerto local. Ejecutando análisis con Motor Documental Forense Autónomo sin interrupciones.")
    elif "Cloud" in modo_motor or "Gemini" in modo_motor:
        if ai_status.get("gemini_ok"):
            gemini_activo = True
            motor_efectivo = "IA Cloud Autogestionada (Multi-Modelo)"
        elif ai_status.get("ollama_ok"):
            ollama_activo = True
            motor_efectivo = f"IA Local Confidencial (Auto-Respaldo Ollama: {ai_status['ollama_model']})"
        else:
            st.info("Sin credencial Cloud activa en Secrets/entorno. Ejecutando con Motor Documental Forense Autónomo gratuito.")
    elif "Auto-Cascada" in modo_motor:
        if ai_status.get("ollama_ok"):
            ollama_activo = True
            motor_efectivo = f"Auto-Cascada → Ollama Local ({ai_status['ollama_model']})"
        elif ai_status.get("gemini_ok"):
            gemini_activo = True
            motor_efectivo = "Auto-Cascada → IA Cloud Autogestionada"
        else:
            motor_efectivo = "Auto-Cascada → Motor Documental Forense Autónomo (100% Gratuito)"

    corpus = [f["transcripcion_integra"] for f in findings]
    sim_matrix = compute_similarity_matrix(corpus)

    rows = []
    progress = st.progress(0, text="Evaluando hallazgos íntegros...")

    for idx, f in enumerate(findings):
        progress.progress((idx + 1) / len(findings), text=f"Evaluando hallazgo {f['codigo']} ({idx + 1}/{len(findings)})...")

        max_sim = 0.0
        rel_code = ""
        if len(findings) > 1:
            sims = sim_matrix[idx].copy()
            sims[idx] = -1.0
            best_j = int(np.argmax(sims))
            if sims[best_j] > 0:
                max_sim = round(float(sims[best_j]) * 100, 1)
                rel_code = findings[best_j]["codigo"] if max_sim >= 45.0 else ""

        dup_label = f"Sí ({max_sim}%)" if max_sim >= 65.0 else (f"Parcial ({max_sim}%)" if max_sim >= 45.0 else f"No ({max_sim}%)")
        attrs = split_forensic_attributes(f["transcripcion_integra"], f["titulo"])
        refs = extract_normative_references(f["transcripcion_integra"])

        eval_res = None
        if ollama_activo:
            eval_res = evaluate_with_ollama(f, attrs, ai_status["ollama_url"], ai_status["ollama_model"])
            if eval_res is None:
                st.warning(f"Ollama interrumpido en {f['codigo']}. Activando respaldo automático sin detener el análisis.")
                ollama_activo = False
                if ai_status.get("gemini_ok"):
                    gemini_activo = True
                    motor_efectivo = "IA Cloud Autogestionada (Respaldo)"
                else:
                    motor_efectivo = "Motor Documental Forense (Respaldo Autónomo Local)"

        if eval_res is None and gemini_activo:
            raw_gem, model_used = consultar_gemini_blindado(ai_status["gemini_key"], build_ai_prompt(f))
            eval_res = parse_ai_json_safe(raw_gem or "", attrs)
            if eval_res is None:
                st.warning(f"Motor Cloud no respondió en {f['codigo']}. Aplicando Motor Documental Forense Autónomo.")
                gemini_activo = False
                motor_efectivo = "Motor Documental Forense (Respaldo Autónomo Local)"
            elif model_used:
                motor_efectivo = f"IA Cloud Autogestionada ({model_used})"

        if eval_res is None:
            eval_res = evaluate_deterministic_forensic(f, attrs, refs, max_sim, rel_code)

        puntaje_final = round(max(0.0, min(10.0, float(eval_res.get("puntaje", 7.0)))), 2)

        rows.append({
            "ID_BD": None,
            "Verificado": False,
            "Sección": f.get("seccion", ""),
            "Código": f.get("codigo", ""),
            "Hallazgo actual": f.get("titulo", ""),
            "Transcripción íntegra": f.get("transcripcion_integra", ""),
            "Condición": eval_res.get("condicion", attrs["condicion"]),
            "Criterio": eval_res.get("criterio", attrs["criterio"]),
            "Causa": eval_res.get("causa", attrs["causa"]),
            "Efecto": eval_res.get("efecto", attrs["efecto"]),
            "Riesgo": eval_res.get("riesgo", attrs["riesgo"]),
            "Evidencia": eval_res.get("evidencia", attrs["evidencia"]),
            "Cuantificación": eval_res.get("cuantificacion", attrs["cuantificacion"]),
            "Responsabilidad": eval_res.get("responsabilidad", attrs["responsabilidad"]),
            "Recomendación actual": eval_res.get("recomendacion", attrs["recomendacion"]),
            "Deficiencias": eval_res.get("deficiencias", ""),
            "Duplicidad": dup_label,
            "Hallazgo relacionado": rel_code,
            "Clasificación": eval_res.get("clasificacion", "MEJORAR"),
            "Justificación de conservar/eliminar/consolidar": eval_res.get("justificacion", ""),
            "Puntaje 0–10": puntaje_final,
            "Nivel": calcular_nivel(puntaje_final),
            "Qué falta para 10/10": eval_res.get("que_falta", ""),
            "Versión mejorada 10/10": eval_res.get("version_mejorada", ""),
            "Referencias normativas": refs,
            "Ubicación": f.get("ubicacion", ""),
        })

    progress.empty()
    return pd.DataFrame(rows), motor_efectivo


# ==============================================================================
# EXPORTADORES PROFESIONALES (EXCEL .XLSX, WORD .DOCX, CSV)
# ==============================================================================
def export_to_excel_bytes(df: pd.DataFrame, meta: Dict[str, str]) -> bytes:
    output = io.BytesIO()
    export_df = df.drop(columns=["ID_BD"], errors="ignore")

    try:
        import xlsxwriter  # noqa: F401
        with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
            export_df.to_excel(writer, sheet_name="Matriz_Hallazgos", index=False, startrow=4)
            workbook = writer.book
            ws = writer.sheets["Matriz_Hallazgos"]
            title_fmt = workbook.add_format({"bold": True, "font_size": 14, "font_color": "#0F2942"})
            meta_fmt = workbook.add_format({"font_size": 10, "font_color": "#333333"})
            header_fmt = workbook.add_format({"bold": True, "bg_color": "#0F2942", "font_color": "#FFFFFF", "border": 1, "text_wrap": True})
            cell_fmt = workbook.add_format({"border": 1, "text_wrap": True, "valign": "top"})

            ws.write("A1", f"{APP_TITLE} — MATRIZ ÍNTEGRA DE HALLAZGOS (100% DATOS REALES)", title_fmt)
            ws.write("A2", f"Archivo: {meta.get('archivo', '')} | SHA-256: {meta.get('sha256', '')}", meta_fmt)

            for col_num, col_name in enumerate(export_df.columns):
                ws.write(4, col_num, col_name, header_fmt)
                ws.set_column(col_num, col_num, 38 if col_name == "Transcripción íntegra" else 24)

            for r_idx in range(len(export_df)):
                for c_idx in range(len(export_df.columns)):
                    val = export_df.iloc[r_idx, c_idx]
                    ws.write(r_idx + 5, c_idx, "" if pd.isna(val) else val, cell_fmt)
    except Exception:
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            export_df.to_excel(writer, sheet_name="Matriz_Hallazgos", index=False, startrow=3)
            ws = writer.sheets["Matriz_Hallazgos"]
            ws["A1"] = f"{APP_TITLE} — MATRIZ ÍNTEGRA DE HALLAZGOS"
            ws["A2"] = f"Archivo: {meta.get('archivo', '')} | SHA-256: {meta.get('sha256', '')}"

    return output.getvalue()


def export_to_word_bytes(df: pd.DataFrame, meta: Dict[str, str]) -> bytes:
    doc = docx.Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10.5)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_t = p_title.add_run(f"{APP_TITLE}\nINFORME EJECUTIVO DE REVISIÓN ÍNTEGRA DE HALLAZGOS")
    run_t.bold = True
    run_t.font.size = Pt(15)
    run_t.font.color.rgb = RGBColor(15, 41, 66)

    doc.add_paragraph(
        f"Entidad / Archivo Fuente: {meta.get('archivo', '')}\n"
        f"Trazabilidad SHA-256: {meta.get('sha256', '')}\n"
        f"Total Hallazgos Extraídos: {len(df)}\n"
        f"Fecha de Emisión: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    doc.add_heading("Detalle Técnico y Transcripción Íntegra por Hallazgo", level=1)

    for _, r in df.iterrows():
        doc.add_heading(f"{r['Código']} — {r['Hallazgo actual']}", level=2)
        doc.add_paragraph(
            f"Sección: {r['Sección']} | Ubicación: {r['Ubicación']} | "
            f"Puntaje: {r['Puntaje 0–10']}/10 ({r['Nivel']}) | Clasificación: {r['Clasificación']}"
        )
        doc.add_paragraph(f"• Condición: {r['Condición']}")
        doc.add_paragraph(f"• Criterio Normativo: {r['Criterio']}")
        doc.add_paragraph(f"• Causa / Efecto / Riesgo: {r['Causa']} | {r['Efecto']} | {r['Riesgo']}")
        doc.add_paragraph(f"• Evidencia / Cuantificación / Responsabilidad: {r['Evidencia']} | {r['Cuantificación']} | {r['Responsabilidad']}")
        doc.add_paragraph(f"• Recomendación Actual: {r['Recomendación actual']}")
        doc.add_paragraph(f"• Referencias Normativas Reales: {r['Referencias normativas']}")
        doc.add_paragraph(f"• Duplicidad: {r['Duplicidad']} {('-> Relacionado con ' + str(r['Hallazgo relacionado'])) if r['Hallazgo relacionado'] else ''}")
        doc.add_paragraph(f"• Justificación Técnica: {r['Justificación de conservar/eliminar/consolidar']}")
        doc.add_paragraph(f"• Qué falta para 10/10: {r['Qué falta para 10/10']}")
        p_orig = doc.add_paragraph()
        p_orig.add_run("Transcripción Íntegra Textual del Informe:\n").bold = True
        p_orig.add_run(str(r["Transcripción íntegra"]))

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def procesar_y_guardar_documento(
    file_name: str,
    file_bytes: bytes,
    ai_status: Dict[str, Any],
    modo_motor: str = "Auto-Cascada Inteligente",
) -> Tuple[int, int, str, str, str]:
    sha256_hash = compute_sha256(file_bytes)
    records, meta_doc = extract_structured_lines(file_name, file_bytes)
    findings = segment_findings_from_records(records)
    if not findings:
        return 0, 0, meta_doc, "", "No se detectaron códigos de hallazgo válidos (ej. 3.01, 3.1.01, 3.4.1)."
    df_res, motor_label = analyze_findings_pipeline(findings, ai_status, modo_motor=modo_motor)
    audit_id = db_save_audit(file_name, sha256_hash, motor_label, meta_doc, df_res)
    return audit_id, len(findings), meta_doc, motor_label, ""


# ==============================================================================
# INTERFAZ PRINCIPAL STREAMLIT (v8.0.0-FINAL-PROD UNIFICADO)
# ==============================================================================
def main():
    st.set_page_config(page_title=APP_TITLE, page_icon="🛡️", layout="wide")
    init_db()

    st.markdown(f"""
        <div style="background: linear-gradient(90deg, #0F2942 0%, #1E4D7B 100%); padding: 1.2rem; border-radius: 10px; color: white; margin-bottom: 1rem;">
            <h1 style="margin:0; font-size:1.6rem;">🛡️ {APP_TITLE}</h1>
            <p style="margin:0.2rem 0 0 0; opacity:0.9; font-size:0.9rem;">{APP_VERSION}</p>
        </div>
    """, unsafe_allow_html=True)

    ollama_url_default = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")

    with st.sidebar:
        st.header("🧠 Autonomía y Pre-Check de Motores")
        motores_opciones = [
            "Auto-Cascada Inteligente (Recomendado)",
            "Motor Documental Forense (100% Local / Offline)",
            "IA Cloud Autogestionada (Multi-Modelo)",
            "IA Local Confidencial (Ollama)",
        ]
        modo_motor = st.radio("Modo de Evaluación IA:", motores_opciones, index=0)

        ollama_url = ollama_url_default
        ollama_model_override = ""
        if "Ollama" in modo_motor:
            ollama_url = st.text_input("URL Servidor Ollama:", value=ollama_url_default)
            ollama_model_override = st.text_input("Modelo Local Preferido (opcional):", value="")

        ai_status = detectar_motores_ia_disponibles(ollama_url)
        if ollama_model_override.strip():
            ai_status["ollama_model"] = ollama_model_override.strip()

        st.caption(
            f"Estado en tiempo real (sin pedir claves):\n"
            f"• **Ollama Local:** {'🟢 En línea (' + ai_status['ollama_model'] + ')' if ai_status['ollama_ok'] else '⚪ Apagado (Respaldo automático)'}\n"
            f"• **IA Cloud (Secrets/Env):** {'🟢 Configurada automáticamente' if ai_status['gemini_ok'] else '🟡 Respaldo Autónomo activo'}\n"
            f"• **Motor Documental Forense:** 🟢 100% Activo (Gratis)"
        )

        if st.button("🔌 Verificar Salud de Motores IA", use_container_width=True):
            with st.spinner("Ejecutando Pre-Check rápido de motores..."):
                fresh_status = detectar_motores_ia_disponibles(ollama_url)
                if fresh_status["gemini_ok"]:
                    txt_ping, m_ping = consultar_gemini_blindado(
                        fresh_status["gemini_key"],
                        "Responde únicamente: CONEXION_EXITOSA_BASA13",
                    )
                    if txt_ping:
                        st.success(f"Cloud IA Activo ({m_ping}): {txt_ping.strip()}")
                    else:
                        st.info("Cloud IA sin cuota temporalmente; respaldo autónomo listo.")
                if fresh_status["ollama_ok"]:
                    st.success(f"Ollama Local Activo: {fresh_status['ollama_model']}")
                else:
                    st.info(f"Ollama: {fresh_status['ollama_msg']}. El sistema operará sin errores mediante respaldo automático.")

        st.divider()
        st.header("🗄️ Base de Datos y Fusión SQLite")
        st.caption(f"BD Activa: `{os.path.basename(DB_PATH)}`")
        if st.button("🧹 Limpiar BD (Dejar en 0 para Producción)", type="primary", use_container_width=True):
            purgados = reset_clean_database()
            st.session_state.pop("active_audit_id", None)
            st.success(f"BD limpia y compactada (0 registros). Purgados: {sum(purgados.values())}")
            st.rerun()

        db_sec_file = st.file_uploader("Fusionar BD SQLite secundaria (.db):", type=["db", "sqlite", "sqlite3"], key="db_merger")
        if db_sec_file is not None and st.button("🔗 Ejecutar Fusión hacia BD Principal", use_container_width=True):
            temp_dir = os.path.join(BASE_DIR, "temp_uploads")
            os.makedirs(temp_dir, exist_ok=True)
            ruta_temp = os.path.join(temp_dir, db_sec_file.name)
            with open(ruta_temp, "wb") as f_tmp:
                f_tmp.write(db_sec_file.getbuffer())
            res_fus = fusionar_base_datos_secundaria(ruta_temp)
            st.success("Fusión completada.")
            st.json(res_fus)
            st.rerun()

    tab1, tab2, tab3, tab4 = st.tabs([
        "📤 1. Cargar Informe / Ejemplo Word",
        "🔥 2. Matriz Íntegra, Heatmap 0–10 y Excel/Word",
        "📊 3. Ley de Benford",
        "📚 4. Histórico CRUD, Fusión y Bitácora",
    ])

    # TAB 1: CARGA REAL + EJEMPLO WORD CONFIGURABLE
    with tab1:
        st.subheader("Cargar Informe Real o Ejecutar Ejemplo Word (.docx) de Configuración")
        st.info(
            "Puede usar el **Informe Modelo en Word (.docx)** para configurar la base de datos y validar las descargas en Excel/Word, "
            "o cargar directamente cualquier otro informe real (.docx, .pdf, .xlsx, .csv, .txt)."
        )

        col_ex1, col_ex2 = st.columns(2)
        sample_bytes = generar_informe_ejemplo_docx()
        with col_ex1:
            if st.button("⚡ Cargar y Ejecutar Ejemplo Word (.docx) de Configuración", type="primary", use_container_width=True):
                with st.spinner("Ejecutando fases 1–4 sobre el informe Word modelo..."):
                    aid, count, meta_doc, motor_real, err = procesar_y_guardar_documento(
                        "Informe_Auditoria_Modelo_Configuracion_BASA13.docx",
                        sample_bytes,
                        ai_status,
                        modo_motor=modo_motor,
                    )
                if err:
                    st.error(err)
                else:
                    st.session_state["active_audit_id"] = aid
                    st.success(f"✅ Ejemplo Word procesado ({count} hallazgos · {meta_doc} · Motor: {motor_real}) y guardado en BD ID #{aid}. Pase a la Pestaña 2.")
        with col_ex2:
            st.download_button(
                "📥 Descargar Plantilla Ejemplo Word (.docx)",
                data=sample_bytes,
                file_name="Informe_Auditoria_Modelo_Configuracion_BASA13.docx",
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                use_container_width=True,
            )

        st.divider()
        uploaded = st.file_uploader(
            "Sustituir o cargar informe real de auditoría (DOCX, PDF, XLSX, CSV, TXT, MD):",
            type=["docx", "pdf", "xlsx", "xls", "csv", "txt", "md"],
        )
        if uploaded:
            file_bytes = uploaded.getvalue()
            sha256_hash = compute_sha256(file_bytes)
            st.info(f"**Archivo:** `{uploaded.name}` | **Modo:** `{modo_motor}` | **SHA-256:** `{sha256_hash}`")
            if st.button("🚀 Extraer 100% Todos los Hallazgos Íntegramente y Guardar en BD", type="primary"):
                with st.spinner("Leyendo estructura XML/Esquema y reconstruyendo cada hallazgo textual..."):
                    aid, count, meta_doc, motor_real, err = procesar_y_guardar_documento(
                        uploaded.name,
                        file_bytes,
                        ai_status,
                        modo_motor=modo_motor,
                    )
                if err:
                    st.error(err)
                else:
                    st.session_state["active_audit_id"] = aid
                    st.success(f"✅ Se extrajeron **{count} hallazgos íntegros** ({meta_doc}) con `{motor_real}` y se guardaron en BD con ID #{aid}. Pase a la Pestaña 2.")

    # TAB 2: HEATMAP 0-10 + EDITOR CRUD + EXPORTACIÓN EXCEL / WORD / CSV
    with tab2:
        audits_df = db_list_audits()
        if audits_df.empty:
            st.info("Base de datos limpia en estado de producción (0 análisis pendientes). Cargue un informe o ejecute el Ejemplo Word en la Pestaña 1.")
        else:
            options = {
                f"#{r['ID']} | {r['Archivo']} ({r['Hallazgos']} hallazgos - Prom: {r['Promedio']}/10)": r
                for _, r in audits_df.iterrows()
            }
            default_idx = 0
            if "active_audit_id" in st.session_state:
                for i, (_, r) in enumerate(options.items()):
                    if int(r["ID"]) == st.session_state["active_audit_id"]:
                        default_idx = i
                        break

            sel_label = st.selectbox("Seleccione Entidad / Informe Activo:", list(options.keys()), index=default_idx)
            sel_row = options[sel_label]
            aid = int(sel_row["ID"])
            st.session_state["active_audit_id"] = aid

            df_h = db_load_hallazgos(aid)
            meta_dict = {"archivo": sel_row["Archivo"], "sha256": sel_row["SHA256_Full"]}

            b1, b2, b3 = st.columns(3)
            with b1:
                st.download_button(
                    "📊 Exportar Matriz Íntegra a Excel (.xlsx)",
                    data=export_to_excel_bytes(df_h, meta_dict),
                    file_name=f"BASA13_Matriz_Integra_ID{aid}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    use_container_width=True,
                )
            with b2:
                st.download_button(
                    "📄 Exportar Informe a Word (.docx)",
                    data=export_to_word_bytes(df_h, meta_dict),
                    file_name=f"BASA13_Informe_Integro_ID{aid}.docx",
                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    use_container_width=True,
                )
            with b3:
                st.download_button(
                    "📑 Exportar Datos a CSV (.csv)",
                    data=df_h.drop(columns=["ID_BD"], errors="ignore").to_csv(index=False).encode("utf-8-sig"),
                    file_name=f"BASA13_Hallazgos_ID{aid}.csv",
                    mime="text/csv",
                    use_container_width=True,
                )

            st.divider()
            if not df_h.empty:
                st.markdown("### 🔥 Heatmap de Severidad y Solidez Técnica (0–10)")
                crit_count = int((df_h["Puntaje 0–10"] < 5.0).sum())
                c1, c2, c3, c4, c5 = st.columns(5)
                c1.metric("Total Hallazgos", len(df_h))
                c2.metric("Severidad Crítica (<5.0)", crit_count)
                c3.metric("Verificados", int(df_h["Verificado"].sum()))
                c4.metric("Promedio Puntaje", f"{df_h['Puntaje 0–10'].mean():.2f}/10")
                c5.metric("Conservar", int((df_h["Clasificación"] == "CONSERVAR").sum()))

                filtro_sev = st.radio(
                    "Filtrar Heatmap y Matriz por Severidad Forense:",
                    ["Todos", "Solo Críticos (< 5.0)", "Alto (5.0–6.4)", "Moderado (6.5–7.9)", "Óptimo (8.0–10.0)"],
                    horizontal=True,
                )
                df_view = df_h.copy()
                if filtro_sev == "Solo Críticos (< 5.0)":
                    df_view = df_view[df_view["Puntaje 0–10"] < 5.0]
                elif filtro_sev == "Alto (5.0–6.4)":
                    df_view = df_view[(df_view["Puntaje 0–10"] >= 5.0) & (df_view["Puntaje 0–10"] < 6.5)]
                elif filtro_sev == "Moderado (6.5–7.9)":
                    df_view = df_view[(df_view["Puntaje 0–10"] >= 6.5) & (df_view["Puntaje 0–10"] < 8.0)]
                elif filtro_sev == "Óptimo (8.0–10.0)":
                    df_view = df_view[df_view["Puntaje 0–10"] >= 8.0]

                if not df_view.empty:
                    fig_hm = px.bar(
                        df_view.sort_values("Puntaje 0–10", ascending=True),
                        x="Código",
                        y="Puntaje 0–10",
                        color="Puntaje 0–10",
                        color_continuous_scale=["#DC2626", "#F97316", "#F59E0B", "#10B981"],
                        range_color=[0, 10],
                        hover_data=["Hallazgo actual", "Nivel", "Clasificación"],
                        title="Mapa Térmico por Puntaje de Solidez (Rojo = Severidad Crítica)",
                    )
                    st.plotly_chart(fig_hm, use_container_width=True)
            else:
                filtro_sev = "Todos"
                df_view = df_h

            edited_df = st.data_editor(
                df_view,
                num_rows="dynamic",
                use_container_width=True,
                height=440,
                column_config={
                    "ID_BD": st.column_config.NumberColumn("ID", disabled=True),
                    "Verificado": st.column_config.CheckboxColumn("Verificado", default=False),
                    "Puntaje 0–10": st.column_config.NumberColumn("Puntaje", min_value=0.0, max_value=10.0, step=0.5),
                    "Clasificación": st.column_config.SelectboxColumn("Clasificación", options=["CONSERVAR", "MEJORAR", "CONSOLIDAR", "ELIMINAR"]),
                },
                key=f"editor_main_{aid}",
            )

            col_s1, col_s2, col_s3 = st.columns(3)
            with col_s1:
                if st.button("💾 Guardar Cambios en BD", type="primary", use_container_width=True):
                    if filtro_sev == "Todos":
                        db_update_hallazgos_bulk(aid, edited_df, "EN REVISIÓN")
                        st.success("✅ Cambios guardados en SQLite.")
                        st.rerun()
                    else:
                        st.warning("Cambie el filtro a 'Todos' antes de guardar cambios masivos en BD.")
            with col_s2:
                if st.button("✅ Verificar Todos y Guardar", use_container_width=True):
                    df_all = df_h.copy()
                    df_all["Verificado"] = True
                    db_update_hallazgos_bulk(aid, df_all, "VERIFICADA")
                    st.success("✅ Auditoría marcada como 100% verificada.")
                    st.rerun()
            with col_s3:
                if st.button("🗑️ Eliminar Auditoría", use_container_width=True):
                    db_delete_audit(aid)
                    st.session_state.pop("active_audit_id", None)
                    st.warning("Auditoría eliminada.")
                    st.rerun()

    # TAB 3: ANÁLISIS NUMÉRICO BENFORD
    with tab3:
        st.subheader("Análisis Estadístico y Detección de Anomalías (Ley de Benford)")
        datos_ejemplo = st.text_area(
            "Montos detectados o separados por coma para análisis de primer dígito:",
            value="4850200, 1925400, 12450000, 1890, 2340, 3120, 4500, 1120, 8900, 9450, 1540, 2780, 1990, 5600, 7800, 1420",
        )
        if st.button("Calcular Distribución de Benford"):
            try:
                numeros = [abs(float(x.strip())) for x in datos_ejemplo.split(",") if x.strip() and float(x.strip()) != 0]
                primeros_digitos = [
                    int(next((c for c in f"{float(n):.10f}" if c.isdigit() and c != "0"), "1"))
                    for n in numeros
                ]
                conteo = pd.Series(primeros_digitos).value_counts().reindex(range(1, 10), fill_value=0)
                frecuencia_real = (conteo / len(primeros_digitos)) * 100
                benford_teorico = np.log10(1 + 1 / np.arange(1, 10)) * 100

                df_benford = pd.DataFrame({
                    "Dígito": range(1, 10),
                    "Frecuencia Real (%)": np.round(frecuencia_real.values, 2),
                    "Benford Teórico (%)": np.round(benford_teorico, 2),
                })
                fig_b = px.bar(
                    df_benford,
                    x="Dígito",
                    y=["Frecuencia Real (%)", "Benford Teórico (%)"],
                    barmode="group",
                    title="Comparativa Forense: Distribución Real vs. Ley de Benford",
                )
                st.plotly_chart(fig_b, use_container_width=True)
                st.dataframe(df_benford, use_container_width=True)
            except Exception as e:
                st.error(f"Error procesando los datos numéricos: {e}")

    # TAB 4: HISTÓRICO COMPLETO SQLITE (EDITAR METADATOS, HALLAZGOS, BORRAR, EXPORTAR Y BITÁCORA)
    with tab4:
        st.subheader("📚 Histórico de Entidades e Informes Evaluados (Gestión CRUD Completa)")
        hist = db_list_audits()
        if hist.empty:
            st.info("Sin registros históricos (Base de datos limpia en 0). Cargue un informe o el Ejemplo Word en la Pestaña 1.")
        else:
            st.dataframe(hist.drop(columns=["SHA256_Full"]), use_container_width=True)

            st.divider()
            st.markdown("### 🛠️ Gestionar Registro Seleccionado del Histórico (Editar, Guardar, Borrar o Exportar)")

            hist_options = {
                f"ID #{r['ID']} — {r['Archivo']} | Estado: {r['Estado']} | Hallazgos: {r['Hallazgos']}": r
                for _, r in hist.iterrows()
            }
            sel_hist_label = st.selectbox("Seleccione el registro histórico a gestionar:", list(hist_options.keys()), key="hist_selector")
            h_meta = hist_options[sel_hist_label]
            h_id = int(h_meta["ID"])

            col_m1, col_m2 = st.columns([2, 1])
            with col_m1:
                edit_nombre = st.text_input("Nombre del Archivo / Entidad Auditada:", value=h_meta["Archivo"], key=f"h_name_{h_id}")
            with col_m2:
                estados_lista = ["EN REVISIÓN", "VERIFICADA", "APROBADA SUPERVISIÓN", "ARCHIVADA"]
                idx_est = estados_lista.index(h_meta["Estado"]) if h_meta["Estado"] in estados_lista else 0
                edit_estado = st.selectbox("Estado del Informe:", estados_lista, index=idx_est, key=f"h_est_{h_id}")

            edit_obs = st.text_area("Notas / Observaciones de Supervisión del Informe:", value=h_meta["Observaciones"], height=80, key=f"h_obs_{h_id}")

            act1, act2, act3 = st.columns(3)
            with act1:
                if st.button("💾 Guardar Cambios del Histórico", type="primary", use_container_width=True, key=f"btn_save_hist_{h_id}"):
                    db_update_audit_metadata(h_id, edit_nombre, edit_estado, edit_obs)
                    st.success(f"✅ Metadatos del registro ID #{h_id} actualizados.")
                    st.rerun()
            with act2:
                if st.button("📂 Abrir en Editor Principal (Pestaña 2)", use_container_width=True, key=f"btn_open_hist_{h_id}"):
                    st.session_state["active_audit_id"] = h_id
                    st.info(f"Registro ID #{h_id} cargado como activo. Haga clic en la Pestaña 2 arriba para editar sus hallazgos y Heatmap.")
            with act3:
                if st.button("🗑️ Borrar Registro del Histórico", use_container_width=True, key=f"btn_del_hist_{h_id}"):
                    db_delete_audit(h_id)
                    if st.session_state.get("active_audit_id") == h_id:
                        st.session_state.pop("active_audit_id", None)
                    st.warning(f"Registro ID #{h_id} eliminado permanentemente de la base de datos.")
                    st.rerun()

            st.divider()
            st.markdown("#### ✏️ Edición Rápida de los Hallazgos de este Registro Histórico")
            df_hist_hallazgos = db_load_hallazgos(h_id)
            edited_hist_df = st.data_editor(
                df_hist_hallazgos,
                num_rows="dynamic",
                use_container_width=True,
                height=340,
                column_config={
                    "ID_BD": st.column_config.NumberColumn("ID", disabled=True),
                    "Verificado": st.column_config.CheckboxColumn("Verificado", default=False),
                    "Puntaje 0–10": st.column_config.NumberColumn("Puntaje", min_value=0.0, max_value=10.0, step=0.5),
                    "Clasificación": st.column_config.SelectboxColumn("Clasificación", options=["CONSERVAR", "MEJORAR", "CONSOLIDAR", "ELIMINAR"]),
                },
                key=f"editor_hist_inline_{h_id}",
            )

            ex1, ex2, ex3, ex4 = st.columns(4)
            with ex1:
                if st.button("💾 Guardar Hallazgos Editados", use_container_width=True, key=f"save_inline_{h_id}"):
                    db_update_hallazgos_bulk(h_id, edited_hist_df, edit_estado)
                    st.success("✅ Hallazgos del histórico guardados.")
                    st.rerun()
            with ex2:
                st.download_button(
                    "📊 Descargar Excel (.xlsx)",
                    data=export_to_excel_bytes(edited_hist_df, {"archivo": edit_nombre, "sha256": h_meta["SHA256_Full"]}),
                    file_name=f"BASA13_Historico_ID{h_id}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    use_container_width=True,
                    key=f"dl_xlsx_h_{h_id}",
                )
            with ex3:
                st.download_button(
                    "📄 Descargar Word (.docx)",
                    data=export_to_word_bytes(edited_hist_df, {"archivo": edit_nombre, "sha256": h_meta["SHA256_Full"]}),
                    file_name=f"BASA13_Historico_ID{h_id}.docx",
                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    use_container_width=True,
                    key=f"dl_docx_h_{h_id}",
                )
            with ex4:
                st.download_button(
                    "📑 Descargar CSV (.csv)",
                    data=edited_hist_df.drop(columns=["ID_BD"], errors="ignore").to_csv(index=False).encode("utf-8-sig"),
                    file_name=f"BASA13_Historico_ID{h_id}.csv",
                    mime="text/csv",
                    use_container_width=True,
                    key=f"dl_csv_h_{h_id}",
                )

        st.divider()
        with st.expander("🧾 Bitácora Forense de Operaciones en BD"):
            bit_df = db_list_bitacora(100)
            if bit_df.empty:
                st.caption("Sin operaciones registradas todavía.")
            else:
                st.dataframe(bit_df, use_container_width=True)


if __name__ == "__main__":
    main()
