export class Lazy<T extends NonNullable<any>> {

    private _value: T | undefined;

    constructor(private readonly init: () => T) {
    }

    get value(): T {
        if (this._value === undefined) {
            this._value = this.init();
        }
        return this._value;
    }
}
