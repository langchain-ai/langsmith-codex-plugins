import type { CodingAgentMetadataOptions } from "@langchain/plugins-base/metadata";

export type TurnMetadataOptions = Omit<CodingAgentMetadataOptions, "runType">;
