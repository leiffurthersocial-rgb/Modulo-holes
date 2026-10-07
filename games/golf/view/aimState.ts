/** Mutable aim state shared between the input controller, the 3D aim visuals and the HUD. */
export interface AimState {
  active: boolean;
  dirX: number;
  dirZ: number;
  /** 0..1 */
  power: number;
  /** World point under the finger (for the elastic band). */
  dragX: number;
  dragZ: number;
  cancelled: boolean;
}

export const createAim = (): AimState => ({ active: false, dirX: 0, dirZ: -1, power: 0, dragX: 0, dragZ: 0, cancelled: false });
