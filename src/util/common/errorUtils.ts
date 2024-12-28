import { safeStringify } from '../vs/base/common/objects';

export function unknownToError(e: unknown, msgForNonErrorObjects?: string) {
	if (e instanceof Error) {
		return e;
	}
	return new Error(`${msgForNonErrorObjects} ${safeStringify(e)}`);
}

export function unknownErrorToString(e: unknown): string {
	if (e instanceof Error) {
		return e.stack === undefined ? e.message : e.stack;
	}
	return `Caught error: ${safeStringify(e)}`;
}
