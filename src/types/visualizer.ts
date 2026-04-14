/**
 * Visualizer Types - Parity with web specs
 */

export type VisualizationType = 'sorting' | 'physics' | 'turtle' | 'loops' | 'stateMachine';

export interface CodeData {
  step: number;
  totalSteps: number;
  currentLine?: number;
  variables: Record<string, any>;
  visualizationState: any;
}
