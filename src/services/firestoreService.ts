import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, User } from '../firebase';
import {
  AuditedEntity,
  AuditorProfile,
  CaseIteration,
  CaseSession,
  DossierSectionItem,
  EvidenceFile,
  ProjectUploadRecord,
} from '../types/forensic';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function sanitizeDocId(raw: string, fallbackPrefix = 'doc'): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}-${Date.now()}`;
}

function isServerTimestampSentinel(val: unknown): boolean {
  return Boolean(
    val &&
      typeof val === 'object' &&
      ('_methodName' in (val as any) || 'isEqual' in (val as any)) &&
      !(val instanceof Timestamp)
  );
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) return null as unknown as T;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Timestamp || isServerTimestampSentinel(value)) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(value as Record<string, any>)) {
    if (v !== undefined) {
      result[k] = stripUndefinedDeep(v);
    }
  }
  return result as T;
}

function timestampToIso(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  return new Date().toISOString();
}

function timestampToMillis(val: any): number {
  if (!val) return 0;
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val === 'string') {
    const t = Date.parse(val);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

function trimDossierItem(item?: DossierSectionItem, defaultTitle = 'Documento'): Record<string, any> {
  const src = item || {
    id: `dos-${Date.now()}`,
    titulo: defaultTitle,
    contenido: '',
    fecha: new Date().toISOString().split('T')[0],
    sha256: '',
    archivos: [],
  };
  return stripUndefinedDeep({
    id: String(src.id || `dos-${Date.now()}`),
    numero: src.numero ?? 1,
    tipoEscrito: src.tipoEscrito || 'ACTA',
    titulo: String(src.titulo || defaultTitle).slice(0, 240),
    contenido: String(src.contenido || '').slice(0, 60000),
    fecha: String(src.fecha || ''),
    periodoEtiqueta: String(src.periodoEtiqueta || ''),
    fechaDesde: String(src.fechaDesde || ''),
    fechaHasta: String(src.fechaHasta || ''),
    directorId: String(src.directorId || ''),
    directorNombre: String(src.directorNombre || ''),
    fuenteOrigen: String(src.fuenteOrigen || ''),
    urlOrigen: String(src.urlOrigen || ''),
    sha256: String(src.sha256 || ''),
    archivos: (src.archivos || []).slice(0, 5).map((a) => ({
      name: String(a.name || '').slice(0, 200),
      size: Number(a.size) || 0,
      type: String(a.type || '').slice(0, 100),
      sha256: String(a.sha256 || ''),
      uploadDate: String(a.uploadDate || ''),
      parsedFormat: String(a.parsedFormat || ''),
    })),
  });
}

// ==================== USER PROFILE (PUBLIC + ISOLATED PRIVATE PII) ====================
export async function syncUserProfileToFirestore(user: User, auditor: AuditorProfile): Promise<void> {
  const uid = sanitizeDocId(user.uid, 'usr');
  const publicPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/profile`;

  const displayName = (auditor.nombre || user.displayName || user.email?.split('@')[0] || 'Auditor').slice(0, 160);
  const cargo = (auditor.cargo || 'Auditor Forense').slice(0, 120);
  const entidadProfesional = (auditor.entidad || 'Unidad de Auditoría Forense').slice(0, 200);

  try {
    const pubRef = doc(db, 'users', uid);
    const pubSnap = await getDoc(pubRef);
    if (!pubSnap.exists()) {
      await setDoc(pubRef, {
        uid,
        displayName,
        cargo,
        entidadProfesional,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(pubRef, {
        displayName,
        cargo,
        entidadProfesional,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  try {
    const privRef = doc(db, 'users', uid, 'private', 'profile');
    const privSnap = await getDoc(privRef);
    const email = (user.email || '').slice(0, 200);
    const cedulaId = (auditor.cedulaId || '').slice(0, 60);
    const colegiatura = (auditor.colegiatura || '').slice(0, 100);
    const pais = (auditor.pais || 'República Dominicana').slice(0, 80);

    if (!privSnap.exists()) {
      await setDoc(privRef, {
        uid,
        email,
        cedulaId,
        colegiatura,
        pais,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privRef, {
        email,
        cedulaId,
        colegiatura,
        pais,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function loadUserPrivateProfile(uid: string): Promise<Partial<AuditorProfile> | null> {
  const safeUid = sanitizeDocId(uid, 'usr');
  try {
    const [pubSnap, privSnap] = await Promise.all([
      getDoc(doc(db, 'users', safeUid)),
      getDoc(doc(db, 'users', safeUid, 'private', 'profile')),
    ]);
    if (!pubSnap.exists() && !privSnap.exists()) return null;
    const pub = pubSnap.data() || {};
    const priv = privSnap.data() || {};
    return {
      nombre: pub.displayName || '',
      cargo: pub.cargo || 'Auditor Forense',
      entidad: pub.entidadProfesional || '',
      cedulaId: priv.cedulaId || '',
      colegiatura: priv.colegiatura || '',
      pais: priv.pais || 'República Dominicana',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${safeUid}/private/profile`);
  }
}

// ==================== ENTITIES CRUD & SUBSCRIPTION ====================
export async function saveEntityToFirestore(entity: AuditedEntity, ownerUid: string): Promise<AuditedEntity> {
  const safeId = sanitizeDocId(entity.id, 'ent');
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  const path = `entities/${safeId}`;

  const payload = {
    id: safeId,
    ownerUid: safeOwner,
    nombre: String(entity.nombre || 'Entidad').trim().slice(0, 240) || 'Entidad',
    siglas: String(entity.siglas || 'ENT').trim().toUpperCase().slice(0, 32) || 'ENT',
    rncNif: String(entity.rncNif || 'N/D').trim().slice(0, 64),
    sector: String(entity.sector || 'Sector Público / Contrataciones').trim().slice(0, 160),
    paisCodigo: String(entity.paisCodigo || 'DO').trim().slice(0, 8),
    moneda: String(entity.moneda || 'DOP').trim().slice(0, 10),
    simboloMoneda: String(entity.simboloMoneda || 'RD$').trim().slice(0, 10),
    urlPortal: String(entity.urlPortal || '').trim().slice(0, 600),
    descripcion: String(entity.descripcion || '').trim().slice(0, 12000),
  };

  try {
    const ref = doc(db, 'entities', safeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        nombre: payload.nombre,
        siglas: payload.siglas,
        rncNif: payload.rncNif,
        sector: payload.sector,
        paisCodigo: payload.paisCodigo,
        moneda: payload.moneda,
        simboloMoneda: payload.simboloMoneda,
        urlPortal: payload.urlPortal,
        descripcion: payload.descripcion,
        updatedAt: serverTimestamp(),
      });
    }
    return {
      ...entity,
      ...payload,
      creadaEn: entity.creadaEn || new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteEntityAndProjectsFromFirestore(entityId: string, ownerUid: string): Promise<void> {
  const safeId = sanitizeDocId(entityId, 'ent');
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  try {
    const q = query(
      collection(db, 'projects'),
      where('ownerUid', '==', safeOwner),
      where('entityId', '==', safeId)
    );
    const projSnaps = await getDocs(q);
    for (const projDoc of projSnaps.docs) {
      await deleteProjectCascadeFromFirestore(projDoc.id, safeOwner);
    }
    await deleteDoc(doc(db, 'entities', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `entities/${safeId}`);
  }
}

export function subscribeToEntities(
  ownerUid: string,
  onData: (entities: AuditedEntity[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  const q = query(collection(db, 'entities'), where('ownerUid', '==', safeOwner));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            nombre: data.nombre || '',
            siglas: data.siglas || '',
            rncNif: data.rncNif || 'N/D',
            sector: data.sector || '',
            paisCodigo: data.paisCodigo || 'DO',
            moneda: data.moneda || 'DOP',
            simboloMoneda: data.simboloMoneda || 'RD$',
            urlPortal: data.urlPortal || '',
            descripcion: data.descripcion || '',
            creadaEn: timestampToIso(data.createdAt),
            actualizadaEn: timestampToIso(data.updatedAt),
            _sortMs: timestampToMillis(data.updatedAt || data.createdAt),
          };
        })
        .sort((a, b) => b._sortMs - a._sortMs)
        .map(({ _sortMs, ...rest }) => rest as AuditedEntity);
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'entities');
    }
  );
}

// ==================== PROJECTS (CASES) CRUD & SUBSCRIPTION ====================
function buildProjectFirestorePayload(cs: CaseSession, ownerUid: string, uploadsCount = 0) {
  const safeId = sanitizeDocId(cs.id, 'case');
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  const safeEntityId = sanitizeDocId(cs.entity?.id || '', 'ent');

  const compactEvidence = cs.evidenceFile
    ? stripUndefinedDeep({
        name: String(cs.evidenceFile.name || '').slice(0, 260),
        size: Number(cs.evidenceFile.size) || 0,
        type: String(cs.evidenceFile.type || '').slice(0, 120),
        sha256: String(cs.evidenceFile.sha256 || '').slice(0, 128),
        uploadDate: String(cs.evidenceFile.uploadDate || ''),
        sourceType: cs.evidenceFile.sourceType || 'ARCHIVO',
        sourceUrl: String(cs.evidenceFile.sourceUrl || '').slice(0, 800),
        contentSnippet: String(cs.evidenceFile.contentSnippet || '').slice(0, 1500),
        extractedText: String(cs.evidenceFile.extractedText || '').slice(0, 8000),
        parsedFormat: String(cs.evidenceFile.parsedFormat || ''),
        sheetNames: (cs.evidenceFile.sheetNames || []).slice(0, 30),
        pageCount: Number(cs.evidenceFile.pageCount) || 0,
        recordCount: Number(cs.evidenceFile.recordCount) || 0,
        numericAmounts: (cs.evidenceFile.numericAmounts || []).slice(0, 400),
      })
    : null;

  const base = stripUndefinedDeep({
    id: safeId,
    ownerUid: safeOwner,
    entityId: safeEntityId,
    codigoCaso: String(cs.codigoCaso || `CASO-${new Date().getFullYear()}-001`).slice(0, 64),
    nombreCaso: String(cs.nombreCaso || `Auditoria_${cs.entity?.siglas || 'General'}`).slice(0, 240),
    estado: cs.estado || (cs.resultado ? 'DICTAMEN_EMITIDO' : 'EN_PROCESO'),
    requerimiento: String(cs.requerimiento || '').slice(0, 15000),
    selloDigital: String(cs.selloDigital || 'PENDIENTE').slice(0, 128),
    paisNormativa: String(cs.paisNormativa || 'DO').slice(0, 80),
    idioma: String(cs.idioma || 'Español (DO)').slice(0, 40),
    origenes: (cs.origenes || []).slice(0, 20).map((o) => String(o).slice(0, 120)),
    entitySnapshot: cs.entity
      ? stripUndefinedDeep({
          id: sanitizeDocId(cs.entity.id, 'ent'),
          nombre: String(cs.entity.nombre || '').slice(0, 240),
          siglas: String(cs.entity.siglas || '').slice(0, 32),
          rncNif: String(cs.entity.rncNif || 'N/D').slice(0, 64),
          sector: String(cs.entity.sector || '').slice(0, 160),
          paisCodigo: String(cs.entity.paisCodigo || 'DO').slice(0, 8),
          moneda: String(cs.entity.moneda || 'DOP').slice(0, 10),
          simboloMoneda: String(cs.entity.simboloMoneda || 'RD$').slice(0, 10),
          urlPortal: String(cs.entity.urlPortal || '').slice(0, 600),
          descripcion: String(cs.entity.descripcion || '').slice(0, 4000),
        })
      : {},
    auditorSnapshot: stripUndefinedDeep(
      cs.auditor || {
        nombre: '',
        cedulaId: '',
        cargo: 'Auditor Forense',
        entidad: '',
        pais: 'República Dominicana',
        colegiatura: '',
      }
    ),
    periodoSnapshot: stripUndefinedDeep(
      cs.periodo || {
        fechaDesde: '',
        fechaHasta: '',
        alcancePericial: '',
      }
    ),
    counts: {
      contratos: (cs.contractRows || []).length,
      pagos: (cs.paymentCycleRows || []).length,
      observaciones: (cs.observaciones || []).length,
      hallazgos: (cs.matrizHallazgosLiteral || []).length,
      normas: (cs.legalLibrary || []).length,
      cargas: uploadsCount,
    },
    evidenceSummary: compactEvidence,
    contractRows: (cs.contractRows || []).slice(0, 250),
    paymentCycleRows: (cs.paymentCycleRows || []).slice(0, 250),
    observaciones: (cs.observaciones || []).slice(0, 150),
    actaLectura: trimDossierItem(cs.actaLectura, 'Acta de Lectura'),
    recursos: (cs.recursos || []).slice(0, 60).map((r) => trimDossierItem(r, 'Recurso')),
    informePreliminar: trimDossierItem(cs.informePreliminar, 'Informe Preliminar'),
    replicas: (cs.replicas || []).slice(0, 60).map((r) => trimDossierItem(r, 'Réplica')),
    contraReplicas: (cs.contraReplicas || []).slice(0, 60).map((r) => trimDossierItem(r, 'Contra-Réplica')),
    directors: (cs.directors || []).slice(0, 60),
    preReviewReports: cs.preReviewReports ? stripUndefinedDeep(cs.preReviewReports) : {},
    matrizHallazgosLiteral: (cs.matrizHallazgosLiteral || []).slice(0, 250),
    legalLibrary: (cs.legalLibrary || []).slice(0, 120).map((l) => ({
      ...l,
      textoExtraido: l.textoExtraido ? String(l.textoExtraido).slice(0, 12000) : '',
      resumenAplicacion: l.resumenAplicacion ? String(l.resumenAplicacion).slice(0, 4000) : '',
    })),
    duplicidades: (cs.duplicidades || []).slice(0, 100),
    ccrdStages: (cs.ccrdStages || []).slice(0, 10),
    traceabilityLogs: (cs.traceabilityLogs || []).slice(0, 150),
    resultado: cs.resultado ? stripUndefinedDeep(cs.resultado) : null,
  });

  return base;
}

export async function ensureProjectExistsInFirestore(
  cs: CaseSession,
  ownerUid: string
): Promise<string> {
  const safeProjId = sanitizeDocId(cs.id, 'case');
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  if (cs.entity) {
    const entSnap = await getDoc(doc(db, 'entities', sanitizeDocId(cs.entity.id, 'ent')));
    if (!entSnap.exists()) {
      await saveEntityToFirestore(cs.entity, safeOwner);
    }
  }
  const projRef = doc(db, 'projects', safeProjId);
  const projSnap = await getDoc(projRef);
  if (!projSnap.exists()) {
    const payload = buildProjectFirestorePayload(cs, safeOwner, 0);
    await setDoc(projRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return safeProjId;
}

export async function saveProjectToFirestore(
  cs: CaseSession,
  ownerUid: string,
  options?: { recordIteration?: boolean; iterationSummary?: string }
): Promise<CaseSession> {
  const safeId = sanitizeDocId(cs.id, 'case');
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  const path = `projects/${safeId}`;

  if (!cs.entity?.id) {
    throw new Error('Registre o seleccione una entidad real antes de guardar el proyecto.');
  }

  // Guarantee parent entity exists before project write (Master Gate / Global Consistency)
  const safeEntityId = sanitizeDocId(cs.entity.id, 'ent');
  try {
    const entSnap = await getDoc(doc(db, 'entities', safeEntityId));
    if (!entSnap.exists()) {
      await saveEntityToFirestore(cs.entity, safeOwner);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `entities/${safeEntityId}`);
  }

  let existingUploadsCount = 0;
  try {
    const upSnaps = await getDocs(
      query(collection(db, 'projects', safeId, 'uploads'), where('ownerUid', '==', safeOwner))
    );
    existingUploadsCount = upSnaps.size;
  } catch {
    existingUploadsCount = 0;
  }

  const payload = buildProjectFirestorePayload(cs, safeOwner, existingUploadsCount);
  const projRef = doc(db, 'projects', safeId);

  try {
    const snap = await getDoc(projRef);
    if (!snap.exists()) {
      await setDoc(projRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { id: _id, ownerUid: _owner, entityId: _entId, ...updatableFields } = payload;
      await updateDoc(projRef, {
        ...updatableFields,
        updatedAt: serverTimestamp(),
      });
    }

    const updatedIterations = [...(cs.iterations || [])];
    if (options?.recordIteration !== false) {
      const nextVersion = updatedIterations.length > 0 ? Math.max(...updatedIterations.map((i) => i.version)) + 1 : 1;
      const iterId = sanitizeDocId(`iter-${Date.now()}`, 'iter');
      const nowIso = new Date().toISOString();
      const summaryText = (
        options?.iterationSummary ||
        `Iteración v${nextVersion}: ${payload.counts.hallazgos} hallazgos 3.01+, ${payload.counts.observaciones} obs., ${payload.counts.contratos} contr., ${payload.counts.pagos} pagos, ${payload.counts.normas} normas.`
      ).slice(0, 600);

      await setDoc(doc(db, 'projects', safeId, 'iterations', iterId), {
        id: iterId,
        projectId: safeId,
        ownerUid: safeOwner,
        version: nextVersion,
        autor: String(cs.auditor?.nombre || auth.currentUser?.displayName || 'Auditor').slice(0, 160),
        etapa: String(payload.estado).slice(0, 40),
        resumenCambio: summaryText,
        sha256: String(payload.selloDigital).slice(0, 128),
        createdAt: serverTimestamp(),
      });

      const localIter: CaseIteration = {
        id: iterId,
        version: nextVersion,
        timestamp: nowIso,
        autor: String(cs.auditor?.nombre || auth.currentUser?.displayName || 'Auditor'),
        etapa: String(payload.estado),
        resumenCambio: summaryText,
        sha256: String(payload.selloDigital),
      };
      updatedIterations.unshift(localIter);
    }

    return {
      ...cs,
      id: safeId,
      updatedAt: new Date().toISOString(),
      iterations: updatedIterations.slice(0, 50),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function closeProjectInFirestore(projectId: string, ownerUid: string): Promise<void> {
  const safeId = sanitizeDocId(projectId, 'case');
  const path = `projects/${safeId}`;
  try {
    await updateDoc(doc(db, 'projects', safeId), {
      estado: 'CERRADO',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProjectCascadeFromFirestore(projectId: string, ownerUid: string): Promise<void> {
  const safeId = sanitizeDocId(projectId, 'case');
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  const path = `projects/${safeId}`;
  try {
    const [uploadsSnap, iterSnap] = await Promise.all([
      getDocs(query(collection(db, 'projects', safeId, 'uploads'), where('ownerUid', '==', safeOwner))),
      getDocs(query(collection(db, 'projects', safeId, 'iterations'), where('ownerUid', '==', safeOwner))),
    ]);

    const batch = writeBatch(db);
    uploadsSnap.docs.forEach((d) => batch.delete(d.ref));
    iterSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'projects', safeId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function mapDocToCaseSession(docId: string, data: Record<string, any>): CaseSession & { _sortMs: number } {
  return {
    id: data.id || docId,
    codigoCaso: data.codigoCaso || 'CASO',
    nombreCaso: data.nombreCaso || 'Proyecto Forense',
    sessionOwnerId: data.ownerUid,
    estado: data.estado || 'EN_PROCESO',
    timestamp: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt || data.createdAt),
    raizCaso: `caso_${String(data.nombreCaso || docId).toLowerCase().replace(/\s+/g, '_')}`,
    origenes: Array.isArray(data.origenes) ? data.origenes : [],
    requerimiento: data.requerimiento || '',
    selloDigital: data.selloDigital || '',
    entity: data.entitySnapshot && data.entitySnapshot.id ? data.entitySnapshot : undefined,
    auditor: data.auditorSnapshot || undefined,
    periodo: data.periodoSnapshot || undefined,
    paisNormativa: data.paisNormativa || 'DO',
    idioma: data.idioma || 'Español (DO)',
    evidenceFile: data.evidenceSummary || null,
    contractRows: Array.isArray(data.contractRows) ? data.contractRows : [],
    paymentCycleRows: Array.isArray(data.paymentCycleRows) ? data.paymentCycleRows : [],
    observaciones: Array.isArray(data.observaciones) ? data.observaciones : [],
    actaLectura: data.actaLectura || undefined,
    recursos: Array.isArray(data.recursos) ? data.recursos : [],
    informePreliminar: data.informePreliminar || undefined,
    replicas: Array.isArray(data.replicas) ? data.replicas : [],
    contraReplicas: Array.isArray(data.contraReplicas) ? data.contraReplicas : [],
    directors: Array.isArray(data.directors) ? data.directors : [],
    preReviewReports: data.preReviewReports || {},
    matrizHallazgosLiteral: Array.isArray(data.matrizHallazgosLiteral) ? data.matrizHallazgosLiteral : [],
    legalLibrary: Array.isArray(data.legalLibrary) ? data.legalLibrary : [],
    duplicidades: Array.isArray(data.duplicidades) ? data.duplicidades : [],
    ccrdStages: Array.isArray(data.ccrdStages) ? data.ccrdStages : [],
    iterations: [],
    traceabilityLogs: Array.isArray(data.traceabilityLogs) ? data.traceabilityLogs : [],
    resultado: data.resultado || null,
    _sortMs: timestampToMillis(data.updatedAt || data.createdAt),
  };
}

export function subscribeToUserProjects(
  ownerUid: string,
  onData: (projects: CaseSession[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  const q = query(collection(db, 'projects'), where('ownerUid', '==', safeOwner));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapDocToCaseSession(d.id, d.data()))
        .sort((a, b) => b._sortMs - a._sortMs)
        .map(({ _sortMs, ...rest }) => rest);
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'projects');
    }
  );
}

// ==================== PROJECT REAL UPLOADS SUBCOLLECTION ====================
export async function saveUploadToFirestore(params: {
  caseSnapshot: CaseSession;
  evidenceFile: EvidenceFile;
  ownerUid: string;
}): Promise<ProjectUploadRecord> {
  const { caseSnapshot, evidenceFile, ownerUid } = params;
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  const safeProjId = await ensureProjectExistsInFirestore(caseSnapshot, safeOwner);
  const uploadId = sanitizeDocId(`upl-${Date.now()}-${evidenceFile.sha256.slice(0, 8)}`, 'upl');
  const path = `projects/${safeProjId}/uploads/${uploadId}`;

  const safeText = String(evidenceFile.extractedText || '').slice(0, 260000);
  const safeRows = stripUndefinedDeep((evidenceFile.extractedRows || []).slice(0, 250));
  const safeNumbers = (evidenceFile.numericAmounts || [])
    .filter((n) => typeof n === 'number' && Number.isFinite(n))
    .slice(0, 1000);
  const safeSheets = (evidenceFile.sheetNames || []).slice(0, 30).map((s) => String(s).slice(0, 120));
  const safeLinks = stripUndefinedDeep((evidenceFile.discoveredLinks || []).slice(0, 40));

  const docData: ProjectUploadRecord = {
    id: uploadId,
    projectId: safeProjId,
    entityId: sanitizeDocId(caseSnapshot.entity?.id || '', 'ent'),
    ownerUid: safeOwner,
    fileName: String(evidenceFile.name || 'Documento Real').slice(0, 260),
    sourceType: evidenceFile.sourceType || 'ARCHIVO',
    parsedFormat: String(evidenceFile.parsedFormat || 'DIGITAL').slice(0, 64),
    mimeType: String(evidenceFile.type || 'application/octet-stream').slice(0, 120),
    sizeBytes: Number(evidenceFile.size) || 0,
    sha256: String(evidenceFile.sha256 || '0000000000000000').slice(0, 128),
    sourceUrl: String(evidenceFile.sourceUrl || '').slice(0, 800),
    contentSnippet: String(evidenceFile.contentSnippet || safeText.slice(0, 800)).slice(0, 2000),
    extractedText: safeText,
    extractedRows: safeRows,
    numericAmounts: safeNumbers,
    sheetNames: safeSheets,
    discoveredLinks: safeLinks,
    pageCount: Number(evidenceFile.pageCount) || 0,
    recordCount: Number(evidenceFile.recordCount) || safeRows.length || 0,
  };

  try {
    await setDoc(doc(db, 'projects', safeProjId, 'uploads', uploadId), {
      ...docData,
      createdAt: serverTimestamp(),
    });
    return {
      ...docData,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteUploadFromFirestore(projectId: string, uploadId: string): Promise<void> {
  const safeProjId = sanitizeDocId(projectId, 'case');
  const safeUploadId = sanitizeDocId(uploadId, 'upl');
  try {
    await deleteDoc(doc(db, 'projects', safeProjId, 'uploads', safeUploadId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `projects/${safeProjId}/uploads/${safeUploadId}`);
  }
}

export function subscribeToProjectUploads(
  projectId: string,
  ownerUid: string,
  onData: (uploads: ProjectUploadRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const safeProjId = sanitizeDocId(projectId, 'case');
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  const q = query(collection(db, 'projects', safeProjId, 'uploads'), where('ownerUid', '==', safeOwner));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            ...(data as ProjectUploadRecord),
            id: data.id || d.id,
            createdAt: timestampToIso(data.createdAt),
            _sortMs: timestampToMillis(data.createdAt),
          };
        })
        .sort((a, b) => b._sortMs - a._sortMs)
        .map(({ _sortMs, ...rest }) => rest as ProjectUploadRecord);
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, `projects/${safeProjId}/uploads`);
    }
  );
}

export function subscribeToProjectIterations(
  projectId: string,
  ownerUid: string,
  onData: (iterations: CaseIteration[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const safeProjId = sanitizeDocId(projectId, 'case');
  const safeOwner = sanitizeDocId(ownerUid, 'usr');
  const q = query(collection(db, 'projects', safeProjId, 'iterations'), where('ownerUid', '==', safeOwner));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            version: Number(data.version) || 1,
            timestamp: timestampToIso(data.createdAt),
            autor: data.autor || 'Auditor',
            etapa: data.etapa || 'EN_PROCESO',
            resumenCambio: data.resumenCambio || '',
            sha256: data.sha256 || '',
            _sortVer: Number(data.version) || 0,
          };
        })
        .sort((a, b) => b._sortVer - a._sortVer)
        .map(({ _sortVer, ...rest }) => rest as CaseIteration);
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, `projects/${safeProjId}/iterations`);
    }
  );
}

export function uploadRecordToEvidenceFile(rec: ProjectUploadRecord): EvidenceFile {
  return {
    name: rec.fileName,
    size: rec.sizeBytes,
    type: rec.mimeType,
    sha256: rec.sha256,
    uploadDate: timestampToIso(rec.createdAt),
    sourceType: rec.sourceType,
    sourceUrl: rec.sourceUrl || undefined,
    contentSnippet: rec.contentSnippet,
    extractedText: rec.extractedText,
    extractedRows: rec.extractedRows,
    numericAmounts: rec.numericAmounts,
    parsedFormat: rec.parsedFormat,
    sheetNames: rec.sheetNames,
    pageCount: rec.pageCount || undefined,
    recordCount: rec.recordCount || undefined,
    discoveredLinks: rec.discoveredLinks,
  };
}
