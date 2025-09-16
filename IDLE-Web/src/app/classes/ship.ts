import { GameObject } from "./game-object";

export class Ship extends GameObject {
  constructor() {
    super();
  }

  update(currentTime: number): void {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Update ship position, velocity, etc. using deltaTime
  }
}
