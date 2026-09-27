import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type GravitySample = {
  x: CodegenTypes.Double;
  y: CodegenTypes.Double;
  z: CodegenTypes.Double;
};

export interface Spec extends TurboModule {
  isAvailable(): boolean;
  start(intervalMs: CodegenTypes.Double): void;
  stop(): void;
  readonly onGravity: CodegenTypes.EventEmitter<GravitySample>;
}

export default TurboModuleRegistry.get<Spec>('IcupMotion');
