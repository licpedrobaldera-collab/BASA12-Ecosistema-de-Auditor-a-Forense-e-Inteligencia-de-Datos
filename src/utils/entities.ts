import { AuditedEntity, ContractEvidenceRow } from '../types/forensic';
import { SAMPLE_EDEESTE_SENASE_CONTRACTS } from './sampleData';

export const PRESET_ENTITIES: AuditedEntity[] = [
  {
    id: 'ent-edeeste',
    nombre: 'Empresa Distribuidora de Electricidad del Este (EDEESTE)',
    siglas: 'EDEESTE',
    rncNif: '1-01-82021-4',
    sector: 'Energía y Distribución Eléctrica',
    paisCodigo: 'DO',
    moneda: 'DOP',
    simboloMoneda: 'RD$',
    descripcion: 'Auditoría de contratos de mantenimiento, redes de media tensión y adendas de subestaciones.',
  },
  {
    id: 'ent-senasa',
    nombre: 'Seguro Nacional de Salud (SENASA)',
    siglas: 'SENASA',
    rncNif: '4-01-51707-2',
    sector: 'Salud Pública y Seguridad Social',
    paisCodigo: 'DO',
    moneda: 'DOP',
    simboloMoneda: 'RD$',
    descripcion: 'Fiscalización de contratos de telemetría, proveedores farmacéuticos y compras por excepción.',
  },
  {
    id: 'ent-mopc',
    nombre: 'Ministerio de Obras Públicas y Comunicaciones (MOPC)',
    siglas: 'MOPC',
    rncNif: '4-01-00737-1',
    sector: 'Infraestructura Vial y Obras Civiles',
    paisCodigo: 'DO',
    moneda: 'DOP',
    simboloMoneda: 'RD$',
    descripcion: 'Revisión pericial de cubicaciones, adendas viales >25% y sobreprecios en asfalto.',
  },
  {
    id: 'ent-banreservas',
    nombre: 'Banco de Reservas / Entidad Financiera Estatal',
    siglas: 'BANCO',
    rncNif: '4-01-01025-1',
    sector: 'Banca y Servicios Financieros',
    paisCodigo: 'DO',
    moneda: 'DOP',
    simboloMoneda: 'RD$',
    descripcion: 'Auditoría forense de desembolsos, licitaciones tecnológicas y prevención de lavado.',
  },
  {
    id: 'ent-alcaldia',
    nombre: 'Ayuntamiento Municipal / Gobierno Local',
    siglas: 'ALCALDÍA',
    rncNif: '4-01-00754-3',
    sector: 'Gobierno Municipal',
    paisCodigo: 'DO',
    moneda: 'DOP',
    simboloMoneda: 'RD$',
    descripcion: 'Fiscalización de recolección de residuos, nómina municipal y compras menores fraccionadas.',
  },
  {
    id: 'ent-intl-corp',
    nombre: 'Entidad Multilateral / Corporación Regional (USD)',
    siglas: 'CORP-INT',
    rncNif: 'TAX-94-3829102',
    sector: 'Corporativo / Multilateral',
    paisCodigo: 'INT',
    moneda: 'USD',
    simboloMoneda: 'US$',
    descripcion: 'Auditoría bajo estándares COSO, NIA 240 y directrices del Banco Mundial / BID.',
  },
];

export function formatCurrency(amount: number, simbolo: string = 'RD$'): string {
  return `${simbolo} ${Number(amount || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function getEntityPresetContracts(entity: AuditedEntity): ContractEvidenceRow[] {
  if (entity.id === 'ent-edeeste') {
    return SAMPLE_EDEESTE_SENASE_CONTRACTS;
  }
  if (entity.id === 'ent-senasa') {
    return [
      {
        id: 'SEN-001',
        contratoId: 'CT-SEN-2025-014',
        proveedor: 'MedSupply Dominicana S.R.L.',
        rnc: '130-88321-5',
        montoOriginal: 32000000,
        montoAdenda: 21500000,
        adendaPct: 67.19,
        fechaContrato: '2025-01-15',
        fechaAdenda: '2025-07-10',
        origen: 'Licitaciones Públicas',
        objeto: 'Suministro de medicamentos de alto costo y cadena de frío',
        esAnomalo: true,
        motivoAlerta: 'Adenda del 67.19% excede el límite de modificación de Ley 340-06',
      },
      {
        id: 'SEN-002',
        contratoId: 'CT-SEN-2025-039',
        proveedor: 'SaludTech Cloud Analytics S.A.',
        rnc: '131-77612-4',
        montoOriginal: 18400000,
        montoAdenda: 15300000,
        adendaPct: 83.15,
        fechaContrato: '2025-02-20',
        fechaAdenda: '2025-08-19',
        origen: 'Contabilidad Central',
        objeto: 'Plataforma de auditoría médica y control de autorizaciones',
        esAnomalo: true,
        motivoAlerta: 'Adenda crítica superior al 50% sin justificación técnica previa',
      },
      {
        id: 'SEN-003',
        contratoId: 'CT-SEN-2025-072',
        proveedor: 'Laboratorios Clínicos Integrados',
        rnc: '101-44510-8',
        montoOriginal: 14500000,
        montoAdenda: 2100000,
        adendaPct: 14.48,
        fechaContrato: '2025-03-11',
        fechaAdenda: '2025-06-30',
        origen: 'Bancos Dominicanos',
        objeto: 'Pruebas diagnósticas de atención primaria regional',
        esAnomalo: false,
        motivoAlerta: 'Dentro de rango normativo ordinario',
      },
    ];
  }
  if (entity.id === 'ent-mopc') {
    return [
      {
        id: 'MOPC-001',
        contratoId: 'CT-MOPC-2025-108',
        proveedor: 'Constructora Vial del Caribe S.A.',
        rnc: '101-99210-3',
        montoOriginal: 120000000,
        montoAdenda: 78000000,
        adendaPct: 65.0,
        fechaContrato: '2025-01-22',
        fechaAdenda: '2025-09-01',
        origen: 'Licitaciones Públicas',
        objeto: 'Rehabilitación carretera circunvalación tramo Norte (18 km)',
        esAnomalo: true,
        motivoAlerta: 'Incremento del 65% por variaciones de precios sin refrendo de Contraloría',
      },
      {
        id: 'MOPC-002',
        contratoId: 'CT-MOPC-2025-155',
        proveedor: 'Asfaltos y Agregados Nacionales',
        rnc: '130-22149-1',
        montoOriginal: 45000000,
        montoAdenda: 9500000,
        adendaPct: 21.11,
        fechaContrato: '2025-04-04',
        fechaAdenda: '2025-08-12',
        origen: 'Contabilidad Central',
        objeto: 'Bacheo preventivo de avenidas troncales',
        esAnomalo: false,
        motivoAlerta: 'Modificación dentro del 25% legal permitido',
      },
    ];
  }
  // For newly created or other entities, start clean or with 2 template rows so user can upload their own Excel/PDF/Word
  return [
    {
      id: `${entity.siglas}-001`,
      contratoId: `CT-${entity.siglas}-2026-001`,
      proveedor: 'Proveedor Principal de Servicios S.A.',
      rnc: '131-00412-9',
      montoOriginal: 15000000,
      montoAdenda: 9200000,
      adendaPct: 61.33,
      fechaContrato: '2026-01-10',
      fechaAdenda: '2026-06-15',
      origen: 'Contabilidad Central',
      objeto: `Contrato base de operaciones - ${entity.siglas}`,
      esAnomalo: true,
      motivoAlerta: 'Adenda supera el 50% (61.33%) - Requiere revisión documental',
    },
    {
      id: `${entity.siglas}-002`,
      contratoId: `CT-${entity.siglas}-2026-002`,
      proveedor: 'Suministros Corporativos Integrales',
      rnc: '101-77321-2',
      montoOriginal: 8400000,
      montoAdenda: 1200000,
      adendaPct: 14.29,
      fechaContrato: '2026-02-05',
      fechaAdenda: '2026-05-18',
      origen: 'Licitaciones Públicas',
      objeto: 'Adquisición de equipamiento y soporte técnico',
      esAnomalo: false,
      motivoAlerta: 'Parámetros contractuales regulares',
    },
  ];
}
