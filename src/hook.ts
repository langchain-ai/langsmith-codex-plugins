import { Client } from "langsmith";
import { convertToRunTree } from "./upload.js";
import { readStdin } from "./utils/stdin.js";

async function main() {
  const content = await readStdin<{
    session_id: string;
    turn_id: string | null;
    transcript_path: string;
    hook_event_name: "UserPromptSubmit" | "Stop";
  }>();

  const client = new Client({
    apiKey: process.env.LANGSMITH_API_KEY,
    apiUrl: process.env.LANGSMITH_API_URL,
  });

  await convertToRunTree(content.transcript_path, { client });
}

main();
