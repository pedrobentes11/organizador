import { Component, Input, Output, EventEmitter, OnDestroy, OnChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, Tag, AVAILABLE_TAGS, buildDeadline } from '../../models/task.model';

/**
 * Componente que representa um card de tarefa individual.
 *
 * ─── POR QUE ONPUSH AQUI? ───
 * Cada card só re-renderiza quando o @Input task recebe nova referência.
 * Se 100 tarefas existem e 1 é editada, apenas aquele card é re-checado.
 * Para o timer (que atualiza a cada segundo), usamos ChangeDetectorRef
 * para marcar APENAS este card para re-check, sem afetar os demais.
 *
 * Responsabilidades:
 * - Exibir informações da tarefa (título, tags, data, timer)
 * - Permitir edição inline do título
 * - Controlar timer (iniciar/pausar)
 * - Emitir eventos para ações (editar, deletar, toggle)
 */
@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCardComponent implements OnChanges, OnDestroy {
  /** Tarefa exibida neste card */
  @Input({ required: true }) task!: Task;

  /** Evento emitido quando a tarefa é deletada */
  @Output() delete = new EventEmitter<string>();

  /** Evento emitido quando a tarefa é atualizada */
  @Output() update = new EventEmitter<{ id: string; updates: Partial<Task> }>();

  /** Evento emitido quando o toggle concluído é acionado */
  @Output() toggleCompleted = new EventEmitter<string>();

  /** Evento emitido quando o timer avança 1 segundo */
  @Output() timerTick = new EventEmitter<string>();

  /** Controla se está em modo edição inline */
  isEditing = false;

  /** Valor temporário do título em edição */
  editTitle = '';

  /** Controla visibilidade do menu de tags */
  showTagMenu = false;

  /** Referência do intervalo do timer */
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  /** Tags disponíveis para seleção */
  availableTags = AVAILABLE_TAGS;

  /**
   * Cache do resultado de isOverdue para evitar recalcular no template.
   * Atualizado quando o @Input task muda.
   */
  cachedOverdue = false;

  /**
   * Texto de countdown até o prazo (ex: "2h 30min" ou "Expirada há 1h").
   * Atualizado no ngOnChanges e a cada segundo se o timer estiver rodando.
   */
  cachedCountdown = '';

  /**
   * Flag para indicar urgência extrema (menos de 1 hora para o prazo).
   * Usada para aplicar animação de pulse no card.
   */
  cachedUrgent = false;

  constructor(private cdr: ChangeDetectorRef) {}

  /** Atualiza caches quando o input task muda */
  ngOnChanges(): void {
    this.cachedOverdue = this.computeOverdue();
    this.cachedCountdown = this.computeCountdown();
    this.cachedUrgent = this.computeUrgent();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  /** Inicia o modo de edição do título */
  startEditing(): void {
    this.isEditing = true;
    this.editTitle = this.task.title;
  }

  /** Salva o título editado */
  saveEdit(): void {
    const trimmed = this.editTitle.trim();
    if (trimmed && trimmed !== this.task.title) {
      this.update.emit({ id: this.task.id, updates: { title: trimmed } });
    }
    this.isEditing = false;
  }

  /** Cancela a edição */
  cancelEdit(): void {
    this.isEditing = false;
  }

  /** Trata teclas durante a edição (Enter salva, Escape cancela) */
  onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.saveEdit();
    } else if (event.key === 'Escape') {
      this.cancelEdit();
    }
  }

  /** Emite evento para deletar a tarefa */
  onDelete(): void {
    this.delete.emit(this.task.id);
  }

  /** Emite evento para toggle de concluído */
  onToggleCompleted(): void {
    this.toggleCompleted.emit(this.task.id);
  }

  /** Alterna a presença de uma tag na tarefa */
  toggleTag(tag: Tag): void {
    const hasTags = this.task.tags.some(t => t.name === tag.name);
    const newTags = hasTags
      ? this.task.tags.filter(t => t.name !== tag.name)
      : [...this.task.tags, tag];
    this.update.emit({ id: this.task.id, updates: { tags: newTags } });
  }

  /** Verifica se uma tag está ativa na tarefa */
  hasTag(tagName: string): boolean {
    return this.task.tags.some(t => t.name === tagName);
  }

  /** Atualiza a data de vencimento */
  onDueDateChange(dateStr: string): void {
    this.update.emit({
      id: this.task.id,
      updates: { dueDate: dateStr || undefined, deadlineNotified: false },
    });
  }

  /** Atualiza o horário de vencimento */
  onDueTimeChange(timeStr: string): void {
    this.update.emit({
      id: this.task.id,
      updates: { dueTime: timeStr || undefined, deadlineNotified: false },
    });
  }

  /** Inicia ou pausa o timer da tarefa */
  toggleTimer(): void {
    if (this.task.timerRunning) {
      this.stopTimer();
      this.update.emit({ id: this.task.id, updates: { timerRunning: false } });
    } else {
      this.startTimer();
      this.update.emit({ id: this.task.id, updates: { timerRunning: true } });
    }
  }

  /**
   * Inicia o timer com intervalo de 1 segundo.
   * Usa markForCheck() para notificar OnPush que este card específico
   * precisa ser re-renderizado — sem afetar os demais cards.
   */
  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.timerTick.emit(this.task.id);
      // Atualiza countdown a cada tick também
      this.cachedCountdown = this.computeCountdown();
      this.cachedOverdue = this.computeOverdue();
      this.cachedUrgent = this.computeUrgent();
      this.cdr.markForCheck(); // força re-check apenas deste card
    }, 1000);
  }

  /** Para o timer */
  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /** Formata os segundos em HH:MM:SS */
  formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
  }

  /** Adiciona zero à esquerda */
  private pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  /** Calcula se o prazo já passou (considerando horário) */
  private computeOverdue(): boolean {
    if (!this.task.dueDate || this.task.completed) return false;
    const deadline = buildDeadline(this.task.dueDate, this.task.dueTime);
    return deadline ? new Date() > deadline : false;
  }

  /**
   * Calcula texto de countdown até o prazo.
   * Ex: "2h 30min restantes", "Expirada há 45min"
   */
  private computeCountdown(): string {
    if (!this.task.dueDate || this.task.completed) return '';
    const deadline = buildDeadline(this.task.dueDate, this.task.dueTime);
    if (!deadline) return '';

    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const absDiff = Math.abs(diffMs);

    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

    let timeStr = '';
    if (days > 0) timeStr += `${days}d `;
    if (hours > 0) timeStr += `${hours}h `;
    if (minutes > 0 && days === 0) timeStr += `${minutes}min`;
    if (!timeStr) timeStr = '< 1min';

    return diffMs > 0
      ? `${timeStr.trim()} restantes`
      : `Expirada há ${timeStr.trim()}`;
  }

  /**
   * Verifica se a tarefa está em estado de urgência extrema
   * (menos de 1 hora para o prazo e ainda não expirada/concluída).
   */
  private computeUrgent(): boolean {
    if (!this.task.dueDate || this.task.completed) return false;
    const deadline = buildDeadline(this.task.dueDate, this.task.dueTime);
    if (!deadline) return false;

    const diffMs = deadline.getTime() - new Date().getTime();
    return diffMs > 0 && diffMs < 60 * 60 * 1000; // menos de 1 hora
  }

  /** Fecha o menu de tags */
  closeTagMenu(): void {
    this.showTagMenu = false;
  }
}
