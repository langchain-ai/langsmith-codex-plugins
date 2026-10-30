import { SENTENCE_END } from "../constants.js";

export function endSentence(text: string): string {
  return text.endsWith(SENTENCE_END) ? text : `${text}${SENTENCE_END}`;
}
