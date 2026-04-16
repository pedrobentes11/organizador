/**
 * Interface que representa uma tarefa no kanban.
 * Contém todas as propriedades necessárias para gerenciar a tarefa.
 */
export interface Task {
  /** Identificador único da tarefa (UUID) */
  id: string;

  /** Título/nome da tarefa */
  title: string;

  /** Descrição opcional da tarefa */
  description?: string;

  /** Data de vencimento (YYYY-MM-DD) */
  dueDate?: string;

  /** Horário de vencimento (HH:mm) — usado junto com dueDate para prazo exato */
  dueTime?: string;

  /** Tags/categorias associadas à tarefa */
  tags: Tag[];

  /** Se a tarefa está marcada como concluída */
  completed: boolean;

  /** Data de criação (ISO string) */
  createdAt: string;

  /** Tempo acumulado do timer em segundos */
  timerSeconds: number;

  /** Se o timer está rodando atualmente */
  timerRunning: boolean;

  /** Se já foi enviada notificação de prazo expirado (evita repetir alerta) */
  deadlineNotified?: boolean;
}

/**
 * Monta um Date a partir de dueDate (YYYY-MM-DD) e dueTime (HH:mm) opcionais.
 * Retorna null se não houver dueDate.
 * Se dueTime não for informado, assume 23:59 do dia.
 */
export function buildDeadline(dueDate?: string, dueTime?: string): Date | null {
  if (!dueDate) return null;
  const time = dueTime || '23:59';
  return new Date(`${dueDate}T${time}:00`);
}

/**
 * Tags disponíveis para categorizar tarefas.
 * Cada tag tem um nome e uma cor associada.
 */
export type TagName = 'urgente' | 'estudo' | 'trabalho' | 'pessoal' | 'bug' | 'feature';

export interface Tag {
  name: TagName;
  color: string;
}

/**
 * Mapa de cores para cada tag disponível.
 * Facilita a criação de tags com cores consistentes.
 */
export const TAG_COLORS: Record<TagName, string> = {
  urgente: '#ef4444',
  estudo: '#3b82f6',
  trabalho: '#f59e0b',
  pessoal: '#10b981',
  bug: '#f43f5e',
  feature: '#8b5cf6',
};

/**
 * Lista de todas as tags disponíveis no sistema.
 */
export const AVAILABLE_TAGS: Tag[] = (Object.keys(TAG_COLORS) as TagName[]).map(name => ({
  name,
  color: TAG_COLORS[name],
}));

/**
 * Gera um UUID v4 simples para identificação de tarefas e colunas.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
