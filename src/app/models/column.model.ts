import { Task } from './task.model';

/**
 * Interface que representa uma coluna (lista) no kanban.
 * Cada coluna contém um array de tarefas.
 */
export interface Column {
  /** Identificador único da coluna (UUID) */
  id: string;

  /** Nome/título da coluna (ex: "A Fazer", "Fazendo") */
  title: string;

  /** Cor de destaque da coluna (hex) */
  color: string;

  /** Lista de tarefas na coluna */
  tasks: Task[];
}

/**
 * Cores padrão para novas colunas.
 */
export const COLUMN_COLORS: string[] = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
];
