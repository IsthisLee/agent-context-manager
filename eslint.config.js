import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(js.configs.recommended, tseslint.configs.recommended, {
  rules: {
    // 읽기에 실패하면 기본값으로 넘어가는 `catch {}`는 이 저장소의 관례다.
    'no-empty': ['error', { allowEmptyCatch: true }],
    // `{ field: _field, ...rest }`는 필드를 빼려고 쓰는 구조 분해다.
    '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }]
  }
});
