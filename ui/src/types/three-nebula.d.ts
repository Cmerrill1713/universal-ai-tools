declare module 'three-nebula' {
  import * as THREE from 'three';

  export class System {
    constructor();
    update(delta: number): void;
    addEmitter(emitter: Emitter): void;
    addRenderer(renderer: Renderer): void;
    destroy(): void;
  }

  export class Emitter {
    constructor();
    setRate(rate: Rate): void;
    setPosition(position: Position): void;
    addInitializer(initializer: any): void;
    addBehaviour(behaviour: any): void;
  }

  export class Rate {
    constructor(numPan: Span, timePan: Span);
  }

  export class Span {
    constructor(a: number | THREE.Vector3, b?: number | THREE.Vector3);
  }

  export class Position {
    constructor(zone: any);
  }

  export class Velocity extends Initializer {
    constructor(velocitySpan: Span, zone: any);
  }

  export class Mass extends Initializer {
    constructor(mass: number);
  }

  export class Radius extends Initializer {
    constructor(radiusA: number, radiusB: number);
  }

  export class Life extends Initializer {
    constructor(lifeA: number, lifeB: number);
  }

  export class Color extends Initializer {
    constructor(color: THREE.Color);
  }

  export class Alpha extends Behaviour {
    constructor(alphaA: number, alphaB: number);
  }

  export class Scale extends Behaviour {
    constructor(scaleA: number, scaleB: number);
  }

  export class Gravity extends Behaviour {
    constructor(gravity: number);
  }

  export class SpriteRenderer extends Renderer {
    constructor(scene: THREE.Scene, material: THREE.SpriteMaterial);
  }

  export class Renderer {
    constructor();
  }

  export class Initializer {
    constructor();
  }

  export class Behaviour {
    constructor();
  }

  export function SphereZone(x: number, y: number, z: number, radius: number): any;
}