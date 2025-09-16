export abstract class GameObject {
  lastTime: number;

  constructor() {
    this.lastTime = 0;
  }

  abstract update(currentTime: number): void;


}
