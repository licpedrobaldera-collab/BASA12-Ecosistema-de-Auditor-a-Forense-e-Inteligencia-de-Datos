import {
  ForensicAnalysisResult,
  AuditorProfile,
  AuditPeriodScope,
  ObservacionDecision,
  DossierSectionItem,
} from '../types/forensic';

export function downloadWordReport(data: {
  nombreCaso: string;
  origenes: string[];
  requerimiento: string;
  selloDigital: string;
  resultado: ForensicAnalysisResult;
  auditor?: AuditorProfile;
  periodo?: AuditPeriodScope;
  paisNormativa?: string;
  observaciones?: ObservacionDecision[];
  actaLectura?: DossierSectionItem;
  recursos?: DossierSectionItem[];
  replicas?: DossierSectionItem[];
}) {
  const {
    nombreCaso,
    origenes,
    requerimiento,
    selloDigital,
    resultado,
    auditor = {
      nombre: 'Lic. Pedro Baldera',
      cedulaId: '001-1234567-8',
      cargo: 'Director Global de Auditoría Forense',
      entidad: 'Big 4 Forensic Audit Services',
      pais: 'República Dominicana',
    },
    periodo = {
      fechaDesde: '2024-01-01',
      fechaHasta: '2024-12-31',
      alcancePericial: 'Auditoría integral de adendas, erogaciones y contratos',
    },
    paisNormativa = 'República Dominicana',
    observaciones = [],
    actaLectura,
    recursos = [],
    replicas = [],
  } = data;

  const fecha = new Date().toLocaleDateString('es-DO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const content = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>DICTAMEN TÉCNICO PERICIAL DE AUDITORÍA FORENSE DIGITAL</title>
  <style>
    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; }
    h1 { color: #0f172a; font-size: 18pt; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; }
    h2 { color: #0369a1; font-size: 13pt; margin-top: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    h3 { color: #334155; font-size: 11.5pt; margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 14px; }
    th { background-color: #0f172a; color: #ffffff; padding: 7px 9px; font-weight: bold; text-align: left; font-size: 9.5pt; }
    td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 9.5pt; }
    .badge-mantiene { background-color: #fee2e2; color: #991b1b; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
    .badge-elimina { background-color: #dcfce7; color: #166534; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
    .badge-modifica { background-color: #fef3c7; color: #92400e; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
    .code-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; font-family: 'Consolas', monospace; font-size: 9pt; color: #0f172a; white-space: pre-wrap; }
    .footer { margin-top: 40px; border-top: 1px solid #94a3b8; padding-top: 15px; font-size: 9pt; color: #64748b; }
    .stamp { font-family: monospace; background-color: #f1f5f9; padding: 3px 6px; border-radius: 3px; font-size: 8.5pt; color: #475569; }
    .signature-box { margin-top: 50px; border-top: 1px solid #334155; width: 320px; text-align: center; padding-top: 8px; font-size: 10pt; }
  </style>
</head>
<body>
  <h1>DICTAMEN TÉCNICO PERICIAL Y RESOLUCIÓN CONTRADICTORIA</h1>
  <p><strong>Fecha de Emisión:</strong> ${fecha}</p>
  <p><strong>Jurisdicción y Normativa Aplicable:</strong> ${paisNormativa}</p>
  
  <table>
    <tr>
      <th colspan="2">1. FICHA TÉCNICA DEL EXPEDIENTE Y AUDITOR ACTUANTE</th>
    </tr>
    <tr>
      <td width="30%"><strong>Caso Técnico:</strong></td>
      <td>${nombreCaso}</td>
    </tr>
    <tr>
      <td><strong>Auditor / Perito Responsable:</strong></td>
      <td><strong>${auditor.nombre}</strong> (ID/Cédula: ${auditor.cedulaId})</td>
    </tr>
    <tr>
      <td><strong>Cargo / Firma:</strong></td>
      <td>${auditor.cargo} - ${auditor.entidad}</td>
    </tr>
    <tr>
      <td><strong>Rango del Período Auditado:</strong></td>
      <td>Del ${periodo.fechaDesde} al ${periodo.fechaHasta}</td>
    </tr>
    <tr>
      <td><strong>Alcance Pericial:</strong></td>
      <td>${periodo.alcancePericial || 'Examen analítico forense de erogaciones y contratos.'}</td>
    </tr>
    <tr>
      <td><strong>Sello Criptográfico SHA-256:</strong></td>
      <td><span class="stamp">${selloDigital}</span></td>
    </tr>
  </table>

  <h2>2. Resumen Ejecutivo del Dictamen y Metodología R-C-T-F</h2>
  <p>${resultado.resumenEjecutivo || 'Se procedió con la evaluación forense de las observaciones, descargos de reconsideración y pruebas documentales aportadas.'}</p>
  <p><strong>Requerimiento Analítico Pericial:</strong> ${requerimiento}</p>

  <h2>3. Fases del Procedimiento Contradictorio y Carpetas del Dossier</h2>
  <p>De conformidad con las normas de debido proceso e igualdad de armas (NIA 240 / ISO 27037):</p>
  <ul>
    <li><strong>Acta de Lectura:</strong> ${actaLectura?.titulo || 'Acta de Apertura de Plazo Notificada'} (${actaLectura?.archivos.length || 0} archivo(s))</li>
    <li><strong>Recursos de Reconsideración:</strong> ${recursos.length} escrito(s) de reconsideración analizados.</li>
    <li><strong>Réplicas y Nuevas Pruebas:</strong> ${replicas.length} escrito(s) de réplica con pruebas sobrevenidas.</li>
  </ul>

  <h2>4. Resolución Pericial de Observaciones (Decisión Motivada)</h2>
  <table>
    <tr>
      <th width="12%">Código</th>
      <th width="28%">Observación &amp; Descargo</th>
      <th width="15%">Decisión</th>
      <th width="45%">Criterio Pericial y Fundamento Legal</th>
    </tr>
    ${observaciones
      .map(
        (o) => `
    <tr>
      <td style="font-family: monospace; font-weight: bold;">${o.codigoObservacion}</td>
      <td>
        <strong>${o.titulo}</strong><br/>
        <span style="font-size: 8.5pt; color: #475569;">Descargo: ${o.descargoAlegato.slice(0, 180)}...</span>
      </td>
      <td>
        <span class="${
          o.decision === 'SE_MANTIENE'
            ? 'badge-mantiene'
            : o.decision === 'SE_ELIMINA'
            ? 'badge-elimina'
            : 'badge-modifica'
        }">
          ${o.decision === 'SE_MANTIENE' ? 'SE MANTIENE' : o.decision === 'SE_ELIMINA' ? 'SE ELIMINA' : 'SE MODIFICA'}
        </span>
      </td>
      <td>
        <p style="margin: 0 0 4px 0;">${o.criterioEvaluacion}</p>
        <p style="margin: 0; font-size: 8.5pt; color: #0284c7;"><strong>Normativa:</strong> ${o.fundamentacionLegal}</p>
      </td>
    </tr>`
      )
      .join('')}
  </table>

  <h2>5. Algoritmo Forense Certificado (Python Pandas)</h2>
  <div class="code-box">${(resultado.codigoPython || '# Algoritmo pericial').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

  <h2>6. Acción Inmediata Recomendada</h2>
  <p><strong>${resultado.metricasRiesgo?.accionInmediata || 'Preservación de documentos originales y auditoría en sitio.'}</strong></p>

  <div class="signature-box">
    <strong>${auditor.nombre}</strong><br/>
    ID/Cédula: ${auditor.cedulaId}<br/>
    ${auditor.cargo}<br/>
    ${auditor.entidad}
  </div>

  <div class="footer">
    <p>Este informe pericial y sus anexos cumplen con los estándares de la norma ISO/IEC 27037 sobre adquisición de evidencia digital y normas NIA 240 / ISA 500. La integridad del expediente está respaldada mediante el sello SHA-256 indicado en el encabezado.</p>
  </div>
</body>
</html>
`;

  const blob = new Blob(['\ufeff' + content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dictamen_Pericial_${nombreCaso.replace(/\s+/g, '_')}_${Date.now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
