import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Componente raiz da aplicação.
 * Usa router-outlet para navegação entre login e board.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [':host { display: block; height: 100vh; }'],
})
export class AppComponent {}
