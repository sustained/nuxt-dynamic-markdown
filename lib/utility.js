const { promises } = require("fs");
const { resolve } = require("path");
const { readdir } = promises;

async function getDirectory(...pathComponents) {
  try {
    const files = await readdir(resolve(...pathComponents));

    return files;
  } catch (e) {
    console.error(e);

    return [];
  }
}

module.exports = { getDirectory };
