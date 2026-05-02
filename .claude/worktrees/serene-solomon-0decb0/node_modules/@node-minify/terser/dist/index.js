"use strict";

// src/index.ts
var import_terser = require("terser");
var import_utils = require("@node-minify/utils");
var minifyTerser = async ({ settings, content, callback, index }) => {
  try {
    const contentMinified = await (0, import_terser.minify)(content ?? "", settings?.options);
    if (contentMinified.map && typeof settings?.options?.sourceMap?.url === "string") {
      import_utils.utils.writeFile({ file: settings.options.sourceMap.url, content: contentMinified.map, index });
    }
    if (settings && !settings.content && settings.output) {
      import_utils.utils.writeFile({ file: settings.output, content: contentMinified.code, index });
    }
    if (callback) {
      return callback(null, contentMinified.code);
    }
    return contentMinified.code;
  } catch (error) {
    return callback && callback(error);
  }
};
minifyTerser.default = minifyTerser;
module.exports = minifyTerser;
/*!
 * node-minify
 * Copyright(c) 2011-2023 Rodolphe Stoclin
 * MIT Licensed
 */
//# sourceMappingURL=index.js.map