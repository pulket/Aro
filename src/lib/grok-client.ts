import type { AskGrokInput, Prediction } from "../types";

export interface GrokCommandResponse {
  command: string;
  prediction: Prediction | null;
}

export type AskGrokCommand = (input: AskGrokInput) => Promise<string>;
