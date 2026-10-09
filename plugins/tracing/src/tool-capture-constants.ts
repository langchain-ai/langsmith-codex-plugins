export const TURN_CAPTURE_SUFFIX = ".langsmith-capture-";
export const TURN_CAPTURE_LOCK_SUFFIX = ".langsmith-capture.lock";
export const TURN_CAPTURE_TRANSCRIPT = "transcript.jsonl";
export const TOOL_CAPTURE_START_SUFFIX = ".start.json";
export const TOOL_CAPTURE_END_SUFFIX = ".end.json";
export const TOOL_CAPTURE_FILE_PATTERN = /^[a-f0-9]{64}\.(start|end)\.json$/;
export const TURN_CAPTURE_STOP = "stop.json";
export const TURN_CAPTURE_PLAN = "metadata.json";
export const TOOL_CAPTURE_TEMP_PATTERN =
  /^(?:[a-f0-9]{64}\.(?:start|end)\.json|transcript\.jsonl|stop\.json|metadata\.json)\.[a-f0-9-]{36}\.tmp$/;
