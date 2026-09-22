/**
 * 이 플랫폼의 셸에 입력하는 형태의 인자. 그 셸이 글자 그대로 읽는 문자만 있으면 따옴표 없이,
 * 아니면 큰따옴표로 감싼다. POSIX 셸은 따옴표 안에서 `"`, `\`, `$`, 백쿼트를 이스케이프하고,
 * cmd.exe와 PowerShell은 역슬래시를 경로 구분자로 보고 따옴표는 두 번 써서 나타낸다.
 */
export function shellWord(word: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') return /^[\w@%+=:,./\\~-]+$/.test(word) ? word : `"${word.replace(/"/g, '""')}"`;
  return /^[\w@%+=:,./-]+$/.test(word) ? word : `"${word.replace(/["\\$`]/g, '\\$&')}"`;
}
