import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// View Components
import { SystemViewComponent } from './components/system-view/system-view.component';
import { GalaxyViewComponent } from './components/galaxy-view/galaxy-view.component';
import { FleetViewComponent } from './components/fleet-view/fleet-view.component';
import { MarketViewComponent } from './components/market-view/market-view.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

@NgModule({
  declarations: [
    AppComponent,
    SystemViewComponent,
    GalaxyViewComponent,
    FleetViewComponent,
    MarketViewComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  providers: [
    provideAnimationsAsync()
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
