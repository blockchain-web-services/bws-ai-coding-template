/**
 * Unit Test Example
 *
 * Unit tests should test individual functions or modules in isolation
 * without external dependencies (no database, no network calls)
 */

import { describe, it, expect } from 'vitest';

describe('Example Unit Tests', () => {
    it('should perform basic assertions', () => {
        expect(true).toBe(true);
        expect(1 + 1).toBe(2);
        expect('hello').toBe('hello');
    });

    it('should test arrays', () => {
        const arr = [1, 2, 3];
        expect(arr).toHaveLength(3);
        expect(arr).toContain(2);
        expect(arr).toEqual([1, 2, 3]);
    });

    it('should test objects', () => {
        const obj = { name: 'Test', value: 42 };
        expect(obj).toHaveProperty('name');
        expect(obj.name).toBe('Test');
        expect(obj).toEqual({ name: 'Test', value: 42 });
    });

    it('should handle async operations', async () => {
        const asyncFunction = async () => {
            return new Promise((resolve) => {
                setTimeout(() => resolve('done'), 10);
            });
        };

        const result = await asyncFunction();
        expect(result).toBe('done');
    });

    it('should handle errors', () => {
        const throwError = () => {
            throw new Error('Test error');
        };

        expect(throwError).toThrow('Test error');
    });
});
