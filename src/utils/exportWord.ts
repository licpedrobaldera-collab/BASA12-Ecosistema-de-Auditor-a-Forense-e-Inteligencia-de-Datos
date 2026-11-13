import {
  ForensicAnalysisResult,
  AuditorProfile,
  AuditPeriodScope,
  ObservacionDecision,
  DossierSectionItem,
  PaymentCycleRow,
  DirectorResponsibility,
} from '../types/forensic';
import { formatCurrency } from './entities';

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
  paymentCycleRows?: PaymentCycleRow[];
  simboloMoneda?: string;
  actaLectura?: DossierSectionItem;
  recursos?: DossierSectionItem[];
  replicas?: DossierSectionItem[];
  contraReplicas?: DossierSectionItem[];
  directors?: DirectorResponsibility[];
}) {
  const {
    nombreCaso,
    requerimiento,
    selloDigital,
    resultado,
    auditor = {
      nombre: 'Auditor Responsable',
      cedulaId: 'N/D',
      cargo: 'Auditor Forense',
      entidad: 'Unidad de Auditoría Forense',
      pais: 'República Dominicana',
    },
    periodo = {
      fechaDesde: '2025-01-01',
      fechaHasta: '2025-12-31',
      alcancePericial: 'Auditoría integral de contrataciones y ciclo de pagos.',
    },
    paisNormativa = 'República Dominicana',
    observaciones = [],
    paymentCycleRows = [],
    simboloMoneda = 'RD$',
    actaLectura,
    recursos = [],
    replicas = [],
    contraReplicas = [],
    directors = [],
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
      <td>${periodo.alcancePericial || 'Examen analítico forense.'}</td>
    </tr>
    <tr>
      <td><strong>Sello Criptográfico SHA-256:</strong></td>
      <td><span class="stamp">${selloDigital}</span></td>
    </tr>
  </table>

  <h2>2. Resumen Ejecutivo del Dictamen</h2>
  <p>${resultado.resumenEjecutivo || 'Evaluación forense basada en los datos reales suministrados.'}</p>
  <p><strong>Requerimiento Analítico Pericial:</strong> ${requerimiento}</p>

  ${
    resultado.mejorasControlInterno && resultado.mejorasControlInterno.length > 0
      ? `
  <h2>3. Mejoras de Control Interno y Procedimientos Recomendadas</h2>
  <ul>
    ${resultado.mejorasControlInterno.map((m) => `<li>${m}</li>`).join('')}
  </ul>`
      : ''
  }

  <h2>4. Fases del Procedimiento Contradictorio Multi-Período</h2>
  <ul>
    <li><strong>Acta de Lectura:</strong> ${actaLectura?.titulo || 'Sin acta registrada'} (${actaLectura?.archivos.length || 0} archivo(s))</li>
    <li><strong>Recursos de Reconsideración:</strong> ${recursos.length} escrito(s) analizados.</li>
    <li><strong>Réplicas y Descargos:</strong> ${replicas.length} escrito(s) por período y titular.</li>
    <li><strong>Contra-Réplicas Técnicas:</strong> ${contraReplicas.length} escrito(s) registrados.</li>
  </ul>

  ${
    directors.length > 0
      ? `
  <h2>4B. Segregación de Responsabilidad por Directores y Decretos Oficiales</h2>
  <table>
    <tr>
      <th>Director / Titular</th>
      <th>Decreto Oficial</th>
      <th>Período Gestión</th>
      <th>Fuentes y Ubicación de Origen</th>
    </tr>
    ${directors
      .map(
        (d) => `
    <tr>
      <td><strong>${d.nombre}</strong><br/><span style="font-size:8.5pt;">${d.cargo}</span></td>
      <td>${d.numeroDecretoNombramiento || 'Por verificar'}</td>
      <td>${d.fechaInicioGestion || 'N/D'} a ${d.enFuncionesActuales ? 'Actualidad' : d.fechaFinGestion || 'N/D'}</td>
      <td>${
        d.fuentes && d.fuentes.length > 0
          ? d.fuentes.map((f) => `${f.ubicacionOrigen}${f.url ? ` (${f.url})` : ''}`).join('<br/>')
          : 'Sin fuente web adjunta'
      }</td>
    </tr>`
      )
      .join('')}
  </table>`
      : ''
  }

  ${
    paymentCycleRows.length > 0
      ? `
  <h2>5. Trazabilidad del Ciclo de Pagos (${paymentCycleRows.length} desembolsos)</h2>
  <table>
    <tr>
      <th>Orden / Contrato</th>
      <th>Beneficiario</th>
      <th>e-CF / Libramiento</th>
      <th>Facturado</th>
      <th>Neto Pagado</th>
      <th>Estado</th>
    </tr>
    ${paymentCycleRows
      .map(
        (p) => `
    <tr>
      <td>${p.ordenNumero} / ${p.contratoId}</td>
      <td>${p.beneficiario}</td>
      <td>${p.numeroFacturaEcf || 'N/D'} • ${p.numeroLibramientoPago || 'N/D'}</td>
      <td>${formatCurrency(p.montoFacturado, simboloMoneda)}</td>
      <td>${formatCurrency(p.montoPagadoNeto, simboloMoneda)}</td>
      <td>${p.estadoCiclo}</td>
    </tr>`
      )
      .join('')}
  </table>`
      : ''
  }

  <h2>6. Resolución Pericial de Observaciones</h2>
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
        <span style="font-size: 8.5pt; color: #475569;">Descargo: ${(o.descargoAlegato || '').slice(0, 180)}</span>
      </td>
      <td>
        <span class="${
          o.decision === 'SE_MANTIENE'
            ? 'badge-mantiene'
            : o.decision === 'SE_ELIMINA'
            ? 'badge-elimina'
            : 'badge-modifica'
        }">
          ${o.decision}
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

  <h2>7. Algoritmo Forense Certificado (Python)</h2>
  <div class="code-box">${(resultado.codigoPython || '# Algoritmo pericial').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

  <h2>8. Acción Inmediata Recomendada</h2>
  <p><strong>${resultado.metricasRiesgo?.accionInmediata || 'Preservación de documentos originales.'}</strong></p>

  <div class="signature-box">
    <strong>${auditor.nombre}</strong><br/>
    ID/Cédula: ${auditor.cedulaId}<br/>
    ${auditor.cargo}<br/>
    ${auditor.entidad}
  </div>

  <div class="footer">
    <p>Informe conforme a ISO/IEC 27037 y NIA 240 / ISA 500. Sello SHA-256: ${selloDigital}</p>
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
