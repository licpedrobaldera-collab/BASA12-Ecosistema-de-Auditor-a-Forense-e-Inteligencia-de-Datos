import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Save,
  FilePlus2,
  Check,
  X,
  ArrowRightLeft,
  FolderCheck,
  Globe,
} from 'lucide-react';
import { AuditedEntity } from '../types/forensic';
import { PAISES_NORMATIVA } from '../utils/countryNorms';

interface Props {
  entities: AuditedEntity[];
  activeEntity: AuditedEntity;
  onSwitchEntity: (entity: AuditedEntity) => void;
  onCreateEntity: (entity: AuditedEntity) => Promise<void>;
  onRegisterCurrentCase: () => Promise<void>;
  onNewCase: () => void;
  isSavingCase: boolean;
  lastSavedMessage: string | null;
  activeCaseCode: string;
}

export const EntitySwitcherBar: React.FC<Props> = ({
  entities,
  activeEntity,
  onSwitchEntity,
  onCreateEntity,
  onRegisterCurrentCase,
  onNewCase,
  isSavingCase,
  lastSavedMessage,
  activeCaseCode,
}) => {
  const [showNewEntityModal, setShowNewEntityModal] = useState(false);
  const [nombre, setNombre] = useState('');
  const [siglas, setSiglas] = useState('');
  const [rncNif, setRncNif] = useState('');
  const [sector, setSector] = useState('Sector Público / Contrataciones');
  const [paisCodigo, setPaisCodigo] = useState('DO');
  const [moneda, setMoneda] = useState('DOP');
  const [simboloMoneda, setSimboloMoneda] = useState('RD$');
  const [descripcion, setDescripcion] = useState('');

  const handleCurrencyChange = (curr: string) => {
    setMoneda(curr);
    if (curr === 'DOP') setSimboloMoneda('RD$');
    else if (curr === 'USD') setSimboloMoneda('US$');
    else if (curr === 'EUR') setSimboloMoneda('€');
    else if (curr === 'MXN') setSimboloMoneda('MX$');
    else if (curr === 'COP') setSimboloMoneda('COP$');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    const cleanSiglas =
      siglas.trim().toUpperCase() ||
      nombre
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 8);

    const newEnt: AuditedEntity = {
      id: `ent-${Date.now()}`,
      nombre: nombre.trim(),
      siglas: cleanSiglas,
      rncNif: rncNif.trim() || 'N/D',
      sector,
      paisCodigo,
      moneda,
      simboloMoneda,
      descripcion: descripcion.trim() || `Auditoría forense integral de ${nombre.trim()}`,
      creadaEn: new Date().toISOString(),
    };

    await onCreateEntity(newEnt);
    setShowNewEntityModal(false);
    setNombre('');
    setSiglas('');
    setRncNif('');
    setDescripcion('');
  };

  return (
    <>
      <section className="bg-slate-900/95 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Left: Entity Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-sky-400 flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3" />
                  Entidad Auditada Activa
                </div>
                <div className="text-xs font-mono text-slate-400">
                  RNC/NIF: <strong className="text-slate-200">{activeEntity.rncNif}</strong> • {activeEntity.sector}
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-wrap items-center gap-2">
              <select
                value={activeEntity.id}
                onChange={(e) => {
                  const found = entities.find((ent) => ent.id === e.target.value);
                  if (found) onSwitchEntity(found);
                }}
                className="flex-1 min-w-[230px] bg-slate-950 border border-slate-700 hover:border-sky-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-sky-400 transition-colors cursor-pointer"
                aria-label="Cambiar Entidad Auditada"
              >
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.siglas} — {ent.nombre} ({ent.simboloMoneda})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowNewEntityModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva Entidad
              </button>
            </div>
          </div>

          {/* Right: Case Registration & New Case Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-800">
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
              <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeCaseCode}</span>
            </div>

            <button
              type="button"
              onClick={onNewCase}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Iniciar un nuevo caso limpio para la entidad activa"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-amber-400" />
              Nuevo Caso
            </button>

            <button
              type="button"
              onClick={onRegisterCurrentCase}
              disabled={isSavingCase}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingCase ? 'Registrando...' : 'Registrar y Guardar Caso'}
            </button>
          </div>
        </div>

        {/* Save confirmation or Entity quick info */}
        {lastSavedMessage && (
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Check className="w-4 h-4 text-emerald-400" />
              {lastSavedMessage}
            </span>
          </div>
        )}
      </section>

      {/* Modal: Register New Audited Entity */}
      {showNewEntityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full text-slate-100 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Registrar Nueva Entidad Auditada</h3>
                  <p className="text-[11px] text-slate-400">
                    Permite aislar y cambiar análisis forenses entre instituciones o empresas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewEntityModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Nombre Oficial de la Entidad *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Instituto Nacional de Aguas Potables (INAPA)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Siglas / Código</label>
                  <input
                    type="text"
                    value={siglas}
                    onChange={(e) => setSiglas(e.target.value)}
                    placeholder="Ej: INAPA"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">RNC / NIF / Tax ID</label>
                  <input
                    type="text"
                    value={rncNif}
                    onChange={(e) => setRncNif(e.target.value)}
                    placeholder="Ej: 4-01-00712-9"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Sector Económico</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option>Sector Público / Contrataciones</option>
                    <option>Energía y Distribución Eléctrica</option>
                    <option>Salud Pública y Seguridad Social</option>
                    <option>Infraestructura y Obras Públicas</option>
                    <option>Banca y Servicios Financieros</option>
                    <option>Gobierno Municipal / Local</option>
                    <option>Educación y Cultura</option>
                    <option>Corporativo Privado</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">País / Jurisdicción</label>
                  <select
                    value={paisCodigo}
                    onChange={(e) => setPaisCodigo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    {PAISES_NORMATIVA.map((p) => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.bandera} {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Moneda de Auditoría</label>
                <div className="grid grid-cols-5 gap-2">
                  {['DOP', 'USD', 'EUR', 'MXN', 'COP'].map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => handleCurrencyChange(curr)}
                      className={`py-1.5 rounded-lg border font-mono text-xs font-bold cursor-pointer transition-colors ${
                        moneda === curr
                          ? 'bg-sky-600 text-white border-sky-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Descripción / Alcance</label>
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Objetivo principal de la auditoría para esta entidad..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewEntityModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Crear y Cambiar a Entidad
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
