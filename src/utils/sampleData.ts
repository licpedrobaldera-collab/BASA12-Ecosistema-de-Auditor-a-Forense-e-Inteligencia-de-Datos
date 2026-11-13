export const FORENSIC_TEMPLATES = [
  {
    id: 'adendas_50',
    titulo: 'Adendas contractuales >50% / Art. 31',
    origenes: ['Licitaciones Públicas', 'Contabilidad Central'],
    requerimiento:
      'Analizar adendas contractuales y órdenes de cambio que superen el umbral legal del monto adjudicado original. Identificar modificaciones sin resolución previa ni sustento técnico.',
  },
  {
    id: 'ciclo_pagos',
    titulo: 'Auditoría Integral de Ciclo de Pagos',
    origenes: ['Contabilidad Central', 'Bancos / Tesorería'],
    requerimiento:
      'Verificar la trazabilidad completa del ciclo de pagos: solicitud de compra, orden/contrato, recepción conforme, comprobante fiscal válido (e-CF), retenciones de ley y libramiento bancario neto.',
  },
  {
    id: 'fraccionamiento_pagos',
    titulo: 'Fraccionamiento y Pagos Consecutivos',
    origenes: ['Contabilidad Central', 'Licitaciones Públicas'],
    requerimiento:
      'Identificar desembolsos consecutivos o divididos a un mismo beneficiario en fechas cercanas que evadan procedimientos de licitación o concurso público.',
  },
  {
    id: 'benford_facturacion',
    titulo: 'Prueba de Ley de Benford sobre Desembolsos',
    origenes: ['Contabilidad Central', 'Bancos / Tesorería'],
    requerimiento:
      'Aplicar la prueba estadística de primer dígito (Ley de Benford) sobre todos los montos reales extraídos para detectar anomalías, redondeos artificiales o concentración anómala de dígitos.',
  },
];
