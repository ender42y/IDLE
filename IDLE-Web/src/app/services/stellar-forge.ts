import { Planet } from "../classes/planet";
import { StarSystem } from "../classes/star-system";

export class StellarForge {
  private constructor() {}

  /**
   * Generates a new StarSystem based on a starting location, direction, and randomness.
   * @param start { x: number, y: number, z: number } - Starting coordinates
   * @param direction { x: number, y: number, z: number } - Direction vector
   * @param randomness number - Amount of randomness to apply
   */
  static generateStarSystem(
    start: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    randomness: number = 5
  ): StarSystem {
    // Simple random offset
    const rand = () => (Math.random() - 0.5) * randomness;

    const x = start.x + direction.x + rand();
    const y = start.y + direction.y + rand();
    const z = start.z + direction.z + rand();

    // Generate a random name
    const name = this.generateStarSystemName();

    // For now, create an empty array of planets
    const bodies: Planet[] = [];

    return new StarSystem(name, bodies, x, y, z);
  }


  private static generateStarSystemName(): string {
    const greek = greekLetters[Math.floor(Math.random() * greekLetters.length)];
    const constellation = CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
    return `${greek}-${constellation}`;
  }

  private static planetBuilder() {
      // Step 1: Random number of planets (0 to 15)
    const numPlanets = Math.floor(Math.random() * 16);
    let toGas: number | undefined = undefined;
    let toIce: number | undefined = undefined;

    const bodies: Planet[] = []; // You will fill this in the next step

    if (numPlanets > 0) {
      toGas = Math.random() * 100;

      if (toGas < 65) {
        toIce = 70 + Math.random() * 30;
      }

    // calculate which bodies are before the toGas and toIce thresholds
    for (let i = 0; i < numPlanets; i++) {
      // Calculate the position percentage for this planet
      const percent = (i / (numPlanets - 1)) * 100;

      let type: string;
      if (percent < toGas) {
        type = "rocky";
      } else if (toIce !== undefined && percent >= toGas && percent < toIce) {
        type = "gas";
      } else if (toIce !== undefined && percent >= toIce) {
        type = "ice";
      } else {
        type = "gas";
      }

      // Example: create a new Planet with the type (adjust as needed for your Planet class)
      bodies.push(new Planet(type));
    }


  }
}

const greekLetters = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi", "Rho",
  "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega"
];

export const CONSTELLATIONS = [
  "Andromeda",  "Antlia",  "Apus", "Aquarius",  "Aquila",  "Ara",  "Aries",  "Auriga",
  "Boötes",  "Caelum",  "Camelopardalis",  "Cancer",  "Canes Venatici","Canis Major",
  "Canis Minor",  "Capricornus",  "Carina",  "Cassiopeia",  "Centaurus",  "Cepheus",  "Cetus",  "Chamaeleon",
  "Circinus",  "Columba",  "Coma Berenices",  "Corona Australis",  "Corona Borealis",  "Corvus",  "Crater",  "Crux",
  "Cygnus",  "Delphinus",  "Dorado",  "Draco",  "Equuleus",  "Eridanus",  "Fornax",  "Gemini",
  "Grus",  "Hercules",  "Horologium",  "Hydra",  "Hydrus",  "Indus",  "Lacerta",  "Leo",
  "Leo Minor",  "Lepus",  "Libra",  "Lupus",  "Lynx",  "Lyra",  "Mensa",  "Microscopium",
  "Monoceros",  "Musca",  "Norma",  "Octans",  "Ophiuchus",  "Orion",  "Pavo",  "Pegasus",
  "Perseus",  "Phoenix",  "Pictor",  "Pisces",  "Piscis Austrinus",  "Puppis",  "Pyxis",  "Reticulum",
  "Sagitta",  "Sagittarius",  "Scorpius",  "Sculptor",  "Scutum",  "Serpens",  "Sextans",  "Taurus",
  "Telescopium",  "Triangulum",  "Triangulum Australe",  "Tucana",
  "Ursa Major",  "Ursa Minor",  "Vela",  "Virgo",  "Volans",  "Vulpecula"
];
