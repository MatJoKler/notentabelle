import { describe, expect, test } from 'vitest';
import { generateRecoveryKey } from './recoveryKey';

describe('generateRecoveryKey', () => {
  test('Format: 4 Gruppen à 4 Zeichen, ohne verwechselbare Zeichen', () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
    expect(key).not.toMatch(/[O0I1]/);
  });

  test('zwei Schlüssel sind (praktisch) nie gleich', () => {
    expect(generateRecoveryKey()).not.toBe(generateRecoveryKey());
  });
});
