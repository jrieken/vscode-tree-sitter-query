export type Offset = {
	offset: number;
	length: number;
};

export type WithOffset<T> = T extends object ? T & Offset : { value: T } & Offset;
