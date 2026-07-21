export function buildQuizPrompt(traits) {
  return `Recommend a pet profile for traits: ${JSON.stringify(traits)}`;
}
