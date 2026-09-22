export interface MappedArgoProject {
  name: string;
  description: string | null;
}

export interface MappedArgoApplication {
  uid: string;
  name: string;
  argoProject: string;
  repoUrl: string | null;
  branch: string | null;
  path: string | null;
  namespace: string | null;
  cluster: string | null;
  syncStatus: string;
  healthStatus: string;
  revision: string;
  lastObservedAt: Date | null;
  history: MappedArgoHistory[];
  signals: MappedArgoSignal[];
}

export interface MappedArgoSignal {
  type: string;
  message: string;
}

export interface MappedArgoHistory {
  revision: string;
  deployedAt: Date;
  startedAt: Date | null;
  status: string;
  syncStatus: string;
  healthStatus: string;
  environment: string;
}

export function extractArgoItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.Items)) return record.Items;
  if (record.metadata && (record.spec || record.status)) return [payload];
  return [];
}

export function mapArgoProject(raw: unknown): MappedArgoProject | null {
  const project = asRecord(raw);
  if (!project) return null;
  const metadata = asRecord(project.metadata);
  const spec = asRecord(project.spec);
  const name = String(metadata?.name || project.name || '').trim();
  if (!name) return null;
  return {
    name,
    description: stringOrNull(spec?.description) || 'Imported from Argo CD',
  };
}

export function mapArgoApplication(raw: unknown): MappedArgoApplication | null {
  const app = asRecord(raw);
  if (!app) return null;
  const metadata = asRecord(app.metadata);
  const spec = asRecord(app.spec);
  const status = asRecord(app.status);
  const source = firstSource(spec);
  const destination = asRecord(spec?.destination);
  const sync = asRecord(status?.sync);
  const health = asRecord(status?.health);
  const operation = asRecord(status?.operationState);
  const name = String(metadata?.name || '').trim();
  if (!name) return null;

  const namespace = stringOrNull(destination?.namespace);
  const cluster =
    stringOrNull(destination?.name) || stringOrNull(destination?.server);
  const syncStatus = String(sync?.status || 'Unknown');
  const healthStatus = String(health?.status || 'Unknown');
  const revision = String(sync?.revision || '');
  const uid =
    stringOrNull(metadata?.uid) || `${name}@${namespace || 'default'}`;

  const finishedAt = parseDate(operation?.finishedAt);
  const history = mapHistory(
    status?.history,
    namespace,
    syncStatus,
    healthStatus,
  );

  return {
    uid,
    name,
    argoProject: String(spec?.project || 'default'),
    repoUrl: stringOrNull(source?.repoURL),
    branch: stringOrNull(source?.targetRevision),
    path: stringOrNull(source?.path),
    namespace,
    cluster,
    syncStatus,
    healthStatus,
    revision,
    lastObservedAt: finishedAt || history[0]?.deployedAt || null,
    history,
    signals: mapSignals(status, health, operation),
  };
}

function mapSignals(
  status: Record<string, unknown> | undefined,
  health: Record<string, unknown> | undefined,
  operation: Record<string, unknown> | undefined,
): MappedArgoSignal[] {
  const signals: MappedArgoSignal[] = [];
  const seen = new Set<string>();
  const push = (type: string, message: string) => {
    const trimmedType = type.trim();
    const trimmedMessage = message.trim();
    if (!trimmedType || !trimmedMessage) return;
    const key = `${trimmedType}\n${trimmedMessage}`;
    if (seen.has(key)) return;
    seen.add(key);
    signals.push({ type: trimmedType, message: trimmedMessage });
  };

  if (typeof health?.message === 'string') {
    push('Health', health.message);
  }
  if (typeof operation?.message === 'string') {
    push('Operation', operation.message);
  }

  if (Array.isArray(status?.conditions)) {
    for (const item of status.conditions) {
      const condition = asRecord(item);
      if (!condition) continue;
      push(String(condition.type || 'Condition'), String(condition.message || ''));
    }
  }

  if (Array.isArray(status?.resources)) {
    for (const item of status.resources) {
      const resource = asRecord(item);
      const resourceHealth = asRecord(resource?.health);
      const kind = String(resource?.kind || 'Resource');
      const name = String(resource?.name || '').trim();
      const label = name ? `${kind}/${name}` : kind;
      if (typeof resourceHealth?.message === 'string') {
        push(label, resourceHealth.message);
      }
    }
  }

  return signals;
}

function mapHistory(
  value: unknown,
  namespace: string | null,
  syncStatus: string,
  healthStatus: string,
): MappedArgoHistory[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) return null;
      const deployedAt = parseDate(item.deployedAt);
      if (!deployedAt) return null;
      const revision = String(item.revision || '');
      if (!revision) return null;
      return {
        revision,
        deployedAt,
        startedAt: parseDate(item.deployStartedAt),
        status: healthStatus.toLowerCase() === 'degraded' ? 'Failed' : 'Succeeded',
        syncStatus,
        healthStatus,
        environment: namespace || 'default',
      } satisfies MappedArgoHistory;
    })
    .filter((item): item is MappedArgoHistory => item !== null)
    .sort((a, b) => b.deployedAt.getTime() - a.deployedAt.getTime());
}

function firstSource(spec?: Record<string, unknown>) {
  const sources = spec?.sources;
  if (Array.isArray(sources) && sources.length > 0) {
    return asRecord(sources[0]);
  }
  return asRecord(spec?.source);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
