import { AuditedEntity } from '../types/forensic';

export function formatCurrency(amount: number, simbolo: string = 'RD$'): string {
  return `${simbolo} ${Number(amount || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function createBlankEntity(): AuditedEntity {
  return {
    id: `ent-${Date.now()}`,
    nombre: '',
    siglas: '',
    rncNif: '',
    sector: 'Sector Público / Contrataciones',
    paisCodigo: 'DO',
    moneda: 'DOP',
    simboloMoneda: 'RD$',
    descripcion: '',
    urlPortal: '',
    creadaEn: new Date().toISOString(),
  };
}
