# Suite de Auditoría Forense & Control Interno NOBACI (CCRD)

Aplicación web full-stack de auditoría forense y supervisión técnica gubernamental bajo el marco de la **Cámara de Cuentas de la República Dominicana (Ley núm. 18-24)**, las **Normas Básicas de Control Interno (NOBACI / NOBIS — CGR)**, la **Ley núm. 41-08 (MAP)**, la **Ley núm. 340-06 (DGCP)** y la **Ley núm. 498-06 (MEPyD)**.

Esta versión de producción realiza **extracción abierta e ilimitada** de todos los hallazgos contenidos en los informes cargados, incorpora el **Buscador de Decretos Oficiales** en el Paso 4 mediante Google Search para verificar nombramientos y guardar sus URLs y fragmentos en la **Biblioteca Jurídica Virtual**, y especifica los **artículos y normas puntuales que aplican como Criterio (Lo que debe ser)** en orden jerárquico.

---

## Arquitectura Tecnológica

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS (`lucide-react`, `xlsx`).
- **Backend (`server.ts`):** Node.js + Express (`tsx`) sirviendo la API REST y montando Vite en desarrollo sobre el puerto `3000`.
- **Motor Analítico (`@google/genai`):** Extracción documental por bloques sin límite de hallazgos, evaluación técnica CGR/NOBACI y búsqueda web fundamentada con Google Search (`GEMINI_API_KEY` solo en servidor).
- **Persistencia Multiusuario:** Almacenamiento JSON por expediente con aislamiento de sesión (`sessionOwnerId`), historial de iteraciones y custodia criptográfica SHA-256 (`forensic_system_db/`).
- **Lectura Nativa Multiformato:** Ingesta de archivos reales `.pdf` (`unpdf`), `.docx` (`mammoth`), `.xlsx` / `.xls` / `.csv` (`xlsx`) y texto plano, sin datos simulados precargados.

---

## Módulos Integrados

1. **Gestión Multi-Entidad y Memoria Histórica de Casos**
   - Registro limpio de entidades reales y expedientes sin registros ficticios preinstalados.
   - Control de iteraciones, auditoría de acciones y aislamiento por sesión de usuario.

2. **Ingesta Documental y Cadena de Custodia SHA-256**
   - Carga simultánea de **Acta de Lectura**, **Informe Preliminar**, **Informe Final**, **Recursos**, **Réplicas** y **Contra-Réplicas** por período.
   - Visor interno de documentos sin abandonar el flujo de trabajo.

3. **Buscador de Decretos Oficiales (Paso 4) y Segregación de Directores**
   - Búsqueda en línea con **Google Search API** de decretos de nombramiento de directores asociados a la entidad auditada.
   - Guardado verídico de la **URL encontrada** y el **fragmento textual** directamente en la **Biblioteca Legal**, además de segregación de contratos, pagos y observaciones por período.

4. **Verificación Guía CCRD (Ley núm. 18-24) y Matriz Literal Ilimitada**
   - Extracción abierta de **todos los hallazgos** presentes en el informe (sin tope numérico fijo).
   - **Criterio (Lo que debe ser):** especificación editable de artículos, numerales y normas puntuales en estricto Orden Jerárquico (Constitución → Tratados/ISSAI/NIA → Leyes → Decretos → Resoluciones/NOBACI → Normativa Interna).
   - **Distribución Estadística de Riesgos** (`Alto (Crítico)`, `Medio (Moderado)`, `Bajo (Menor)`) y dictamen de blindaje `0–10`.
   - **Detector de Duplicidades** entre hallazgos, citas legales y pagos.

5. **Biblioteca Jurídica Virtual del Caso**
   - Indexación automática de las leyes, decretos, fuentes guardadas desde el Buscador de Decretos y el **Catálogo Normativo Oficial RD**.
   - Lector interno dentro de la aplicación con caché textual y soporte de URLs oficiales.

6. **Exportación Oficial para Supervisión y Control de Calidad**
   - **Excel (`.xlsx`):** matriz completa con nivel de riesgo, referencia exacta, criterio original del auditor, **Criterio (Lo que debe ser) — Artículos y Normas Puntuales**, evaluación `0–10`, duplicidades y ciclo de pagos.
   - **Informe Técnico del Supervisor (`.doc`):** documento ejecutivo limpio orientado a control de calidad.

---

## Instalación y Ejecución Local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Definir GEMINI_API_KEY en .env

# 3. Iniciar en modo desarrollo (Express + Vite en puerto 3000)
npm run dev

# 4. Verificar tipos TypeScript y compilar para producción
npm run lint
npm run build

# 5. Ejecutar compilado en producción
npm start
```
