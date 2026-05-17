declare module 'node:test' {
  type TestCallback = () => void | Promise<void>;
  export default function test(name: string, callback: TestCallback): void;
}

declare module 'node:assert/strict' {
  export function equal(actual: unknown, expected: unknown, message?: string): void;
  export function deepEqual(actual: unknown, expected: unknown, message?: string): void;

  const assert: {
    equal: typeof equal;
    deepEqual: typeof deepEqual;
  };

  export default assert;
}
