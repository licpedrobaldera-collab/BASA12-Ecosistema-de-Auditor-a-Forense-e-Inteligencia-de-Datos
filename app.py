import os
import io
import streamlit as st
import pandas as pd
import numpy as np
import json
import hashlib
from datetime import datetime
from sqlalchemy import create_engine, text
from google import genai
import docx
from pypdf import PdfReader
import plotly.express as px

st.set_page_config(
    page_title="BASA12 - Ecosistema de Auditoría Forense",
    layout="wide",
    initial_sidebar_state="expanded"
)

@st.cache_resource
def init_db():
    engine = create_engine("sqlite:///basa12_auditoria.db")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS hallazgos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TEXT,
                archivo TEXT,
                hash_sha256 TEXT,
                riesgo TEXT,
                detalle TEXT
            )
        """))
    return engine

engine = init_db()

def get_gemini_client():
    api_key = ""
    try:
        api_key = st.secrets.get("GEMINI_API_KEY", "")
    except Exception:
        api_key = ""
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)

def calcular_hash(contenido_bytes):
    return hashlib.sha256(contenido_bytes).hexdigest()

def extraer_texto_archivo(archivo):
    nombre = archivo.name.lower()
    raw_bytes = archivo.getvalue()
    buffer = io.BytesIO(raw_bytes)
    if nombre.endswith(".pdf"):
        lector = PdfReader(buffer)
        return "\n".join([pagina.extract_text() or "" for pagina in lector.pages])
    elif nombre.endswith(".docx"):
        documento = docx.Document(buffer)
        partes = [p.text for p in documento.paragraphs if p.text.strip()]
        for tabla in documento.tables:
            for fila in tabla.rows:
                celdas = [c.text.strip() for c in fila.cells if c.text.strip()]
                if celdas:
                    partes.append(" | ".join(celdas))
        return "\n".join(partes)
    elif nombre.endswith(".xlsx") or nombre.endswith(".xls"):
        df = pd.read_excel(buffer)
        return df.to_string()
    elif nombre.endswith(".csv"):
        df = pd.read_csv(buffer)
        return df.to_string()
    else:
        return raw_bytes.decode("utf-8", errors="ignore")

if "texto_extraido" not in st.session_state:
    st.session_state.texto_extraido = ""
if "archivo_actual" not in st.session_state:
    st.session_state.archivo_actual = ""
if "hash_actual" not in st.session_state:
    st.session_state.hash_actual = ""
if "resultado_ia" not in st.session_state:
    st.session_state.resultado_ia = ""

st.title("BASA12 | Ecosistema de Auditoría Forense e Inteligencia de Datos")
st.markdown("Plataforma integral de análisis documental, trazabilidad SHA-256 y detección de hallazgos con IA.")

with st.sidebar:
    st.header("Panel de Control")
    client = get_gemini_client()
    if client:
        st.success("API Gemini conectada")
    else:
        st.warning("Configura GEMINI_API_KEY en Secrets")

    st.subheader("Carga de Evidencia")
    archivo_subido = st.file_uploader(
        "Sube documentos (PDF, DOCX, XLSX, CSV, TXT)",
        type=["pdf", "docx", "xlsx", "xls", "csv", "txt"]
    )

    if archivo_subido is not None:
        bytes_archivo = archivo_subido.getvalue()
        st.session_state.hash_actual = calcular_hash(bytes_archivo)
        st.session_state.archivo_actual = archivo_subido.name
        st.session_state.texto_extraido = extraer_texto_archivo(archivo_subido)
        st.info(f"Archivo: {st.session_state.archivo_actual}")
        st.code(f"SHA-256:\n{st.session_state.hash_actual}", language="text")

tab1, tab2, tab3, tab4 = st.tabs([
    "1. Visor de Evidencia",
    "2. Auditoría Forense IA",
    "3. Análisis Numérico (Ley de Benford)",
    "4. Base de Datos y Exportación"
])

with tab1:
    st.subheader("Contenido Extraído de la Evidencia")
    if st.session_state.texto_extraido:
        st.text_area(
            "Texto procesado listo para auditoría",
            value=st.session_state.texto_extraido,
            height=350
        )
    else:
        st.info("Sube un archivo en el panel lateral izquierdo para visualizar su contenido.")

with tab2:
    st.subheader("Motor de Análisis Forense con Inteligencia Artificial")
    instruccion = st.text_area(
        "Criterios o enfoque de auditoría",
        value="Analiza el siguiente documento en busca de inconsistencias contables, riesgos de cumplimiento, posibles fraudes o hallazgos relevantes. Clasifica el nivel de riesgo (Alto, Medio, Bajo) y detalla las recomendaciones.",
        height=100
    )

    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        nivel_riesgo = st.selectbox("Clasificación preliminar del hallazgo", ["Alto", "Medio", "Bajo"])
    with col_btn2:
        ejecutar_ia = st.button("Ejecutar Auditoría Forense", type="primary", use_container_width=True)

    if ejecutar_ia:
        if not st.session_state.texto_extraido:
            st.error("Primero debes cargar un documento en el panel lateral.")
        elif not client:
            st.error("Falta configurar GEMINI_API_KEY en Settings > Secrets de Streamlit Cloud.")
        else:
            with st.spinner("Analizando evidencia forense..."):
                try:
                    prompt = f"{instruccion}\n\nDocumento ({st.session_state.archivo_actual}):\n{st.session_state.texto_extraido[:25000]}"
                    respuesta = client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=prompt
                    )
                    st.session_state.resultado_ia = respuesta.text
                except Exception as e:
                    st.error(f"Error al consultar la API de Gemini: {e}")

    if st.session_state.resultado_ia:
        st.markdown("### Informe de Hallazgos")
        st.markdown(st.session_state.resultado_ia)

        if st.button("Guardar Hallazgo en Base de Datos SQL"):
            with engine.begin() as conn:
                conn.execute(
                    text("INSERT INTO hallazgos (fecha, archivo, hash_sha256, riesgo, detalle) VALUES (:f, :a, :h, :r, :d)"),
                    {
                        "f": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "a": st.session_state.archivo_actual,
                        "h": st.session_state.hash_actual,
                        "r": nivel_riesgo,
                        "d": st.session_state.resultado_ia
                    }
                )
            st.success("Hallazgo registrado con trazabilidad SHA-256.")

with tab3:
    st.subheader("Análisis Estadístico y Detección de Anomalías (NumPy)")
    datos_ejemplo = st.text_area(
        "Ingresa montos separados por coma para análisis de primer dígito (Benford)",
        value="1250, 1890, 2340, 3120, 4500, 1120, 8900, 9450, 1540, 2780, 1990, 5600, 7800, 1420"
    )
    if st.button("Calcular Distribución Numérica"):
        try:
            numeros = [abs(float(x.strip())) for x in datos_ejemplo.split(",") if x.strip() and float(x.strip()) != 0]
            arr = np.array(numeros)
            primeros_digitos = [
                int(next((c for c in f"{float(n):.10f}" if c.isdigit() and c != "0"), "1"))
                for n in arr
            ]
            conteo = pd.Series(primeros_digitos).value_counts().reindex(range(1, 10), fill_value=0)
            frecuencia_real = (conteo / len(primeros_digitos)) * 100
            benford_teorico = np.log10(1 + 1 / np.arange(1, 10)) * 100

            df_benford = pd.DataFrame({
                "Dígito": range(1, 10),
                "Frecuencia Real (%)": np.round(frecuencia_real.values, 2),
                "Benford Teórico (%)": np.round(benford_teorico, 2)
            })

            fig = px.bar(
                df_benford,
                x="Dígito",
                y=["Frecuencia Real (%)", "Benford Teórico (%)"],
                barmode="group",
                title="Comparativa Forense: Distribución Real vs. Ley de Benford"
            )
            st.plotly_chart(fig, use_container_width=True)
            st.dataframe(df_benford, use_container_width=True)
        except Exception as e:
            st.error(f"Error procesando los datos numéricos: {e}")

with tab4:
    st.subheader("Registro Histórico de Auditorías (SQLAlchemy)")
    df_sql = pd.read_sql("SELECT * FROM hallazgos ORDER BY id DESC", engine)
    if not df_sql.empty:
        st.dataframe(df_sql, use_container_width=True)
        json_export = df_sql.to_json(orient="records", indent=2, force_ascii=False)
        st.download_button(
            label="Descargar Reporte Consolidado (JSON)",
            data=json_export,
            file_name=f"auditoria_basa12_{datetime.now().strftime('%Y%m%d')}.json",
            mime="application/json"
        )
    else:
        st.info("Aún no hay hallazgos guardados en la base de datos.")
