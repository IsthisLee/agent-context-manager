import { isCancel } from '@clack/prompts';

/**
 * 프롬프트는 `T | symbol`로 끝나지만 clack의 `isCancel`은 자기 고유 취소 심볼만 좁히고 `symbol`을
 * 타입에 남긴다. 어떤 심볼이든 좁혀서 없앤다.
 */
export function cancelled(value: unknown): value is symbol {
  return isCancel(value);
}
