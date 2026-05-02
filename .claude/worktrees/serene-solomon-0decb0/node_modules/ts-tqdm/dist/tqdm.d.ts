export declare class _tqdmIterator implements Iterator<any> {
    private index;
    private done;
    private startTime;
    private progressBarSize;
    private values;
    constructor(init: Array<any> | number);
    next(): IteratorResult<boolean, any>;
    private formatTime;
    private genProgressBar;
    private render;
}
export declare class _tqdm {
    private init;
    constructor(init: Array<any> | number);
    [Symbol.iterator](): Iterator<any>;
}
export declare function tqdm(init: Array<any> | number): _tqdm;
