import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Column, COLUMN_COLORS } from '../models/column.model';
import { Task, Tag, generateId } from '../models/task.model';

/** Chave usada para persistir dados no localStorage */
const STORAGE_KEY = 'kanban_columns';

/**
 * Serviço principal para gerenciamento de estado do kanban.
 *
 * Utiliza BehaviorSubject para estado reativo e localStorage para persistência.
 * Todas as operações utilizam programação imutável (spread/map/filter).
 */
@Injectable({ providedIn: 'root' })
export class TaskService {

  /** BehaviorSubject que mantém o estado atual das colunas */
  private columnsSubject = new BehaviorSubject<Column[]>(this.loadFromStorage());

  /** Observable público para os componentes se inscreverem */
  columns$: Observable<Column[]> = this.columnsSubject.asObservable();

  constructor() {
    // Se não há colunas salvas, cria colunas padrão
    if (this.columnsSubject.getValue().length === 0) {
      this.initializeDefaultColumns();
    }
  }

  // ─── COLUNAS ──────────────────────────────────────────────

  /** Retorna o estado atual das colunas (snapshot) */
  getColumns(): Column[] {
    return this.columnsSubject.getValue();
  }

  /** Cria colunas padrão ao iniciar pela primeira vez */
  private initializeDefaultColumns(): void {
    const defaults: Column[] = [
      { id: generateId(), title: 'A Fazer', color: COLUMN_COLORS[0], tasks: [] },
      { id: generateId(), title: 'Fazendo', color: COLUMN_COLORS[1], tasks: [] },
      { id: generateId(), title: 'Concluído', color: COLUMN_COLORS[2], tasks: [] },
    ];
    this.updateColumns(defaults);
  }

  /** Adiciona uma nova coluna ao board */
  addColumn(title: string): void {
    const columns = this.getColumns();
    const colorIndex = columns.length % COLUMN_COLORS.length;
    const newColumn: Column = {
      id: generateId(),
      title,
      color: COLUMN_COLORS[colorIndex],
      tasks: [],
    };
    // Imutável: cria novo array com a coluna adicionada
    this.updateColumns([...columns, newColumn]);
  }

  /** Remove uma coluna pelo ID */
  deleteColumn(columnId: string): void {
    const columns = this.getColumns().filter(col => col.id !== columnId);
    this.updateColumns(columns);
  }

  /** Atualiza o título de uma coluna */
  updateColumnTitle(columnId: string, newTitle: string): void {
    const columns = this.getColumns().map(col =>
      col.id === columnId ? { ...col, title: newTitle } : col
    );
    this.updateColumns(columns);
  }

  // ─── TAREFAS ──────────────────────────────────────────────

  /** Adiciona uma tarefa a uma coluna específica */
  addTask(columnId: string, title: string, description?: string, dueDate?: string, tags: Tag[] = []): void {
    const newTask: Task = {
      id: generateId(),
      title,
      description,
      dueDate,
      tags,
      completed: false,
      createdAt: new Date().toISOString(),
      timerSeconds: 0,
      timerRunning: false,
    };
    const columns = this.getColumns().map(col =>
      col.id === columnId
        ? { ...col, tasks: [...col.tasks, newTask] }
        : col
    );
    this.updateColumns(columns);
  }

  /** Remove uma tarefa de qualquer coluna */
  deleteTask(taskId: string): void {
    const columns = this.getColumns().map(col => ({
      ...col,
      tasks: col.tasks.filter(task => task.id !== taskId),
    }));
    this.updateColumns(columns);
  }

  /** Atualiza uma tarefa existente (edição parcial) */
  updateTask(taskId: string, updates: Partial<Task>): void {
    const columns = this.getColumns().map(col => ({
      ...col,
      tasks: col.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    }));
    this.updateColumns(columns);
  }

  /** Marca ou desmarca uma tarefa como concluída */
  toggleTaskCompleted(taskId: string): void {
    const columns = this.getColumns().map(col => ({
      ...col,
      tasks: col.tasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      ),
    }));
    this.updateColumns(columns);
  }

  // ─── DRAG AND DROP ────────────────────────────────────────

  /**
   * Move uma tarefa dentro da mesma coluna (reordenar).
   * Utiliza splice de forma imutável criando cópia do array.
   */
  moveTaskInSameColumn(columnId: string, previousIndex: number, currentIndex: number): void {
    const columns = this.getColumns().map(col => {
      if (col.id !== columnId) return col;
      const tasks = [...col.tasks];
      const [moved] = tasks.splice(previousIndex, 1);
      tasks.splice(currentIndex, 0, moved);
      return { ...col, tasks };
    });
    this.updateColumns(columns);
  }

  /**
   * Move uma tarefa entre colunas diferentes.
   * Remove da coluna de origem e insere na coluna de destino.
   */
  moveTaskBetweenColumns(
    fromColumnId: string,
    toColumnId: string,
    previousIndex: number,
    currentIndex: number
  ): void {
    const columns = this.getColumns();
    const fromCol = columns.find(c => c.id === fromColumnId);
    if (!fromCol) return;

    const taskToMove = fromCol.tasks[previousIndex];
    if (!taskToMove) return;

    const updated = columns.map(col => {
      if (col.id === fromColumnId) {
        // Remove tarefa da coluna de origem
        return { ...col, tasks: col.tasks.filter((_, i) => i !== previousIndex) };
      }
      if (col.id === toColumnId) {
        // Insere tarefa na coluna de destino
        const tasks = [...col.tasks];
        tasks.splice(currentIndex, 0, taskToMove);
        return { ...col, tasks };
      }
      return col;
    });
    this.updateColumns(updated);
  }

  // ─── TIMER ────────────────────────────────────────────────

  /** Incrementa o timer de uma tarefa em 1 segundo */
  incrementTimer(taskId: string): void {
    const columns = this.getColumns().map(col => ({
      ...col,
      tasks: col.tasks.map(task =>
        task.id === taskId ? { ...task, timerSeconds: task.timerSeconds + 1 } : task
      ),
    }));
    // Persiste sem notificar a cada segundo (usa subject diretamente)
    this.columnsSubject.next(columns);
    this.saveToStorage(columns);
  }

  // ─── PERSISTÊNCIA ─────────────────────────────────────────

  /** Carrega dados do localStorage */
  private loadFromStorage(): Column[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      console.error('Erro ao carregar dados do localStorage');
      return [];
    }
  }

  /** Salva dados no localStorage */
  private saveToStorage(columns: Column[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch {
      console.error('Erro ao salvar dados no localStorage');
    }
  }

  /** Atualiza o estado e persiste automaticamente */
  private updateColumns(columns: Column[]): void {
    this.columnsSubject.next(columns);
    this.saveToStorage(columns);
  }
}
