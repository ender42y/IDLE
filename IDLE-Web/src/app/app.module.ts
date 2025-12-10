import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// View Components
import { SystemViewComponent } from './components/system-view/system-view.component';
import { GalaxyViewComponent } from './components/galaxy-view/galaxy-view.component';
import { FleetViewComponent } from './components/fleet-view/fleet-view.component';
import { MarketViewComponent } from './components/market-view/market-view.component';

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
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
