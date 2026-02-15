import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
// Было: import { App } from './app/app';
// Стало:
import { AppComponent } from './app/app'; 

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));