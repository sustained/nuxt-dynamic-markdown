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

async function loadDynamicMarkdown(markdownPath) {
  const { default: content } = await import("~/contents/" + markdownPath);

  let { attributes } = content;

  if (attributes) {
    delete attributes._meta; // NOTE: Reveals server paths.
  } else {
    attributes = {};
  }

  return {
    attributes: attributes,
    rawMarkdown: content.body,
    componentList: content.attributes.components || [],
    renderFunction: content.vue.render,
    staticRenderFunctions: content.vue.staticRenderFns
  };
}

module.exports = { loadDynamicMarkdown, getDirectory };
