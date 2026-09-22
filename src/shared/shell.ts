/** An argument as it would be typed into a shell: quoted when it holds a space or a character the shell reads. */
export function shellWord(word: string): string {
  return /^[\w@%+=:,./-]+$/.test(word) ? word : `"${word.replace(/["\\$`]/g, '\\$&')}"`;
}
