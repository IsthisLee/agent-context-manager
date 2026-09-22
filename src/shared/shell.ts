/**
 * An argument as it would be typed into the shell of this platform: bare when it holds only characters that shell
 * reads literally, double-quoted otherwise. POSIX shells escape `"`, `\`, `$`, and backquotes inside the quotes;
 * cmd.exe and PowerShell treat a backslash as a path separator and double a quote instead.
 */
export function shellWord(word: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') return /^[\w@%+=:,./\\~-]+$/.test(word) ? word : `"${word.replace(/"/g, '""')}"`;
  return /^[\w@%+=:,./-]+$/.test(word) ? word : `"${word.replace(/["\\$`]/g, '\\$&')}"`;
}
