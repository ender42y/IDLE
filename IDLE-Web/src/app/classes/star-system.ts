import { GameObject } from "./game-object";
import { Planet } from "./planet";

export class StarSystem extends GameObject {
  name: string;
  bodies: Planet[];
  x: number;
  y: number;
  z: number;

  constructor(name: string, bodies: Planet[], x: number, y: number, z: number) {
    super();
    this.name = name;
    this.bodies = bodies;
    this.x = x;
    this.y = y;
    this.z = z;
  }

  update(currentTime: number): void {
    // Implement star system update logic here
  }
}
