import io, re, hashlib, difflib, unicodedata
from pathlib import Path
from datetime import datetime
import pandas as pd
import streamlit as st

try:
    from docx import Document
except Exception:
    Document = None
try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

st.set_page_config(page_title="BASA HALLAZGOS INTELLIGENCE PRO", page_icon="🔎", layout="wide")
VERSION="1.0.0"
APP="BASA HALLAZGOS INTELLIGENCE PRO"

def norm(s):
    s="" if s is None else str(s)
    s=unicodedata.normalize("NFKD",s)
    s="".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+"," ",s.lower()).strip()

def sha(b): return hashlib.sha256(b).hexdigest()

def extract_docx(b):
    if Document is None: raise RuntimeError("Instale python-docx.")
    d=Document(io.BytesIO(b)); out=[]
    for i,p in enumerate(d.paragraphs,1):
        if p.text.strip(): out.append({"loc":f"Párrafo {i}","text":p.text.strip()})
    for ti,t in enumerate(d.tables,1):
        for ri,r in enumerate(t.rows,1):
            x=" | ".join(c.text.strip() for c in r.cells if c.text.strip())
            if x: out.append({"loc":f"Tabla {ti}, fila {ri}","text":x})
    return out

def extract_pdf(b):
    if PdfReader is None: raise RuntimeError("Instale pypdf.")
    r=PdfReader(io.BytesIO(b)); return [{"loc":f"Página {i}","text":p.extract_text() or ""} for i,p in enumerate(r.pages,1)]

def extract_excel(b):
    x=pd.ExcelFile(io.BytesIO(b)); out=[]
    for s in x.sheet_names:
        d=pd.read_excel(io.BytesIO(b),sheet_name=s,header=None)
        for i,row in d.iterrows():
            vals=[str(v).strip() for v in row if pd.notna(v) and str(v).strip()]
            if vals: out.append({"loc":f"Hoja {s}, fila {i+1}","text":" | ".join(vals)})
    return out

def extract(name,b):
    e=Path(name).suffix.lower()
    if e==".docx": return extract_docx(b)
    if e==".pdf": return extract_pdf(b)
    if e in (".xlsx",".xls"): return extract_excel(b)
    if e in (".txt",".csv",".md"):
        return [{"loc":f"Línea {i+1}","text":x} for i,x in enumerate(b.decode("utf8","ignore").splitlines()) if x.strip()]
    raise ValueError("Formato no soportado")

PAT=re.compile(r"^\s*(3\.\d{1,2}(?:\.\d{1,3})?)\s*[-–—:\.]?\s*(.+)$",re.I)

def detect(blocks):
    out=[]; seen=set()
    for b in blocks:
        for line in b["text"].splitlines():
            m=PAT.match(line.strip())
            if m and len(m.group(2).strip())>=8:
                k=(m.group(1),norm(m.group(2)),b["loc"])
                if k not in seen:
                    seen.add(k); out.append({"codigo":m.group(1),"titulo":m.group(2).strip(),"loc":b["loc"],"source":b["text"][:5000]})
    return out

def score(h):
    t=norm(h["source"]); title=h["titulo"]; s=0; notes=[]
    if len(title)>=20 or any(x in t for x in ["se evidencio","se verifico","se identifico","se observo"]): s+=2; notes.append("Condición")
    else: notes.append("Condición débil")
    if any(x in t for x in ["ley ","articulo","art.","reglamento","norma","politica","procedimiento","manual"]): s+=2; notes.append("Criterio")
    else: notes.append("Criterio no sustentado")
    if len(t)>350: s+=1
    if any(x in t for x in ["causa","debido","ausencia","deficiencia","falta de"]): s+=1; notes.append("Causa")
    if any(x in t for x in ["riesgo","impacto","consecuencia","puede generar","exposicion"]): s+=1; notes.append("Efecto/riesgo")
    if any(x in t for x in ["evidencia","expediente","registro","documento","acta","contrato","factura"]): s+=1; notes.append("Evidencia")
    if 20<=len(title)<=180: s+=1
    if any(x in t for x in ["recomend","implementar","establecer","fortalecer","corregir"]): s+=1; notes.append("Recomendación")
    level="DEFICIENTE" if s<=3 else "RECONSTRUIR" if s<=5 else "ACEPTABLE CON MEJORAS" if s<=7 else "BUENO" if s<=9 else "ÓPTIMO"
    return min(s,10),level,"; ".join(notes)

def analyze(hs,threshold):
    rows=[]
    for i,h in enumerate(hs):
        s,lev,comp=score(h); best=0; rel=""
        for j,o in enumerate(hs):
            if i==j: continue
            q=difflib.SequenceMatcher(None,norm(h["titulo"]),norm(o["titulo"])).ratio()
            if q>best: best=q; rel=o["codigo"]
        status="ELIMINAR/CONSOLIDAR — REVISIÓN PROFESIONAL" if best>=threshold else ("RECONSTRUIR" if s<=3 else "MEJORAR" if s<=7 else "CONSERVAR")
        improvements=[]
        t=norm(h["source"])
        if not any(x in t for x in ["ley ","articulo","reglamento","norma","procedimiento","manual"]): improvements.append("Incorporar y verificar el criterio normativo aplicable.")
        if not any(x in t for x in ["causa","debido","ausencia","deficiencia","falta de"]): improvements.append("Precisar la causa raíz.")
        if not any(x in t for x in ["riesgo","impacto","consecuencia","puede generar"]): improvements.append("Describir el efecto, impacto o riesgo.")
        if not any(x in t for x in ["evidencia","expediente","registro","documento","acta"]): improvements.append("Vincular evidencia verificable.")
        if not any(x in t for x in ["recomend","implementar","establecer","fortalecer","corregir"]): improvements.append("Agregar recomendación concreta y medible.")
        if not improvements: improvements=["Validar exactitud normativa, evidencia, causa, efecto y recomendación."]
        ten=(f'{h["codigo"]} {h["titulo"]}. Condición: documentar hechos, período, responsable y evidencia. '
             'Criterio: incorporar y verificar la disposición aplicable. Causa: determinar causa raíz. '
             'Efecto/Riesgo: describir impacto real o potencial. Evidencia: vincular documentos verificables. '
             'Recomendación: establecer acción correctiva concreta y medible.')
        rows.append({"Código":h["codigo"],"Hallazgo actual":h["titulo"],"Ubicación":h["loc"],"Estado recomendado":status,
                     "Puntaje 0-10":s,"Nivel":lev,"Duplicidad máxima":round(best,4),"Relacionado":rel,
                     "Justificación":f"Posible duplicidad con {rel} ({best:.0%})." if best>=threshold else "No se detectó duplicidad alta; requiere validación profesional.",
                     "Qué mejorar para 10/10":" ".join(improvements),"Versión propuesta 10/10":ten,"Texto fuente":h["source"],"Componentes":comp})
    return pd.DataFrame(rows)

def excel(df,meta):
    b=io.BytesIO()
    with pd.ExcelWriter(b,engine="xlsxwriter") as w:
        df.to_excel(w,index=False,sheet_name="Matriz Hallazgos")
        df.groupby("Estado recomendado").size().reset_index(name="Cantidad").to_excel(w,index=False,sheet_name="Resumen")
        pd.DataFrame([meta]).to_excel(w,index=False,sheet_name="Metodología")
        ws=w.sheets["Matriz Hallazgos"]; ws.freeze_panes(1,0); ws.autofilter(0,0,len(df),len(df.columns)-1)
        for i,c in enumerate(df.columns): ws.set_column(i,i,min(max(12,int(df[c].astype(str).map(len).max())+2),55))
    return b.getvalue()

def word(df,meta):
    if Document is None:return None
    d=Document(); d.add_heading(APP,0); d.add_paragraph(f'Fecha: {meta["fecha"]} | SHA-256: {meta["sha256"]}')
    d.add_heading("Resumen ejecutivo",1); d.add_paragraph(f'Procesados: {meta["archivos"]}. Hallazgos: {len(df)}. Promedio: {df["Puntaje 0-10"].mean():.2f}/10.')
    for _,r in df.iterrows():
        d.add_heading(f'{r["Código"]} — {r["Hallazgo actual"]}',2)
        for k in ["Estado recomendado","Puntaje 0-10","Nivel","Relacionado","Justificación","Qué mejorar para 10/10","Versión propuesta 10/10","Texto fuente"]:
            d.add_paragraph(f"{k}: {r[k]}")
    b=io.BytesIO(); d.save(b); return b.getvalue()

st.title("🔎 BASA HALLAZGOS INTELLIGENCE PRO")
st.caption(f"Versión {VERSION} · Procesamiento local · Lic. Pedro A. Baldera R.")
with st.sidebar:
    st.header("Configuración")
    threshold=st.slider("Umbral de duplicidad",0.70,0.95,0.82,0.01)
    st.warning("Eliminar/consolidar es una recomendación; la decisión final corresponde al profesional.")
files=st.file_uploader("Cargar informe(s)",type=["docx","pdf","xlsx","xls","csv","txt","md"],accept_multiple_files=True)
if files and st.button("🚀 Analizar documentos",type="primary"):
    blocks=[]; hashes=[]; errors=[]
    for f in files:
        b=f.getvalue(); hashes.append(f"{f.name}: {sha(b)}")
        try: blocks += extract(f.name,b)
        except Exception as e: errors.append(f"{f.name}: {e}")
    for e in errors: st.error(e)
    hs=detect(blocks)
    if not hs: st.error("No se detectaron hallazgos 3.x. Se admiten 3.01, 3.1.01, 3.2.03, 3.4.1, etc.")
    else:
        df=analyze(hs,threshold)
        meta={"fecha":datetime.now().strftime("%Y-%m-%d %H:%M:%S"),"archivos":"; ".join(f.name for f in files),
              "sha256":" | ".join(hashes),"umbral":threshold,"metodologia":"Heurística local 0-10 + similitud textual. Revisión profesional requerida."}
        st.session_state.df=df; st.session_state.meta=meta

if "df" in st.session_state:
    df=st.session_state.df; meta=st.session_state.meta
    a,b,c,d=st.columns(4); a.metric("Hallazgos",len(df)); b.metric("Promedio",f'{df["Puntaje 0-10"].mean():.2f}/10')
    c.metric("Duplicidades",int((df["Duplicidad máxima"]>=threshold).sum())); d.metric("Conservar",int((df["Estado recomendado"]=="CONSERVAR").sum()))
    st.dataframe(df[["Código","Hallazgo actual","Estado recomendado","Puntaje 0-10","Nivel","Duplicidad máxima","Relacionado","Justificación","Qué mejorar para 10/10"]],use_container_width=True,height=520)
    for _,r in df.iterrows():
        with st.expander(f'{r["Código"]} — {r["Hallazgo actual"]} | {r["Puntaje 0-10"]}/10'):
            st.write("**Estado:**",r["Estado recomendado"]); st.write("**Justificación:**",r["Justificación"])
            st.write("**Mejoras:**",r["Qué mejorar para 10/10"]); st.write("**Versión 10/10:**",r["Versión propuesta 10/10"])
            st.write("**Fuente:**",r["Ubicación"]); st.text_area("Texto fuente",r["Texto fuente"],height=160,key=str(r["Código"])+r["Ubicación"])
    x=excel(df,meta); csv=df.to_csv(index=False,encoding="utf-8-sig").encode("utf-8-sig"); w=word(df,meta)
    st.download_button("⬇️ Excel",x,"BASA_Matriz_Hallazgos_Analisis.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    st.download_button("⬇️ CSV",csv,"BASA_Matriz_Hallazgos_Analisis.csv","text/csv")
    if w: st.download_button("⬇️ Word",w,"BASA_Revision_Hallazgos_Analisis.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document")
