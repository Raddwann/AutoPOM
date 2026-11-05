import { POMGeneratorOptions } from '../types';

export interface CodeGenerator {
  generatePOM(options: POMGeneratorOptions): string;
  getFileExtension(): string;
}

