# Suite de Auditoría Forense CCRD & Control Interno NOBACI (Producción)

Aplicación web full-stack de auditoría forense y supervisión técnica gubernamental bajo el marco de la **Cámara de Cuentas de la República Dominicana (Ley núm. 18-24)**, las **Normas Básicas de Control Interno (NOBACI / NOBIS — CGR)**, la **Ley núm. 41-08 (MAP)**, la **Ley núm. 340-06 (DGCP)** y la **Ley núm. 498-06 (MEPyD)**.

Esta versión unificada para producción integra todas las capacidades de análisis literal documental, los **16 dominios estándar CCRD (3.1.01–3.8.01)**, la **Biblioteca Jurídica Virtual**, gráficos estadísticos de riesgo, segregación de responsabilidades por período y director mediante decretos oficiales en línea, control de duplicidades y exportación oficial en Excel y Word.

---

## Arquitectura Tecnológica

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS (`lucide-react`, `xlsx`).
- **Backend (`server.ts`):** Node.js + Express (`tsx`) sirviendo la API REST y montando Vite en desarrollo sobre el puerto `3000`.
- **Motor Analítico (`@google/genai`):** Análisis documental, extracción literal de acápites `3.01+`, evaluación técnica CGR/NOBACI y búsqueda de decretos oficiales únicamente desde el servidor (`GEMINI_API_KEY`).
- **Persistencia Multiusuario:** Almacenamiento JSON por expediente con aislamiento de sesión (`sessionOwnerId`), registro histórico de iteraciones y custodia criptográfica SHA-256 (`forensic_system_db/`).
- **Lectura Nativa Multiformato:** Ingesta de archivos reales `.pdf` (`unpdf`), `.docx` (`mammoth`), `.xlsx` / `.xls` / `.csv` (`xlsx`) y texto plano, sin datos simulados precargados.

---

## Módulos Integrados

1. **Gestión Multi-Entidad y Memoria Histórica de Casos**
   - Creación y reapertura de expedientes reales sin registros ficticios preinstalados.
   - Control de iteraciones, auditoría de acciones y aislamiento por sesión de usuario.

2. **Ingesta Documental y Cadena de Custodia SHA-256**
   - Carga simultánea de **Acta de Lectura**, **Informe Preliminar**, **Informe Final**, **Recursos**, **Réplicas** y **Contra-Réplicas** por período.
   - Visor interno de documentos y evidencia sin abandonar el flujo de trabajo.

3. **Ejecución Interactiva de Pruebas Sustantivas y Segregación de Directores**
   - **Buscador de Decretos Oficiales** en línea (con respaldo web verificable), guardando URL exacta, extracto y fuente oficial por período de gestión.
   - Segregación automática de responsabilidades por director, contrato y ciclo de pagos.

4. **Verificación Guía CCRD (Ley núm. 18-24) y Matriz Literal 3.01+ (16 Dominios)**
   - Extracción literal de hallazgos y acápites desde el contenido real del expediente (`3.1.01` a `3.8.01`).
   - Plantilla estructural limpia de los **16 dominios CCRD** (sin hallazgos simulados).
   - **Evaluador Técnico Senior CGR / NOBACI:** estructura *Condición*, *Criterio en orden jerárquico* (Constitución → Tratados/ISSAI/NIA → Leyes → Decretos → NOBACI/CGR → Normativa Interna), *Causa*, *Efecto* y *Plan de Acción Correctivo*.
   - **Distribución Estadística de Riesgos** (`Alto (Crítico)`, `Medio (Moderado)`, `Bajo (Menor)`) y dictamen de blindaje `0–10`.
   - **Detector de Duplicidades** entre hallazgos, citas legales y pagos.

5. **Biblioteca Jurídica Virtual del Caso**
   - Indexación automática de las leyes, decretos y normas citadas en el expediente.
   - **Catálogo Normativo Oficial RD** incorporable en un clic (Leyes `18-24`, `340-06`, `41-08`, `498-06`, `311-14`, `64-00`, Decretos `527-09` y `543-12`, y `NOBACI / NOBIS`).
   - Lector interno de normas dentro del sistema con caché textual y soporte de URLs oficiales.

6. **Exportación Oficial para Supervisión y Control de Calidad**
   - **Excel 3.01+ (`.xlsx`):** matriz completa con acápites, nivel de riesgo, referencia exacta, criterio original del auditor, criterio normativo 10/10, evaluación `0–10`, duplicidades y ciclo de pagos.
   - **Informe Técnico del Supervisor (`.doc`):** documento ejecutivo limpio orientado a revisión y control de calidad, con trazabilidad documental completa.

---

## Instalación y Ejecución Local

### Requisitos previos
- Node.js `>= 20`
- Clave de API de Google Gemini (`GEMINI_API_KEY`) configurada en las variables de entorno del servidor (`.env`).

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env y definir GEMINI_API_KEY=tu_clave_aqui

# 3. Iniciar en modo desarrollo (Express + Vite en puerto 3000)
npm run dev

# 4. Verificar tipos TypeScript y compilar para producción
npm run lint
npm run build

# 5. Ejecutar compilado en producción
npm start
```

---

## Política de Integridad Documental

- La aplicación inicia completamente limpia (sin entidades ni hallazgos ficticios precargados).
- Todas las extracciones, matrices y reportes operan estrictamente sobre los documentos reales cargados en cada caso.
