/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export type Result<T, K> = ResultOk<T> | ResultErr<K>;

export namespace Result {

	export function isOk<T, K>(
		result: Result<T, K>
	): result is ResultOk<T> {
		return result instanceof ResultOk;
	}

	export function isErr<T, K>(
		result: Result<T, K>
	): result is ResultErr<K> {
		return result instanceof ResultErr;
	}

	export function ok<T>(value: T): ResultOk<T> {
		return new ResultOk(value);
	}

	export function err<K>(value: K): ResultErr<K> {
		return new ResultErr(value);
	}

	export function errFromString(message: string) {
		return new ResultErr(new Error(message));
	}
}

export class ResultOk<T> {
	constructor(readonly val: T) { }

	map<K>(f: (result: T) => K) {
		return new ResultOk(f(this.val));
	}

	flatMap<K>(f: (result: T) => Result<K, never>) {
		return f(this.val);
	}
}

export class ResultErr<K> {
	constructor(public readonly err: K) { }

	map(f: unknown) {
		return this;
	}

	flatMap(f: unknown) {
		return this;
	}
}
