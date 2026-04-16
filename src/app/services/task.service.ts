import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Column, COLUMN_COLORS } from '../models/column.model';
import { Task, Tag, generateId } from '../models/task.model';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

/** Prefixo da chave no localStorage — concatenado com o userId */
const STORAGE_PREFIX = 'kanban_columns_';

/**
 * Serviço principal para gerenciamento de estado do kanban.
 *
 * ─── POR QUE USAR BEHAVIORSUBJECT? ───
 * Mantém o último valor emitido, permitindo que novos subscribers
 * recebam o estado atual imediatamente. Exposto como Observable<>
 * para garantir que apenas o serviço mute o estado.
 *
 * ─── POR QUE IMUTABILIDADE? ───
 * Ao criar novos arrays/objetos ao invés de mutar os existentes:
 * 1. O Angular com OnPush detecta mudanças corretamente (compara referências)
 * 2. Evita side-effects inesperados
 * 3. Facilita debug e eventual undo/redo
 * Mutações diretas seriam invisíveis ao OnPush.
 *
 * Usamos structuredClone() para deep clone antes de qualquer modificação.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {

  /** BehaviorSubject que mantém o estado atual das colunas */
  private readonly columnsSubject = new BehaviorSubject<Column[]>([]);

  /** Observable público — componentes se inscrevem aqui para receber atualizações */
  readonly columns$: Observable<Column[]> = this.columnsSubject.asObservable();

  /** UID do usuário logado — usado como chave no localStorage */
  private currentUserId: string | null = null;

  constructor(private auth: Auth) {
    // Escuta mudanças de auth para carregar dados do usuário correto
    onAuthStateChanged(this.auth, (user) => {
      this.currentUserId = user?.uid ?? null;
      if (user) {
        const columns = this.loadFromStorage();
        this.columnsSubject.next(columns);
        if (columns.length === 0) {
          this.initializeDefaultColumns();
        }
      } else {
        this.columnsSubject.next([]);
      }
    });
  }

  /** Retorna a chave do localStorage para o usuário atual */
  private get storageKey(): string {
    return STORAGE_PREFIX + (this.currentUserId ?? 'anonymous');
  }

  // ─── UTILS ────────────────────────────────────────────────

  /**
   * Deep clone do estado atual das colunas.
   *
   * ─── POR QUE DEEP CLONE? ───
   * O spread ([...arr]) faz shallow copy — objetos internos continuam
   * sendo a mesma referência. structuredClone() copia recursivamente,
   * garantindo que nenhuma operação altere o estado anterior.
   */
  private cloneColumns(): Column[] {
    return structuredClone(this.columnsSubject.getValue());
  }

  /** Retorna snapshot somente-leitura do estado atual */
  getColumns(): Column[] {
    return this.columnsSubject.getValue();
  }

  // ─── COLUNAS ──────────────────────────────────────────────

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
    const columns = this.cloneColumns();
    const colorIndex = columns.length % COLUMN_COLORS.length;
    const newColumn: Column = {
      id: generateId(),
      title,
      color: COLUMN_COLORS[colorIndex],
      tasks: [],
    };
    this.updateColumns([...columns, newColumn]);
  }

  /** Remove uma coluna pelo ID */
  deleteColumn(columnId: string): void {
    const columns = this.cloneColumns().filter(col => col.id !== columnId);
    this.updateColumns(columns);
  }

  /** Atualiza o título de uma coluna */
  updateColumnTitle(columnId: string, newTitle: string): void {
    const columns = this.cloneColumns();
    const col = columns.find(c => c.id === columnId);
    if (col) col.title = newTitle; // seguro pois é deep clone
    this.updateColumns(columns);
  }

  // ─── TAREFAS ──────────────────────────────────────────────

  /** Adiciona uma tarefa a uma coluna específica */
  addTask(columnId: string, title: string, description?: string, dueDate?: string, tags: Tag[] = [], dueTime?: string): void {
    const newTask: Task = {
      id: generateId(),
      title,
      description,
      dueDate,
      dueTime,
      tags,
      completed: false,
      createdAt: new Date().toISOString(),
      timerSeconds: 0,
      timerRunning: false,
      deadlineNotified: false,
    };
    const columns = this.cloneColumns();
    const col = columns.find(c => c.id === columnId);
    if (col) col.tasks = [...col.tasks, newTask];
    this.updateColumns(columns);
  }

  /** Remove uma tarefa de qualquer coluna */
  deleteTask(taskId: string): void {
    const columns = this.cloneColumns().map(col => ({
      ...col,
      tasks: col.tasks.filter(task => task.id !== taskId),
    }));
    this.updateColumns(columns);
  }

  /**
   * Atualiza uma tarefa existente (edição parcial imutável).
   * Se dueDate ou dueTime forem alterados, reseta deadlineNotified
   * para que a notificação possa ser disparada novamente.
   */
  updateTask(taskId: string, updates: Partial<Task>): void {
    const columns = this.cloneColumns().map(col => ({
      ...col,
      tasks: col.tasks.map(task => {
        if (task.id !== taskId) return task;

        // Se prazo mudou, resetar flag de notificação
        const deadlineChanged =
          ('dueDate' in updates && updates.dueDate !== task.dueDate) ||
          ('dueTime' in updates && updates.dueTime !== task.dueTime);

        return {
          ...task,
          ...updates,
          ...(deadlineChanged ? { deadlineNotified: false } : {}),
        };
      }),
    }));
    this.updateColumns(columns);
  }

  /** Marca ou desmarca uma tarefa como concluída */
  toggleTaskCompleted(taskId: string): void {
    const columns = this.cloneColumns().map(col => ({
      ...col,
      tasks: col.tasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      ),
    }));
    this.updateColumns(columns);
  }

  // ─── DRAG AND DROP (CDK moveItemInArray / transferArrayItem) ──

  /**
   * Reordena uma tarefa dentro da mesma coluna.
   *
   * Usa moveItemInArray() do CDK que internamente faz splice.
   * Seguro pois operamos sobre um deep clone — o estado original não é mutado.
   */
  moveTaskInSameColumn(columnId: string, previousIndex: number, currentIndex: number): void {
    if (previousIndex === currentIndex) return; // sem mudança, evita re-render
    const columns = this.cloneColumns();
    const col = columns.find(c => c.id === columnId);
    if (!col) return;
    moveItemInArray(col.tasks, previousIndex, currentIndex);
    this.updateColumns(columns);
  }

  /**
   * Move uma tarefa entre colunas diferentes.
   *
   * Usa transferArrayItem() do CDK que remove do array de origem
   * e insere no array de destino nas posições corretas.
   * Deep clone garante que os arrays originais não são mutados.
   */
  moveTaskBetweenColumns(
    fromColumnId: string,
    toColumnId: string,
    previousIndex: number,
    currentIndex: number
  ): void {
    const columns = this.cloneColumns();
    const fromCol = columns.find(c => c.id === fromColumnId);
    const toCol = columns.find(c => c.id === toColumnId);
    if (!fromCol || !toCol) return;

    transferArrayItem(fromCol.tasks, toCol.tasks, previousIndex, currentIndex);

    // Se a coluna de destino for "concluído", marca a tarefa como concluída
    // Se a coluna de origem era "concluído" e o destino não é, desmarca
    const isDestinationDone = toCol.title.toLowerCase().includes('conclu');
    const isOriginDone = fromCol.title.toLowerCase().includes('conclu');
    const movedTask = toCol.tasks[currentIndex];
    if (movedTask) {
      if (isDestinationDone && !movedTask.completed) {
        movedTask.completed = true;
      } else if (!isDestinationDone && isOriginDone && movedTask.completed) {
        movedTask.completed = false;
      }
    }

    this.updateColumns(columns);
  }

  /**
   * Método público para setar estado completo das colunas.
   * Útil para operações de drag complexas feitas diretamente no Board.
   */
  setColumns(columns: Column[]): void {
    this.updateColumns(columns);
  }

  // ─── TIMER ────────────────────────────────────────────────

  /** Incrementa o timer de uma tarefa em 1 segundo */
  incrementTimer(taskId: string): void {
    const columns = this.cloneColumns().map(col => ({
      ...col,
      tasks: col.tasks.map(task =>
        task.id === taskId ? { ...task, timerSeconds: task.timerSeconds + 1 } : task
      ),
    }));
    this.columnsSubject.next(columns);
    this.saveToStorage(columns);
  }

  // ─── PERSISTÊNCIA ─────────────────────────────────────────

  /** Carrega dados do localStorage */
  private loadFromStorage(): Column[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      console.error('Erro ao carregar dados do localStorage');
      return [];
    }
  }

  /** Salva dados no localStorage — chamado automaticamente a cada updateColumns */
  private saveToStorage(columns: Column[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(columns));
    } catch {
      console.error('Erro ao salvar dados no localStorage');
    }
  }

  /**
   * Atualiza o estado e persiste automaticamente.
   * Sempre emite um NOVO array via .next() — essencial para OnPush detectar a mudança.
   */
  private updateColumns(columns: Column[]): void {
    this.columnsSubject.next(columns);
    this.saveToStorage(columns);
  }
}
