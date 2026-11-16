import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Loader2,
  Trash2,
  ExternalLink,
  Eye,
  AlertTriangle,
  Scale,
  Link2,
  Library,
} from 'lucide-react';
import {
  DirectorResponsibility,
  HallazgoMatrizLiteral,
  LegalReferenceItem,
  NormativeHierarchyLevel,
  ObservacionDecision,
} from '../types/forensic';
import { calculateStringSHA256 } from '../utils/crypto';

interface Props {
  paisNormativa: string;
  legalLibrary: LegalReferenceItem[];
  setLegalLibrary: React.Dispatch<React.SetStateAction<LegalReferenceItem[]>>;
  hallazgos: HallazgoMatrizLiteral[];
  observaciones: ObservacionDecision[];
  directors: DirectorResponsibility[];
  rawTextContext: string;
  onOpenViewer: (item: LegalReferenceItem) => void;
  onLogAction: (accion: string, detalle: string) => void;
}

const HIERARCHY_ORDER: Record<NormativeHierarchyLevel, { order: number; label: string; badge: string }> = {
  CONSTITUCION: { order: 1, label: '1. Constitución', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  TRATADOS_ISSAI_NIA: { order: 2, label: '2. Tratados / ISSAI / NIA', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  LEY: { order: 3, label: '3. Ley', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  DECRETO: { order: 4, label: '4. Decreto / Reglamento', badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  RESOLUCION_NOBACI: { order: 5, label: '5. Resolución / NOBACI / CGR', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  NORMATIVA_INTERNA: { order: 6, label: '6. Manual Interno', badge: 'bg-slate-700/50 text-slate-300 border-slate-600' },
};

const OFFICIAL_RD_CATALOG: Array<{
  numeroNorma: string;
  titulo: string;
  jerarquia: NormativeHierarchyLevel;
  articulosPuntuales: string[];
  hallazgosVinculados: string[];
  url: string;
  ubicacionFuente: string;
  resumenAplicacion: string;
  textoExtraido: string;
}> = [
  {
    numeroNorma: 'Ley núm. 18-24',
    titulo: 'Ley Orgánica de la Cámara de Cuentas de la República Dominicana (CCRD)',
    jerarquia: 'LEY',
    articulosPuntuales: ['Art. 10', 'Art. 25', 'Art. 38'],
    hallazgosVinculados: ['3.2.02', '3.8.01'],
    url: 'https://www.camaradecuentas.gob.do',
    ubicacionFuente: 'Cámara de Cuentas de la República Dominicana (CCRD)',
    resumenAplicacion: 'Marco rector de control externo, deber de información, lectura y descargos en auditoría gubernamental.',
    textoExtraido:
      'LEY NÚM. 18-24 — CÁMARA DE CUENTAS DE LA REPÚBLICA DOMINICANA\n\n• Art. 10: Facultades de control externo y fiscalización de recursos públicos, fondos y patrimonio estatal.\n• Art. 25: Obligación de los sujetos fiscalizados y titulares de suministrar informaciones, registros y documentos dentro de los plazos legales.\n• Art. 38: Procedimiento obligatorio para la comunicación de hallazgos preliminares, acta de lectura, evaluación de descargos y debido proceso.',
  },
  {
    numeroNorma: 'Ley núm. 340-06',
    titulo: 'Ley sobre Compras y Contrataciones de Bienes, Servicios, Obras y Concesiones',
    jerarquia: 'LEY',
    articulosPuntuales: ['Art. 32', 'Art. 33'],
    hallazgosVinculados: ['3.1.01', '3.1.02', '3.1.04', '3.4.01'],
    url: 'https://www.dgcp.gob.do',
    ubicacionFuente: 'Dirección General de Contrataciones Públicas (DGCP)',
    resumenAplicacion: 'Regula modalidades de selección según umbrales, publicación oportuna del PACC y garantías de fiel cumplimiento.',
    textoExtraido:
      'LEY NÚM. 340-06 Y SUS MODIFICACIONES (DGCP)\n\n• Art. 32: Umbrales y procedimientos de selección (Licitación Pública, Comparación de Precios, Sorteo de Obras, Compras Menores) y pluralidad de oferentes.\n• Art. 33: Obligación de elaboración, aprobación y publicación oportuna del Plan Anual de Compras y Contrataciones (PACC).',
  },
  {
    numeroNorma: 'Ley núm. 41-08',
    titulo: 'Ley de Función Pública y Creación de la Secretaría de Estado de Administración Pública (MAP)',
    jerarquia: 'LEY',
    articulosPuntuales: ['Art. 8 num. 12', 'Art. 50'],
    hallazgosVinculados: ['3.3.01', '3.3.02'],
    url: 'https://map.gob.do',
    ubicacionFuente: 'Ministerio de Administración Pública (MAP)',
    resumenAplicacion: 'Exige estructuras organizativas, manuales de cargos aprobados por el MAP y evaluaciones anuales de desempeño.',
    textoExtraido:
      'LEY NÚM. 41-08 DE FUNCIÓN PÚBLICA (MAP)\n\n• Art. 8, num. 12: Atribución técnica para evaluar y aprobar estructuras organizativas, manuales de procedimientos y clasificación de cargos públicos.\n• Art. 50: Obligatoriedad de aplicar sistemas objetivos y periódicos de evaluación de desempeño al personal administrativo.',
  },
  {
    numeroNorma: 'Ley núm. 498-06',
    titulo: 'Ley de Planificación e Inversión Pública',
    jerarquia: 'LEY',
    articulosPuntuales: ['Art. 24', 'Art. 25 lit. d'],
    hallazgosVinculados: ['3.1.01'],
    url: 'https://mepyd.gob.do',
    ubicacionFuente: 'Ministerio de Economía, Planificación y Desarrollo (MEPyD)',
    resumenAplicacion: 'Ordena la formulación del Plan Estratégico Institucional (PEI) y su vinculación con planes operativos y compras.',
    textoExtraido:
      'LEY NÚM. 498-06 DE PLANIFICACIÓN E INVERSIÓN PÚBLICA\n\n• Art. 24: Marco institucional de elaboración de los Planes Estratégicos Institucionales (PEI) alineados al Plan Nacional Plurianual.\n• Art. 25, literal d): Responsabilidad de las unidades de planificación en monitorear metas e indicadores de ejecución.',
  },
  {
    numeroNorma: 'Ley núm. 311-14',
    titulo: 'Ley sobre Declaración Jurada de Patrimonio',
    jerarquia: 'LEY',
    articulosPuntuales: ['Art. 1', 'Art. 2', 'Art. 5'],
    hallazgosVinculados: ['3.3.01'],
    url: 'https://www.camaradecuentas.gob.do',
    ubicacionFuente: 'Cámara de Cuentas — OAI / Declaración Jurada',
    resumenAplicacion: 'Obliga a funcionarios designados a presentar declaración jurada al asumir y cesar en funciones.',
    textoExtraido:
      'LEY NÚM. 311-14 SOBRE DECLARACIÓN JURADA DE PATRIMONIO\n\n• Establece el plazo perentorio de 30 días calendario tras la toma de posesión o cese de funciones para depositar ante la CCRD la declaración jurada debidamente notariada.',
  },
  {
    numeroNorma: 'Ley núm. 64-00',
    titulo: 'Ley General sobre Medio Ambiente y Recursos Naturales',
    jerarquia: 'LEY',
    articulosPuntuales: ['Art. 40', 'Art. 41'],
    hallazgosVinculados: ['3.7.01'],
    url: 'https://ambiente.gob.do',
    ubicacionFuente: 'Ministerio de Medio Ambiente y Recursos Naturales',
    resumenAplicacion: 'Establece permisos ambientales obligatorios y gestión controlada de residuos institucionales u hospitalarios.',
    textoExtraido:
      'LEY NÚM. 64-00 GENERAL DE MEDIO AMBIENTE\n\n• Regula los permisos ambientales vigentes, evaluaciones de impacto y manifiestos de disposición de desechos peligrosos o sanitarios.',
  },
  {
    numeroNorma: 'Decreto núm. 527-09',
    titulo: 'Reglamento de Estructura Organizativa, Cargos y Política Salarial (Ley 41-08)',
    jerarquia: 'DECRETO',
    articulosPuntuales: ['Art. 3'],
    hallazgosVinculados: ['3.3.01', '3.3.02'],
    url: 'https://map.gob.do',
    ubicacionFuente: 'Consultoría Jurídica del Poder Ejecutivo / MAP',
    resumenAplicacion: 'Define aprobación formal de organigramas, manuales de organización y descripción de puestos.',
    textoExtraido:
      'DECRETO NÚM. 527-09 — REGLAMENTO DE ESTRUCTURA ORGANIZATIVA\n\n• Art. 3: Toda modificación de estructura organizativa, creación de unidades o manual de cargos en entidades estatales requiere validación previa del MAP.',
  },
  {
    numeroNorma: 'Decreto núm. 543-12 / 416-23',
    titulo: 'Reglamento de Aplicación de la Ley 340-06 sobre Compras y Contrataciones',
    jerarquia: 'DECRETO',
    articulosPuntuales: ['Art. 31'],
    hallazgosVinculados: ['3.1.01', '3.1.02', '3.4.01'],
    url: 'https://www.dgcp.gob.do',
    ubicacionFuente: 'Dirección General de Contrataciones Públicas (DGCP)',
    resumenAplicacion: 'Regula la planificación de necesidades del PACC, plazos de publicación y custodia de pólizas de fiel cumplimiento.',
    textoExtraido:
      'DECRETO NÚM. 543-12 (Y REGLAMENTO 416-23)\n\n• Art. 31: Procedimiento y plazos anuales de elaboración, actualización y publicación del Plan Anual de Compras y Contrataciones (PACC) vinculado al presupuesto.',
  },
  {
    numeroNorma: 'Normas NOBACI / NOBIS (CGR)',
    titulo: 'Normas Básicas de Control Interno del Sector Público Dominicano',
    jerarquia: 'RESOLUCION_NOBACI',
    articulosPuntuales: [
      'Ambiente de Control',
      'Activos Fijos',
      'ADC-3-006 (num. 4, 20, 33, 86)',
      'ADC-03-004.19 (Compras)',
      'ADC-3-001.3 (Inventarios)',
    ],
    hallazgosVinculados: ['3.1.03', '3.2.01', '3.5.02'],
    url: 'https://www.contraloria.gob.do',
    ubicacionFuente: 'Contraloría General de la República (CGR)',
    resumenAplicacion: 'Estándar técnico obligatorio de control interno para RR. HH., compras, almacén, activos fijos, tesorería y accesos ERP.',
    textoExtraido:
      'NORMAS BÁSICAS DE CONTROL INTERNO (NOBACI / NOBIS) — CGR\n\n• Ambiente de Control: Integridad, valores éticos, estructura organizativa y segregación de funciones.\n• Activos Fijos: Registro físico, etiquetado, codificación, salvaguarda y descargos patrimoniales.\n• ADC-3-006 (num. 4, 20, 33 y 86): Controles internos de Recursos Humanos, expedientes y evaluaciones.\n• ADC-03-004.19: Controles de Compras, recepciones y autorizaciones.\n• ADC-3-001.3: Control de Inventarios, entradas/salidas de almacén y conciliaciones.',
  },
];

export const LegalLibrarySection: React.FC<Props> = ({
  paisNormativa,
  legalLibrary,
  setLegalLibrary,
  hallazgos,
  observaciones,
  directors,
  rawTextContext,
  onOpenViewer,
  onLogAction,
}) => {
  const [building, setBuilding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newNorma, setNewNorma] = useState('');
  const [newTitulo, setNewTitulo] = useState('');
  const [newJerarquia, setNewJerarquia] = useState<NormativeHierarchyLevel>('LEY');
  const [newArticulos, setNewArticulos] = useState('');
  const [newHallazgos, setNewHallazgos] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newUbicacion, setNewUbicacion] = useState('');

  const handleLoadOfficialCatalog = async () => {
    const now = new Date().toISOString();
    const existingKeys = new Set(
      legalLibrary.map((l) => l.numeroNorma.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );

    const newItems: LegalReferenceItem[] = [];
    for (let i = 0; i < OFFICIAL_RD_CATALOG.length; i++) {
      const entry = OFFICIAL_RD_CATALOG[i];
      const key = entry.numeroNorma.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (existingKeys.has(key)) continue;
      const sha256 = await calculateStringSHA256(`${entry.numeroNorma}_${entry.textoExtraido}`);
      newItems.push({
        id: `law-cat-${Date.now()}-${i}`,
        numeroNorma: entry.numeroNorma,
        titulo: entry.titulo,
        jerarquia: entry.jerarquia,
        jerarquiaOrden: HIERARCHY_ORDER[entry.jerarquia]?.order || 3,
        articulosPuntuales: entry.articulosPuntuales,
        hallazgosVinculados: entry.hallazgosVinculados,
        url: entry.url,
        ubicacionFuente: entry.ubicacionFuente,
        resumenAplicacion: entry.resumenAplicacion,
        textoExtraido: entry.textoExtraido,
        esDuplicado: false,
        detalleDuplicidad: '',
        sha256,
        fechaRegistro: now,
      });
    }

    if (newItems.length > 0) {
      setLegalLibrary((prev) => [...prev, ...newItems].sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden));
      onLogAction(
        'Carga Catálogo Normativo Oficial RD',
        `Se incorporaron ${newItems.length} cuerpos legales y normas NOBACI/CCRD de referencia oficial.`
      );
    }
  };

  const handleBuildLibrary = async () => {
    setBuilding(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/forensic/build-legal-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paisNormativa,
          hallazgos,
          observaciones,
          directors,
          rawText: rawTextContext,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'No se pudo indexar la Biblioteca Legal.');
      }

      const incoming: LegalReferenceItem[] = Array.isArray(data.library) ? data.library : [];
      setLegalLibrary((prev) => {
        // Merge manual/cached entries that aren't already in incoming by normalized key
        const incomingKeys = new Set(
          incoming.map((x) => x.numeroNorma.toLowerCase().replace(/[^a-z0-9]/g, ''))
        );
        const preserved = prev.filter(
          (p) => !incomingKeys.has(p.numeroNorma.toLowerCase().replace(/[^a-z0-9]/g, ''))
        );
        return [...incoming, ...preserved].sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden);
      });

      onLogAction(
        'Indexación Biblioteca Legal del Caso',
        `Se vincularon ${incoming.length} norma(s), leyes y decretos en orden jerárquico.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Error indexando citas normativas.');
    } finally {
      setBuilding(false);
    }
  };

  const handleAddManualLaw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNorma.trim()) return;
    const now = new Date().toISOString();
    const order = HIERARCHY_ORDER[newJerarquia].order;
    const sha256 = await calculateStringSHA256(`${newNorma}_${newUrl}_${now}`);
    const normKey = newNorma.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isDup = legalLibrary.some(
      (l) => l.numeroNorma.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey
    );

    const item: LegalReferenceItem = {
      id: `law-man-${Date.now()}`,
      numeroNorma: newNorma.trim(),
      titulo: newTitulo.trim() || newNorma.trim(),
      jerarquia: newJerarquia,
      jerarquiaOrden: order,
      articulosPuntuales: newArticulos
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      hallazgosVinculados: newHallazgos
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      url: newUrl.trim(),
      ubicacionFuente: newUbicacion.trim() || (newUrl.trim() ? 'Portal Oficial Web' : 'Registro Manual en Expediente'),
      resumenAplicacion: 'Referencia normativa vinculada manualmente al caso.',
      esDuplicado: isDup,
      detalleDuplicidad: isDup ? 'Ya existe una ficha normativa equivalente en el caso.' : '',
      sha256,
      fechaRegistro: now,
    };

    setLegalLibrary((prev) => [...prev, item].sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden));
    onLogAction('Alta Manual en Biblioteca Legal', `Norma agregada: ${item.numeroNorma}`);
    setNewNorma('');
    setNewTitulo('');
    setNewArticulos('');
    setNewHallazgos('');
    setNewUrl('');
    setNewUbicacion('');
    setShowAddForm(false);
  };

  const handleDeleteLaw = (id: string) => {
    setLegalLibrary((prev) => prev.filter((l) => l.id !== id));
  };

  const filtered = legalLibrary
    .filter((l) => {
      if (!filterText.trim()) return true;
      const q = filterText.toLowerCase();
      return (
        l.numeroNorma.toLowerCase().includes(q) ||
        l.titulo.toLowerCase().includes(q) ||
        l.articulosPuntuales.join(' ').toLowerCase().includes(q) ||
        l.hallazgosVinculados.join(' ').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden);

  const dupCount = legalLibrary.filter((l) => l.esDuplicado).length;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Biblioteca Jurídica Virtual del Caso (Leyes, Decretos y Reglamentos)
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                Visor Interno Sin Salir
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Indexa en orden jerárquico todas las leyes, decretos y normas citadas en el expediente y permite leerlas en línea dentro del sistema sin perder su trabajo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleLoadOfficialCatalog}
            className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Incorpora el Catálogo Normativo Oficial RD (Leyes 18-24, 340-06, 41-08, 498-06, 311-14, 64-00, Decretos y NOBACI) con texto articulado de referencia"
          >
            <Library className="w-3.5 h-3.5 text-emerald-400" />
            Catálogo Normativo RD
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            Añadir Norma / URL
          </button>
          <button
            type="button"
            onClick={handleBuildLibrary}
            disabled={building}
            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            {building ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {building ? 'Indexando Normas...' : 'Buscar y Vincular Normas Citadas'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-3 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Manual Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddManualLaw}
          className="bg-slate-950 border border-sky-500/40 rounded-xl p-4 space-y-3 text-xs"
        >
          <div className="font-bold text-sky-300 flex items-center gap-1.5">
            <Scale className="w-4 h-4" /> Registrar Ley, Decreto o Reglamento en la Biblioteca del Caso
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Número / Identificador de Norma *</label>
              <input
                type="text"
                required
                value={newNorma}
                onChange={(e) => setNewNorma(e.target.value)}
                placeholder="Ej: Ley núm. 41-08 / Decreto 527-09"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Jerarquía Normativa *</label>
              <select
                value={newJerarquia}
                onChange={(e) => setNewJerarquia(e.target.value as NormativeHierarchyLevel)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              >
                {Object.entries(HIERARCHY_ORDER).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Título Oficial</label>
              <input
                type="text"
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                placeholder="Ej: Ley de Función Pública"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Artículos Puntuales (separados por coma)</label>
              <input
                type="text"
                value={newArticulos}
                onChange={(e) => setNewArticulos(e.target.value)}
                placeholder="Art. 8 num. 12, Art. 24"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Hallazgos Vinculados (separados por coma)</label>
              <input
                type="text"
                value={newHallazgos}
                onChange={(e) => setNewHallazgos(e.target.value)}
                placeholder="3.01, 3.02"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">URL Fuente Oficial (Opcional)</label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://consultoria.gov.do/..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sky-300 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <input
              type="text"
              value={newUbicacion}
              onChange={(e) => setNewUbicacion(e.target.value)}
              placeholder="Ubicación u Órgano Emisor (Consultoría Jurídica, CGR, MAP, DGCP...)"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold cursor-pointer"
            >
              Guardar en Biblioteca
            </button>
          </div>
        </form>
      )}

      {/* Search Bar & Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrar por ley, decreto, artículo o código de hallazgo (ej. 3.01)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-sky-300">
            Normas Indexadas: {legalLibrary.length}
          </span>
          {dupCount > 0 && (
            <span className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
              Citas Duplicadas: {dupCount}
            </span>
          )}
        </div>
      </div>

      {/* Library Grid */}
      {filtered.length === 0 ? (
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
          {legalLibrary.length === 0
            ? 'No hay normas indexadas todavía. Haga clic en "Buscar y Vincular Normas Citadas" para detectar automáticamente cada Ley, Decreto, Reglamento o Norma NOBACI citada en su expediente.'
            : 'No hay normas que coincidan con el filtro de búsqueda.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((item) => {
            const hMeta = HIERARCHY_ORDER[item.jerarquia] || HIERARCHY_ORDER.LEY;
            return (
              <div
                key={item.id}
                className={`bg-slate-950/90 border rounded-xl p-4 space-y-2.5 text-xs transition-colors ${
                  item.esDuplicado ? 'border-amber-500/50' : 'border-slate-800 hover:border-sky-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${hMeta.badge}`}>
                        {hMeta.label}
                      </span>
                      {item.esDuplicado && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Cita Repetida
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-white text-sm">{item.numeroNorma}</div>
                    {item.titulo !== item.numeroNorma && (
                      <div className="text-[11px] text-slate-300">{item.titulo}</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteLaw(item.id)}
                    className="text-slate-500 hover:text-red-400 p-1 rounded cursor-pointer"
                    title="Eliminar norma"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Articles & Linked Findings */}
                <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                  {item.articulosPuntuales.map((art, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300 font-medium"
                    >
                      {art}
                    </span>
                  ))}
                  {item.hallazgosVinculados.map((hId) => (
                    <span
                      key={hId}
                      className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold"
                    >
                      Hallazgo {hId}
                    </span>
                  ))}
                </div>

                {item.resumenAplicacion && (
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                    {item.resumenAplicacion}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[10.5px] text-slate-400 flex items-center gap-1 truncate max-w-[230px]">
                    <Link2 className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">{item.ubicacionFuente}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-[10.5px] flex items-center gap-1"
                        title="Abrir en nueva pestaña"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenViewer(item)}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Leer Ley en Línea (Sin Salir)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
