import React from 'react';
import { X, UserCheck, Globe, Calendar, Check, Shield, Briefcase, FileText } from 'lucide-react';
import { AuditorProfile, AuditPeriodScope } from '../types/forensic';
import { PAISES_NORMATIVA } from '../utils/countryNorms';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  auditor: AuditorProfile;
  setAuditor: React.Dispatch<React.SetStateAction<AuditorProfile>>;
  periodo: AuditPeriodScope;
  setPeriodo: React.Dispatch<React.SetStateAction<AuditPeriodScope>>;
  selectedCountry: string;
  setSelectedCountry: (codigo: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  onSave: () => void;
}

export const UserProfileAndScopeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  auditor,
  setAuditor,
  periodo,
  setPeriodo,
  selectedCountry,
  setSelectedCountry,
  selectedLanguage,
  setSelectedLanguage,
  onSave,
}) => {
  if (!isOpen) return null;

  const currentCountryConfig = PAISES_NORMATIVA.find((p) => p.codigo === selectedCountry) || PAISES_NORMATIVA[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-3xl w-full text-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Datos del Auditor, Alcance del Período y Marco Normativo
              </h2>
              <p className="text-xs text-slate-400">
                Identificación pericial, jurisdicción aplicable y delimitación temporal del expediente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Section 1: Datos del Auditor */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-300 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-400" />
              1. Identificación del Auditor / Perito Forense
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={auditor.nombre}
                  onChange={(e) => setAuditor((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Lic. Pedro Baldera"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Cédula o ID Oficial / Pasaporte</label>
                <input
                  type="text"
                  value={auditor.cedulaId}
                  onChange={(e) => setAuditor((prev) => ({ ...prev, cedulaId: e.target.value }))}
                  placeholder="Ej: 001-1234567-8"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Cargo / Rol en la Auditoría</label>
                <input
                  type="text"
                  value={auditor.cargo}
                  onChange={(e) => setAuditor((prev) => ({ ...prev, cargo: e.target.value }))}
                  placeholder="Ej: Director Global de Auditoría Forense"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Entidad / Firma Auditora</label>
                <input
                  type="text"
                  value={auditor.entidad}
                  onChange={(e) => setAuditor((prev) => ({ ...prev, entidad: e.target.value }))}
                  placeholder="Ej: Big 4 Forensic & Dispute Services"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: País y Normativa Vigente */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              2. Jurisdicción y Marco Normativo Nacional / Internacional
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">País de Aplicación</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    const found = PAISES_NORMATIVA.find((p) => p.codigo === e.target.value);
                    if (found && found.idiomasDisponibles.length > 0) {
                      setSelectedLanguage(found.idiomasDisponibles[0]);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                >
                  {PAISES_NORMATIVA.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.bandera} {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Idioma del Dictamen e Informes</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                >
                  {currentCountryConfig.idiomasDisponibles.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Applicable Normative summary card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-[11px] space-y-1.5 text-slate-300">
              <div className="text-slate-400 font-medium">Leyes y Códigos vinculantes para el análisis:</div>
              <div>
                <strong className="text-sky-300">Contrataciones Públicas:</strong> {currentCountryConfig.leyContrataciones}
              </div>
              <div>
                <strong className="text-amber-300">Control Interno / Anticorrupción:</strong> {currentCountryConfig.leyControlInterno}
              </div>
              <div>
                <strong className="text-emerald-300">Órgano Fiscalizador:</strong> {currentCountryConfig.organoFiscalizador}
              </div>
              <div>
                <strong className="text-purple-300">Normas Técnicas:</strong> {currentCountryConfig.normasAuditoria}
              </div>
            </div>
          </div>

          {/* Section 3: Rango o Alcance del Período */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              3. Alcance Pericial y Rango del Período Auditado
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Fecha de Inicio (Desde)</label>
                <input
                  type="date"
                  value={periodo.fechaDesde}
                  onChange={(e) => setPeriodo((prev) => ({ ...prev, fechaDesde: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Fecha de Cierre (Hasta)</label>
                <input
                  type="date"
                  value={periodo.fechaHasta}
                  onChange={(e) => setPeriodo((prev) => ({ ...prev, fechaHasta: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 font-medium text-xs block mb-1">
                Descripción del Alcance Pericial
              </label>
              <textarea
                rows={2}
                value={periodo.alcancePericial}
                onChange={(e) => setPeriodo((prev) => ({ ...prev, alcancePericial: e.target.value }))}
                placeholder="Ej: Fiscalización integral de las adendas, pagos ejecutados y contratos de mantenimiento adjudicados durante el ejercicio 2024."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            Configuración guardada automáticamente en el expediente
          </span>

          <button
            type="button"
            onClick={() => {
              onSave();
              onClose();
            }}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-lg shadow-sky-950/40 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Guardar y Aplicar al Expediente
          </button>
        </div>
      </div>
    </div>
  );
};
