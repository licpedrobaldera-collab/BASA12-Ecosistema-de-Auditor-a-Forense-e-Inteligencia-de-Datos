# Especificación de Seguridad Firestore — Suite de Auditoría Forense CCRD & NOBACI

## 1. Invariantes de Datos
1. **Aislamiento de PII (`users/{userId}/private/{docId}`):** Ningún usuario distinto de `request.auth.uid == userId` puede leer o escribir datos personales (`email`, `cedulaId`, `colegiatura`).
2. **Propiedad Estricta de Entidades (`entities/{entityId}`):** Una entidad solo puede existir con `ownerUid == request.auth.uid` y usuario autenticado con correo verificado (`request.auth.token.email_verified == true`).
3. **Integridad Referencial Proyecto → Entidad (`projects/{projectId}`):** Un proyecto de auditoría NO puede crearse sin que exista la entidad padre `/entities/{entityId}` y pertenezca al mismo `ownerUid == request.auth.uid`.
4. **Master Gate para Cargas e Iteraciones (`/projects/{projectId}/uploads/{uploadId}` y `/iterations/{iterationId}`):** Toda carga documental real o iteración de versión exige que el proyecto padre exista y que `get(/databases/$(database)/documents/projects/$(projectId)).data.ownerUid == request.auth.uid`.
5. **Inmutabilidad Temporal y Bloqueo de Estado Terminal:** `createdAt` e `ownerUid` son inmutables tras la creación. Cuando un proyecto alcanza `estado == 'CERRADO'`, queda bloqueado ante mutaciones posteriores.

## 2. Payloads "Dirty Dozen" (Pruebas Adversarias)
1. **Suplantación de `ownerUid` en `entities`:** Crear entidad con `ownerUid: "otro_usuario"` -> `PERMISSION_DENIED`.
2. **Inyección de campo fantasma (`isAdmin: true`):** Crear o actualizar entidad/proyecto con campos no declarados en `hasOnly(...)` -> `PERMISSION_DENIED`.
3. **Proyecto huérfano:** Crear proyecto con `entityId: "ent_inexistente"` -> `PERMISSION_DENIED`.
4. **Proyecto cruzado hacia entidad ajena:** Crear proyecto apuntando a `entityId` cuyo `ownerUid != request.auth.uid` -> `PERMISSION_DENIED`.
5. **Carga real sin proyecto padre:** Crear `uploads/{uploadId}` bajo un `projectId` inexistente -> `PERMISSION_DENIED`.
6. **ID venenoso / path traversal:** Usar un ID de documento > 128 chars o con `/` o `$` -> `PERMISSION_DENIED`.
7. **Timestamp falsificado en creación:** Enviar `createdAt` distinto de `request.time` -> `PERMISSION_DENIED`.
8. **Mutación de campo inmortal:** Intentar cambiar `ownerUid` o `entityId` o `createdAt` en `update` -> `PERMISSION_DENIED`.
9. **Lectura de listado global sin filtro propietario:** `list` sobre `/projects` o `/entities` sin coincidencia `resource.data.ownerUid == request.auth.uid` -> `PERMISSION_DENIED`.
10. **Acceso a PII de otro auditor:** `get` sobre `/users/{otroUid}/private/profile` -> `PERMISSION_DENIED`.
11. **Modificación de proyecto cerrado:** `update` sobre un proyecto con `estado == 'CERRADO'` -> `PERMISSION_DENIED`.
12. **Exceso de límites volumétricos (Denial of Wallet):** Enviar `descripcion` de 50,000 caracteres o lista `contractRows` > 250 elementos -> `PERMISSION_DENIED`.
