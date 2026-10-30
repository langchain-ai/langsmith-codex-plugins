import type { SetupOutcome } from "@langchain/plugins-base/settings";

export type SetupCredential = Pick<
  SetupOutcome,
  "apiUrl" | "signIn" | "credentialProblem" | "replicaCount"
>;
