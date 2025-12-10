import { Component, inject, computed } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { TradeService } from '../../services/trade.service';
import { ResourceId, RESOURCE_DEFINITIONS } from '../../models/resource.model';

@Component({
  selector: 'app-market-view',
  templateUrl: './market-view.component.html',
  styleUrl: './market-view.component.css'
})
export class MarketViewComponent {
  private gameState = inject(GameStateService);
  private tradeService = inject(TradeService);

  readonly credits = this.gameState.credits;
  readonly marketPrices = this.gameState.marketPrices;
  readonly selectedSystem = this.gameState.selectedSystem;

  selectedResource: ResourceId | null = null;
  tradeAmount = 100;

  readonly resourceList = computed(() => {
    const prices = this.marketPrices();
    return Object.entries(RESOURCE_DEFINITIONS)
      .filter(([id]) => id !== ResourceId.Credits)
      .map(([id, def]) => ({
        id: id as ResourceId,
        name: def.name,
        tier: def.tier,
        buyPrice: prices[id as ResourceId]?.buy ?? def.basePrice,
        sellPrice: prices[id as ResourceId]?.sell ?? Math.floor(def.basePrice * 0.8),
        inStock: this.getSystemStock(id as ResourceId)
      }))
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  });

  getSystemStock(resourceId: ResourceId): number {
    const system = this.selectedSystem();
    if (!system) return 0;
    return this.gameState.getSystemResource(system.id, resourceId);
  }

  selectResource(resourceId: ResourceId): void {
    this.selectedResource = resourceId;
    this.tradeAmount = 100;
  }

  buy(): void {
    const system = this.selectedSystem();
    if (!system || !this.selectedResource) return;

    this.tradeService.buyFromMarket(system.id, this.selectedResource, this.tradeAmount);
  }

  sell(): void {
    const system = this.selectedSystem();
    if (!system || !this.selectedResource) return;

    this.tradeService.sellToMarket(system.id, this.selectedResource, this.tradeAmount);
  }

  getBuyCost(): number {
    if (!this.selectedResource) return 0;
    const prices = this.marketPrices();
    return (prices[this.selectedResource]?.buy ?? 0) * this.tradeAmount;
  }

  getSellValue(): number {
    if (!this.selectedResource) return 0;
    const prices = this.marketPrices();
    return (prices[this.selectedResource]?.sell ?? 0) * this.tradeAmount;
  }

  canBuy(): boolean {
    return this.credits() >= this.getBuyCost() && this.tradeAmount > 0;
  }

  canSell(): boolean {
    if (!this.selectedResource) return false;
    return this.getSystemStock(this.selectedResource) >= this.tradeAmount && this.tradeAmount > 0;
  }

  setAmount(amount: number): void {
    this.tradeAmount = Math.max(1, amount);
  }

  sellAll(): void {
    if (!this.selectedResource) return;
    this.tradeAmount = this.getSystemStock(this.selectedResource);
  }
}
