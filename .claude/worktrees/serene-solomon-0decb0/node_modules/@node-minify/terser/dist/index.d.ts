import { MinifierOptions } from '@node-minify/types';

/*!
 * node-minify
 * Copyright(c) 2011-2023 Rodolphe Stoclin
 * MIT Licensed
 */

type OptionsTerser = {
    sourceMap?: {
        url: string;
    };
};
type SettingsTerser = {
    options: OptionsTerser;
};
type MinifierOptionsTerser = {
    settings: SettingsTerser;
};
declare const minifyTerser: {
    ({ settings, content, callback, index }: MinifierOptions & MinifierOptionsTerser): Promise<string | void | null>;
    default: any;
};

export { minifyTerser as default };
