import type { Config } from "./config.js";

export interface TurnEvidence {
  config?: Config;
  reply?: string;
  failure?: string;
}
