import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { signal, WritableSignal } from '@angular/core';
import { MarketViewComponent } from './market-view.component';
import { GameStateService } from '../../services/game-state.service';
import { TradeService } from '../../services/trade.service';
import { ResourceId, RESOURCE_DEFINITIONS } from '../../models/resource.model';
import { StarSystem, SystemRarity, SystemState } from '../../models/star-system.model';

describe('MarketViewComponent', () => {
  let component: MarketViewComponent;
  let fixture: ComponentFixture<MarketViewComponent>;
  let gameStateServiceSpy: jasmine.SpyObj<GameStateService>;
  let tradeServiceSpy: jasmine.SpyObj<TradeService>;

  let creditsSignal: WritableSignal<number>;
  let marketPricesSignal: WritableSignal<Partial<Record<ResourceId, { buy: number; sell: number }>>>;
  let selectedSystemSignal: WritableSignal<StarSystem | null>;

  const mockSystem: StarSystem = {
    id: 'test-system',
    name: 'Test System',
    coordinates: { x: 0, y: 0 },
    rarity: SystemRarity.Common,
    discovered: true,
    surveyed: true,
    bodyIds: [],
    stellarSlots: 1,
    state: SystemState.Stable,
    totalPopulation: 1000,
    techLevel: 1,
    securityLevel: 50,
    standardOfLiving: 50,
    resources: [],
    storageCapacity: 10000,
    hasTradeStation: true,
    tradeStationTier: 1,
    colonized: true
  };

  const mockMarketPrices: Partial<Record<ResourceId, { buy: number; sell: number }>> = {
    [ResourceId.IronOre]: { buy: 5, sell: 4 },
    [ResourceId.Steel]: { buy: 12, sell: 9 },
    [ResourceId.Fuel]: { buy: 25, sell: 20 }
  };

  beforeEach(async () => {
    // Create writable signals that can be updated in tests
    creditsSignal = signal(10000);
    marketPricesSignal = signal(mockMarketPrices);
    selectedSystemSignal = signal(mockSystem);

    const gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'getSystemResource',
      'addNotification'
    ]);
    const tradeSpy = jasmine.createSpyObj('TradeService', [
      'buyFromMarket',
      'sellToMarket'
    ]);

    await TestBed.configureTestingModule({
      declarations: [MarketViewComponent],
      imports: [FormsModule],
      providers: [
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: TradeService, useValue: tradeSpy }
      ]
    }).compileComponents();

    gameStateServiceSpy = TestBed.inject(GameStateService) as jasmine.SpyObj<GameStateService>;
    tradeServiceSpy = TestBed.inject(TradeService) as jasmine.SpyObj<TradeService>;

    // Setup signal returns using writable signals
    Object.defineProperty(gameStateServiceSpy, 'credits', {
      get: () => creditsSignal.asReadonly()
    });
    Object.defineProperty(gameStateServiceSpy, 'marketPrices', {
      get: () => marketPricesSignal.asReadonly()
    });
    Object.defineProperty(gameStateServiceSpy, 'selectedSystem', {
      get: () => selectedSystemSignal.asReadonly()
    });

    gameStateServiceSpy.getSystemResource.and.returnValue(500);

    fixture = TestBed.createComponent(MarketViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should initialize with no selected resource', () => {
      expect(component.selectedResource).toBeNull();
    });

    it('should initialize with default trade amount of 100', () => {
      expect(component.tradeAmount).toBe(100);
    });

    it('should inject required services', () => {
      expect(component['gameState']).toBeDefined();
      expect(component['tradeService']).toBeDefined();
    });

    it('should expose readonly signals from GameStateService', () => {
      expect(component.credits()).toBe(10000);
      const prices = component.marketPrices();
      expect(prices[ResourceId.IronOre]).toEqual({ buy: 5, sell: 4 });
      expect(prices[ResourceId.Steel]).toEqual({ buy: 12, sell: 9 });
      expect(component.selectedSystem()).toEqual(mockSystem);
    });
  });

  describe('resourceList computed signal', () => {
    it('should filter out Credits resource', () => {
      const resources = component.resourceList();
      const hasCredits = resources.some(r => r.id === ResourceId.Credits);
      expect(hasCredits).toBe(false);
    });

    it('should map resource definitions with market prices', () => {
      const resources = component.resourceList();
      const ironOre = resources.find(r => r.id === ResourceId.IronOre);

      expect(ironOre).toBeDefined();
      expect(ironOre?.name).toBe('Iron Ore');
      expect(ironOre?.tier).toBe(1);
      expect(ironOre?.buyPrice).toBe(5);
      expect(ironOre?.sellPrice).toBe(4);
    });

    it('should use base price when market price not available', () => {
      marketPricesSignal.set({});
      fixture.detectChanges();

      const resources = component.resourceList();
      const ironOre = resources.find(r => r.id === ResourceId.IronOre);

      expect(ironOre?.buyPrice).toBe(RESOURCE_DEFINITIONS[ResourceId.IronOre].basePrice);
      expect(ironOre?.sellPrice).toBe(Math.floor(RESOURCE_DEFINITIONS[ResourceId.IronOre].basePrice * 0.8));
    });

    it('should include system stock for each resource', () => {
      const resources = component.resourceList();
      const ironOre = resources.find(r => r.id === ResourceId.IronOre);

      expect(ironOre?.inStock).toBe(500);
    });

    it('should sort resources by tier then name', () => {
      const resources = component.resourceList();

      for (let i = 0; i < resources.length - 1; i++) {
        const current = resources[i];
        const next = resources[i + 1];

        if (current.tier === next.tier) {
          expect(current.name.localeCompare(next.name)).toBeLessThanOrEqual(0);
        } else {
          expect(current.tier).toBeLessThanOrEqual(next.tier);
        }
      }
    });
  });

  describe('getSystemStock', () => {
    it('should return resource amount from selected system', () => {
      const stock = component.getSystemStock(ResourceId.IronOre);
      expect(stock).toBe(500);
      expect(gameStateServiceSpy.getSystemResource).toHaveBeenCalledWith('test-system', ResourceId.IronOre);
    });

    it('should return 0 when no system is selected', () => {
      selectedSystemSignal.set(null);
      fixture.detectChanges();

      const stock = component.getSystemStock(ResourceId.IronOre);
      expect(stock).toBe(0);
    });

    it('should handle different resource IDs', () => {
      gameStateServiceSpy.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        const stocks: Partial<Record<ResourceId, number>> = {
          [ResourceId.IronOre]: 100,
          [ResourceId.Steel]: 200,
          [ResourceId.Fuel]: 300
        };
        return stocks[resourceId] ?? 0;
      });

      expect(component.getSystemStock(ResourceId.IronOre)).toBe(100);
      expect(component.getSystemStock(ResourceId.Steel)).toBe(200);
      expect(component.getSystemStock(ResourceId.Fuel)).toBe(300);
    });
  });

  describe('selectResource', () => {
    it('should set selectedResource to the provided resource ID', () => {
      component.selectResource(ResourceId.IronOre);
      expect(component.selectedResource).toBe(ResourceId.IronOre);
    });

    it('should reset tradeAmount to 100', () => {
      component.tradeAmount = 500;
      component.selectResource(ResourceId.Steel);
      expect(component.tradeAmount).toBe(100);
    });

    it('should allow selecting different resources', () => {
      component.selectResource(ResourceId.IronOre);
      expect(component.selectedResource).toBe(ResourceId.IronOre);

      component.selectResource(ResourceId.Steel);
      expect(component.selectedResource).toBe(ResourceId.Steel);
    });
  });

  describe('buy', () => {
    beforeEach(() => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;
    });

    it('should call tradeService.buyFromMarket with correct parameters', () => {
      component.buy();

      expect(tradeServiceSpy.buyFromMarket).toHaveBeenCalledWith(
        'test-system',
        ResourceId.IronOre,
        100
      );
    });

    it('should return early when no system is selected', () => {
      selectedSystemSignal.set(null);
      fixture.detectChanges();

      component.buy();

      expect(tradeServiceSpy.buyFromMarket).not.toHaveBeenCalled();
    });

    it('should return early when no resource is selected', () => {
      component.selectedResource = null;

      component.buy();

      expect(tradeServiceSpy.buyFromMarket).not.toHaveBeenCalled();
    });

    it('should handle different trade amounts', () => {
      component.tradeAmount = 500;
      component.buy();

      expect(tradeServiceSpy.buyFromMarket).toHaveBeenCalledWith(
        'test-system',
        ResourceId.IronOre,
        500
      );
    });
  });

  describe('sell', () => {
    beforeEach(() => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;
    });

    it('should call tradeService.sellToMarket with correct parameters', () => {
      component.sell();

      expect(tradeServiceSpy.sellToMarket).toHaveBeenCalledWith(
        'test-system',
        ResourceId.IronOre,
        100
      );
    });

    it('should return early when no system is selected', () => {
      selectedSystemSignal.set(null);
      fixture.detectChanges();

      component.sell();

      expect(tradeServiceSpy.sellToMarket).not.toHaveBeenCalled();
    });

    it('should return early when no resource is selected', () => {
      component.selectedResource = null;

      component.sell();

      expect(tradeServiceSpy.sellToMarket).not.toHaveBeenCalled();
    });

    it('should handle different trade amounts', () => {
      component.tradeAmount = 250;
      component.sell();

      expect(tradeServiceSpy.sellToMarket).toHaveBeenCalledWith(
        'test-system',
        ResourceId.IronOre,
        250
      );
    });
  });

  describe('getBuyCost', () => {
    beforeEach(() => {
      component.selectedResource = ResourceId.IronOre;
    });

    it('should calculate buy cost correctly', () => {
      component.tradeAmount = 100;
      const cost = component.getBuyCost();
      expect(cost).toBe(500); // 5 credits × 100 units
    });

    it('should return 0 when no resource is selected', () => {
      component.selectedResource = null;
      expect(component.getBuyCost()).toBe(0);
    });

    it('should handle different trade amounts', () => {
      component.tradeAmount = 250;
      const cost = component.getBuyCost();
      expect(cost).toBe(1250); // 5 credits × 250 units
    });

    it('should use 0 when market price not available', () => {
      marketPricesSignal.set({});
      fixture.detectChanges();

      const cost = component.getBuyCost();
      expect(cost).toBe(0);
    });

    it('should handle fractional amounts correctly', () => {
      component.selectedResource = ResourceId.Steel;
      component.tradeAmount = 150;
      const cost = component.getBuyCost();
      expect(cost).toBe(1800); // 12 credits × 150 units
    });
  });

  describe('getSellValue', () => {
    beforeEach(() => {
      component.selectedResource = ResourceId.IronOre;
    });

    it('should calculate sell value correctly', () => {
      component.tradeAmount = 100;
      const value = component.getSellValue();
      expect(value).toBe(400); // 4 credits × 100 units
    });

    it('should return 0 when no resource is selected', () => {
      component.selectedResource = null;
      expect(component.getSellValue()).toBe(0);
    });

    it('should handle different trade amounts', () => {
      component.tradeAmount = 300;
      const value = component.getSellValue();
      expect(value).toBe(1200); // 4 credits × 300 units
    });

    it('should use 0 when market price not available', () => {
      marketPricesSignal.set({});
      fixture.detectChanges();

      const value = component.getSellValue();
      expect(value).toBe(0);
    });

    it('should handle higher tier resources', () => {
      component.selectedResource = ResourceId.Fuel;
      component.tradeAmount = 50;
      const value = component.getSellValue();
      expect(value).toBe(1000); // 20 credits × 50 units
    });
  });

  describe('canBuy', () => {
    beforeEach(() => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;
    });

    it('should return true when player has enough credits', () => {
      creditsSignal.set(1000);
      fixture.detectChanges();

      expect(component.canBuy()).toBe(true);
    });

    it('should return false when player has insufficient credits', () => {
      creditsSignal.set(100);
      fixture.detectChanges();

      expect(component.canBuy()).toBe(false);
    });

    it('should return false when trade amount is 0', () => {
      component.tradeAmount = 0;
      expect(component.canBuy()).toBe(false);
    });

    it('should return false when trade amount is negative', () => {
      component.tradeAmount = -100;
      expect(component.canBuy()).toBe(false);
    });

    it('should handle exact credit match', () => {
      creditsSignal.set(500);
      fixture.detectChanges();

      expect(component.canBuy()).toBe(true);
    });

    it('should return true for amounts greater than required', () => {
      creditsSignal.set(10000);
      fixture.detectChanges();

      expect(component.canBuy()).toBe(true);
    });
  });

  describe('canSell', () => {
    beforeEach(() => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;
      gameStateServiceSpy.getSystemResource.and.returnValue(500);
    });

    it('should return true when system has enough stock', () => {
      expect(component.canSell()).toBe(true);
    });

    it('should return false when system has insufficient stock', () => {
      gameStateServiceSpy.getSystemResource.and.returnValue(50);
      expect(component.canSell()).toBe(false);
    });

    it('should return false when no resource is selected', () => {
      component.selectedResource = null;
      expect(component.canSell()).toBe(false);
    });

    it('should return false when trade amount is 0', () => {
      component.tradeAmount = 0;
      expect(component.canSell()).toBe(false);
    });

    it('should return false when trade amount is negative', () => {
      component.tradeAmount = -100;
      expect(component.canSell()).toBe(false);
    });

    it('should handle exact stock match', () => {
      gameStateServiceSpy.getSystemResource.and.returnValue(100);
      expect(component.canSell()).toBe(true);
    });

    it('should return true for stock greater than amount', () => {
      gameStateServiceSpy.getSystemResource.and.returnValue(1000);
      expect(component.canSell()).toBe(true);
    });
  });

  describe('setAmount', () => {
    it('should set trade amount to provided value', () => {
      component.setAmount(250);
      expect(component.tradeAmount).toBe(250);
    });

    it('should enforce minimum of 1', () => {
      component.setAmount(0);
      expect(component.tradeAmount).toBe(1);
    });

    it('should enforce minimum for negative values', () => {
      component.setAmount(-50);
      expect(component.tradeAmount).toBe(1);
    });

    it('should allow large amounts', () => {
      component.setAmount(10000);
      expect(component.tradeAmount).toBe(10000);
    });

    it('should handle fractional values by flooring to minimum', () => {
      component.setAmount(0.5);
      expect(component.tradeAmount).toBe(1);
    });
  });

  describe('sellAll', () => {
    it('should set trade amount to system stock', () => {
      component.selectedResource = ResourceId.IronOre;
      gameStateServiceSpy.getSystemResource.and.returnValue(750);

      component.sellAll();

      expect(component.tradeAmount).toBe(750);
    });

    it('should return early when no resource is selected', () => {
      component.selectedResource = null;
      component.tradeAmount = 100;

      component.sellAll();

      expect(component.tradeAmount).toBe(100);
    });

    it('should handle zero stock', () => {
      component.selectedResource = ResourceId.IronOre;
      gameStateServiceSpy.getSystemResource.and.returnValue(0);

      component.sellAll();

      expect(component.tradeAmount).toBe(0);
    });

    it('should update for different resources', () => {
      gameStateServiceSpy.getSystemResource.and.callFake((systemId: string, resourceId: ResourceId) => {
        const stocks: Partial<Record<ResourceId, number>> = {
          [ResourceId.IronOre]: 100,
          [ResourceId.Steel]: 500
        };
        return stocks[resourceId] ?? 0;
      });

      component.selectedResource = ResourceId.IronOre;
      component.sellAll();
      expect(component.tradeAmount).toBe(100);

      component.selectedResource = ResourceId.Steel;
      component.sellAll();
      expect(component.tradeAmount).toBe(500);
    });
  });

  describe('Template Integration', () => {
    it('should render market header', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const header = compiled.querySelector('.market-header h2');
      expect(header?.textContent).toContain('Galactic Market');
    });

    it('should display current credits when resource is selected', () => {
      component.selectedResource = ResourceId.IronOre;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const balance = compiled.querySelector('.current-balance strong');
      expect(balance?.textContent).toContain('10,000');
    });

    it('should display no selection message when no resource selected', () => {
      component.selectedResource = null;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const noSelection = compiled.querySelector('.no-selection p');
      expect(noSelection?.textContent).toContain('Select a resource to trade');
    });

    it('should display trade form when resource is selected', () => {
      component.selectedResource = ResourceId.IronOre;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const tradeForm = compiled.querySelector('.trade-form');
      expect(tradeForm).toBeTruthy();
    });

    it('should disable buy button when cannot buy', () => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;
      creditsSignal.set(10);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const buyButton = compiled.querySelector('.buy-btn') as HTMLButtonElement;
      expect(buyButton.disabled).toBe(true);
    });

    it('should enable buy button when can buy', () => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;
      creditsSignal.set(10000);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const buyButton = compiled.querySelector('.buy-btn') as HTMLButtonElement;
      expect(buyButton.disabled).toBe(false);
    });

    it('should disable sell button when cannot sell', () => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;
      gameStateServiceSpy.getSystemResource.and.returnValue(50);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const sellButton = compiled.querySelector('.sell-btn') as HTMLButtonElement;
      expect(sellButton.disabled).toBe(true);
    });

    it('should enable sell button when can sell', () => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;
      gameStateServiceSpy.getSystemResource.and.returnValue(500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const sellButton = compiled.querySelector('.sell-btn') as HTMLButtonElement;
      expect(sellButton.disabled).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined market prices gracefully', () => {
      marketPricesSignal.set({} as any);
      fixture.detectChanges();

      const resources = component.resourceList();
      expect(resources.length).toBeGreaterThan(0);
    });

    it('should handle multiple rapid resource selections', () => {
      component.selectResource(ResourceId.IronOre);
      component.selectResource(ResourceId.Steel);
      component.selectResource(ResourceId.Fuel);

      expect(component.selectedResource).toBe(ResourceId.Fuel);
      expect(component.tradeAmount).toBe(100);
    });

    it('should handle amount changes during buy/sell operations', () => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;

      component.buy();
      component.tradeAmount = 200;
      component.sell();

      expect(tradeServiceSpy.buyFromMarket).toHaveBeenCalledWith('test-system', ResourceId.IronOre, 100);
      expect(tradeServiceSpy.sellToMarket).toHaveBeenCalledWith('test-system', ResourceId.IronOre, 200);
    });

    it('should handle very large trade amounts', () => {
      component.selectedResource = ResourceId.IronOre;
      component.setAmount(1000000);

      expect(component.tradeAmount).toBe(1000000);
      expect(component.getBuyCost()).toBe(5000000);
    });

    it('should recalculate costs when resource selection changes', () => {
      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 100;
      const cost1 = component.getBuyCost();

      component.selectedResource = ResourceId.Steel;
      const cost2 = component.getBuyCost();

      expect(cost1).toBe(500); // Iron: 5 × 100
      expect(cost2).toBe(1200); // Steel: 12 × 100
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle zero credits when checking canBuy', () => {
      creditsSignal.set(0);
      fixture.detectChanges();

      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 1;

      expect(component.canBuy()).toBe(false);
    });

    it('should handle zero stock when checking canSell', () => {
      gameStateServiceSpy.getSystemResource.and.returnValue(0);

      component.selectedResource = ResourceId.IronOre;
      component.tradeAmount = 1;

      expect(component.canSell()).toBe(false);
    });

    it('should handle minimum trade amount of 1', () => {
      component.selectedResource = ResourceId.IronOre;
      component.setAmount(1);

      expect(component.tradeAmount).toBe(1);
      expect(component.getBuyCost()).toBe(5);
      expect(component.getSellValue()).toBe(4);
    });

    it('should handle selling maximum available stock', () => {
      gameStateServiceSpy.getSystemResource.and.returnValue(1000);
      component.selectedResource = ResourceId.IronOre;
      component.sellAll();

      expect(component.tradeAmount).toBe(1000);
      expect(component.canSell()).toBe(true);
    });
  });
});
