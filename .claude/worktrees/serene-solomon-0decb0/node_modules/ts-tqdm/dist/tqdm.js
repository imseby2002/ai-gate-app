"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tqdm = exports._tqdm = exports._tqdmIterator = void 0;
class _tqdmIterator {
    constructor(init) {
        this.index = 0;
        this.done = false;
        this.startTime = 0;
        this.progressBarSize = 45;
        this.startTime = Date.now();
        if (init instanceof Array) {
            this.values = init;
        }
        else if (typeof (init) == "number") {
            this.values = [...new Array(init).keys()];
        }
        else {
            this.values = [];
        }
    }
    next() {
        if (this.done)
            return { done: this.done, value: undefined, };
        if (this.index === this.values.length) {
            this.done = true;
            process.stdout.write('\n');
            return { done: this.done, value: undefined, };
        }
        const value = this.values[this.index];
        this.render();
        this.index++;
        return { done: false, value, };
    }
    formatTime(ms) {
        let output = "";
        let sec = Math.trunc(ms / 1000);
        let min = Math.trunc(sec / 60);
        const hour = Math.trunc(min / 60);
        sec = sec - min * 60;
        min = min - hour * 60;
        if (hour > 0)
            output = hour.toString().padStart(2, '0') + ':';
        output += `${min.toString().padStart(2, '0')}:`;
        output += `${sec.toString().padStart(2, '0')}:`;
        return output;
    }
    genProgressBar(percent) {
        const progressBarValue = Math.trunc(this.progressBarSize * percent);
        const progress = ''.padStart(progressBarValue, '█');
        const placeholder = ''.padStart(this.progressBarSize - progressBarValue, ' ');
        return `|${progress}${placeholder}|`;
    }
    render() {
        const counter = this.index + 1;
        const elapsedTime = Date.now() - this.startTime;
        let itemsPerSec = counter / (elapsedTime / 1000) || 0;
        if (itemsPerSec == Infinity)
            itemsPerSec = 0;
        const msPerItem = elapsedTime / counter;
        const timeLeft = (this.values.length - counter) * msPerItem;
        const percent = counter / this.values.length;
        const progressBarPart = this.genProgressBar(percent);
        const percentPart = (~~(percent * 100)).toString().padStart(3, ' ');
        const timePart = `${this.formatTime(elapsedTime)}<${this.formatTime(timeLeft)}`;
        const itemsPerSecPart = itemsPerSec.toFixed(2);
        process.stdout.write(`\x1b[0G${percentPart}%${progressBarPart} ${counter}/${this.values.length} [${timePart}, ${itemsPerSecPart}it/s]`);
    }
}
exports._tqdmIterator = _tqdmIterator;
class _tqdm {
    constructor(init) {
        this.init = init;
    }
    [Symbol.iterator]() {
        return new _tqdmIterator(this.init);
    }
}
exports._tqdm = _tqdm;
function tqdm(init) {
    return new _tqdm(init);
}
exports.tqdm = tqdm;
