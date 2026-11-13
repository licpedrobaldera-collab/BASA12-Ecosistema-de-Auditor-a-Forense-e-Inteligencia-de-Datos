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
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  Globe,
} from 'lucide-react';
import { AuditedEntity } from '../types/forensic';
import { PAISES_NORMATIVA } from '../utils/countryNorms';

interface Props {
  entities: AuditedEntity[];
  activeEntity: AuditedEntity | null;
  onSwitchEntity: (entity: AuditedEntity) => void;
  onSaveEntity: (entity: AuditedEntity, isNew: boolean) => Promise<void>;
  onDeleteEntity: (entityId: string) => Promise<void>;
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
  onSaveEntity,
  onDeleteEntity,
  onRegisterCurrentCase,
  onNewCase,
  isSavingCase,
  lastSavedMessage,
  activeCaseCode,
}) => {
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [nombre, setNombre] = useState('');
  const [siglas, setSiglas] = useState('');
  const [rncNif, setRncNif] = useState('');
  const [sector, setSector] = useState('Sector Público / Contrataciones');
  const [paisCodigo, setPaisCodigo] = useState('DO');
  const [moneda, setMoneda] = useState('DOP');
  const [simboloMoneda, setSimboloMoneda] = useState('RD$');
  const [urlPortal, setUrlPortal] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [isExtractingEntity, setIsExtractingEntity] = useState(false);

  const openCreateModal = () => {
    setNombre('');
    setSiglas('');
    setRncNif('');
    setSector('Sector Público / Contrataciones');
    setPaisCodigo('DO');
    setMoneda('DOP');
    setSimboloMoneda('RD$');
    setUrlPortal('');
    setDescripcion('');
    setModalMode('create');
  };

  const openEditModal = () => {
    if (!activeEntity) return;
    setNombre(activeEntity.nombre);
    setSiglas(activeEntity.siglas);
    setRncNif(activeEntity.rncNif);
    setSector(activeEntity.sector);
    setPaisCodigo(activeEntity.paisCodigo);
    setMoneda(activeEntity.moneda);
    setSimboloMoneda(activeEntity.simboloMoneda);
    setUrlPortal(activeEntity.urlPortal || '');
    setDescripcion(activeEntity.descripcion || '');
    setModalMode('edit');
  };

  const handleCurrencyChange = (curr: string) => {
    setMoneda(curr);
    if (curr === 'DOP') setSimboloMoneda('RD$');
    else if (curr === 'USD') setSimboloMoneda('US$');
    else if (curr === 'EUR') setSimboloMoneda('€');
    else if (curr === 'MXN') setSimboloMoneda('MX$');
    else if (curr === 'COP') setSimboloMoneda('COP$');
  };

  const autoExtractEntityFromDescription = async () => {
    if (!descripcion.trim()) return;
    setIsExtractingEntity(true);
    try {
      const resp = await fetch('/api/forensic/extract-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: descripcion, entityName: nombre }),
      });
      const data = await resp.json();
      if (data.success && data.entidadDetectada) {
        if (data.entidadDetectada.nombre && !nombre) setNombre(data.entidadDetectada.nombre);
        if (data.entidadDetectada.rncNif && !rncNif) setRncNif(data.entidadDetectada.rncNif);
      }
    } catch {}
    setIsExtractingEntity(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    const payload: AuditedEntity = {
      id: modalMode === 'edit' && activeEntity ? activeEntity.id : `ent-${Date.now()}`,
      nombre: nombre.trim(),
      siglas: cleanSiglas,
      rncNif: rncNif.trim() || 'N/D',
      sector,
      paisCodigo,
      moneda,
      simboloMoneda,
      urlPortal: urlPortal.trim(),
      descripcion: descripcion.trim(),
      creadaEn: modalMode === 'edit' && activeEntity ? activeEntity.creadaEn : new Date().toISOString(),
    };

    await onSaveEntity(payload, modalMode === 'create');
    setModalMode(null);
  };

  return (
    <>
      <section className="bg-slate-900/95 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Left: Entity Selector / Registration */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-sky-400 flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3" />
                  Entidad en Análisis (Exclusiva)
                </div>
                {activeEntity ? (
                  <div className="text-xs font-mono text-slate-400">
                    RNC/NIF: <strong className="text-slate-200">{activeEntity.rncNif}</strong> • {activeEntity.moneda} (
                    {activeEntity.simboloMoneda})
                  </div>
                ) : (
                  <div className="text-xs text-amber-300 font-medium">
                    Sin entidad registrada — Crea tu entidad real para comenzar
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-wrap items-center gap-2">
              {entities.length > 0 ? (
                <select
                  value={activeEntity?.id || ''}
                  onChange={(e) => {
                    const found = entities.find((ent) => ent.id === e.target.value);
                    if (found) onSwitchEntity(found);
                  }}
                  className="flex-1 min-w-[210px] bg-slate-950 border border-slate-700 hover:border-sky-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-sky-400 transition-colors cursor-pointer"
                  aria-label="Seleccionar Entidad Auditada"
                >
                  {entities.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.siglas} — {ent.nombre} ({ent.simboloMoneda})
                    </option>
                  ))}
                </select>
              ) : null}

              <button
                type="button"
                onClick={openCreateModal}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Entidad Real
              </button>

              {activeEntity && (
                <>
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="Editar cualquier campo de la entidad actual"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar Entidad
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteEntity(activeEntity.id)}
                    className="p-2 bg-slate-800 hover:bg-red-950/70 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-700 rounded-xl cursor-pointer transition-colors"
                    title="Eliminar entidad y sus casos"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: Case Registration & New Case */}
          {activeEntity && (
            <div className="flex flex-wrap items-center gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-800">
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{activeCaseCode}</span>
              </div>

              <button
                type="button"
                onClick={onNewCase}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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
                {isSavingCase ? 'Guardando...' : 'Guardar Caso'}
              </button>
            </div>
          )}
        </div>

        {lastSavedMessage && (
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Check className="w-4 h-4 text-emerald-400" />
              {lastSavedMessage}
            </span>
          </div>
        )}
      </section>

      {/* Modal: Create or Edit Audited Entity */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full text-slate-100 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {modalMode === 'edit' ? 'Editar Entidad Auditada' : 'Registrar Nueva Entidad Real'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Todos los campos son editables; los casos y análisis quedarán aislados exclusivamente para esta entidad
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Nombre Oficial de la Entidad o Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Instituto Nacional del Cáncer (INCART) o Empresa Real S.R.L."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Siglas / Código</label>
                  <input
                    type="text"
                    value={siglas}
                    onChange={(e) => setSiglas(e.target.value)}
                    placeholder="Ej: INCART"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">RNC / NIF / Tax ID</label>
                  <input
                    type="text"
                    value={rncNif}
                    onChange={(e) => setRncNif(e.target.value)}
                    placeholder="Ej: 430130712"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Sector Económico</label>
                  <input
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="Ej: Salud Pública / Contrataciones"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
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
                <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  Link / Portal Oficial de Transparencia de la Entidad (Opcional)
                </label>
                <input
                  type="text"
                  value={urlPortal}
                  onChange={(e) => setUrlPortal(e.target.value)}
                  placeholder="https://portal.comprasdominicana.gob.do/... o sitio institucional"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                />
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    Antecedentes, Objetivos, Alcance y Base Legal de la Entidad
                  </label>
                  {descripcion.trim().length > 20 && (
                    <button
                      type="button"
                      onClick={autoExtractEntityFromDescription}
                      disabled={isExtractingEntity}
                      className="text-[10.5px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      {isExtractingEntity ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Autodetectar Nombre/RNC con IA
                    </button>
                  )}
                </div>
                <textarea
                  rows={5}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Pegue aquí antecedentes, oficio, base legal, objetivos o alcance real de la entidad..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-sky-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {modalMode === 'edit' ? 'Guardar Cambios de Entidad' : 'Registrar y Trabajar con Entidad'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
