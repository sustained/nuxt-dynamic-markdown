/*
  Node libraries.
*/

import { mkdirSync, existsSync, writeFileSync, lstatSync, readFileSync } from "fs";
import { extname, basename, resolve, normalize } from "path";

/*
  NPM libraries.
*/

import matter from "gray-matter";
import merge from "lodash.merge";
import omit from "lodash.omit";
import YAML from "yaml";

/*
  Our libraries.
*/

import { getDirectory } from "./utility";

/*
  Constants.
*/

/*
  Will be true when running tests (npm run test).
*/
const IS_TEST = process.env.NODE_ENV === "testing";

/*
  Path to the Nuxt project the Nuxt module is being used in.
*/
const NUXT_PATH = IS_TEST ? resolve(__dirname, "../test") : process.cwd();

/*
  Path to the Nuxt module itself.
*/
const MODULE_PATH = __dirname;

/*
  Nuxt module "constructor".
*/
export default async function DynamicMarkdown(options) {
  /*
    Add Webpack Markdown loader.
  */
  this.extendBuild(function(config, { isDev, isClient, isServer, loaders }) {
    const fmMdLoaderOptions = {
      vue: {
        root: "dynamicMarkdown"
      }
    };

    /*
      Allow overriding Markdown renderer.
    */
    if (options.render) {
      fmMdLoaderOptions.markdown = options.render;
    }

    config.module.rules.push({
      test: /\.md$/,
      loader: "frontmatter-markdown-loader",
      include: getMarkdownPath(),
      options: fmMdLoaderOptions
    });
  });

  const jsonToLoad = {};

  for (const source of options.sources) {
    const processed = await processMarkdownSource(source);
    jsonToLoad[source.name] = writeJSONFiles(processed, source);
  }

  console.log("jsonToLoad", jsonToLoad);

  /*
      Register the plugin that adds app.loadMarkdown and registers the global
      DynamicMarkdown component etc.
  */
  this.addPlugin({
    src: resolve(MODULE_PATH, "plugin.js"),
    fileName: "dynamic-markdown-plugin.js",
    options: {
      toLoad: jsonToLoad,
      sources: options.sources,
      pluginPath: normalize(MODULE_PATH + "/")
    }
  });
}

/*
  NOTE: This function sucks.

  The whole thing needs lots of work but especially this pile of crap. :D
*/
export async function processMarkdownSource(source) {
  if (!source.entities || !Array.isArray(source.entities)) {
    throw new Error("[dynamic-markdown] Entities must be an array.");
    return;
  }

  if (source.entities.length < 1) {
    throw new Error("[dynamic-markdown] At least one entity must be specified.");
    return;
  }

  if (source.entities.length > 2) {
    throw new Error("[dynamic-markdown] At most two entities may be specified.");
    return;
  }

  if (!source.directory) {
    source.directory = source.entities[0];
  }

  const markdownPath = getMarkdownPath(source.directory);

  if (!existsSync(markdownPath)) {
    throw new Error("[dynamic-markdown] Directory " + source.directory + " does not exist!");
    return;
  }

  const fileListing = await getDirectory(markdownPath);
  const entityFiles = fileListing.filter(file => !file.startsWith("_"));
  const relationshipFiles = fileListing.filter(file => file.startsWith("_") && file.endsWith(".yaml"));

  const result = {};

  const isNested = source.entities.length === 2;

  source.entities.forEach(entity => {
    const entityResult = { entities: [], relationships: {} };

    result[entity] = entityResult;
  });

  const outerEntityName = isNested ? source.entities[0] : null;
  const innerEntityName = isNested ? source.entities[1] : source.entities[0];

  for (let i = 0; i < entityFiles.length; i++) {
    const entityPath = getMarkdownPath(source.directory, entityFiles[i]);

    try {
      if (lstatSync(entityPath).isDirectory()) {
        if (isNested) {
          const fileListingOuter = await getDirectory(entityPath);
          const entityFilesOuter = fileListingOuter.filter(file => !file.startsWith("_"));

          const outerMetaFile = resolve(entityPath, `_${entityFiles[i]}.yaml`);

          const data = existsSync(outerMetaFile) ? getFrontMatter(outerMetaFile) : {};
          data.slug = entityFiles[i];

          result[outerEntityName].entities.push(data);

          for (let j = 0; j < entityFilesOuter.length; j++) {
            let innerEntities = await parseInner(resolve(entityPath, entityFilesOuter[j]));

            innerEntities = innerEntities.map(entity => {
              entity.parent = entityFiles[i];

              return entity;
            });

            result[innerEntityName].entities = result[innerEntityName].entities.concat(innerEntities);
          }
        } else {
          const innerEntities = await parseInner(entityPath);
          result[innerEntityName].entities = innerEntities;
        }
      }
    } catch (e) {
      console.error(e);
      continue;
    }
  }

  for (let i = 0; i < relationshipFiles.length; i++) {
    const relationshipFile = relationshipFiles[i];
    const relationshipName = relationshipFile.substr(1).replace(/.yaml$/, "");

    if (!source.relationships.some(r => r === relationshipName)) {
      console.warn(
        "[dynamic-markdown] Found relationship metadata file for unspecified relationship " + relationshipName
      );
    }

    result[innerEntityName].relationships[relationshipName] = YAML.parse(
      readFileSync(getMarkdownPath(source.directory, relationshipFile), "utf8")
    );
  }

  // console.log(JSON.stringify(result, null, 4));

  return result;
}

export async function parseInner(entityPath) {
  const entityTranslations = await getDirectory(entityPath);

  const result = [];
  const entities = [];

  /*
    Load the markdown for each translation.
  */
  entityTranslations.forEach(translationFile => {
    const data = getFrontMatter(resolve(entityPath, translationFile));

    data.slug = data.slug || parseSlugFromFilename(translationFile);
    data.language = parseLanguageFromFilename(translationFile) || "en";

    entities.push(data);
  });

  /*
    Merge all metadata into non-default (i.e. non-English) entities.
  */
  const defaultEntity = entities.find(e => e.language === "en");
  const otherEntities = entities.filter(e => e.language !== "en");

  result.push(defaultEntity);

  otherEntities.forEach((entity, index) => {
    result.push(merge({}, omit(defaultEntity, ["language"]), entity));
  });

  return result;
}

export function getMarkdownPath(...paths) {
  return resolve(NUXT_PATH, "contents", ...paths);
}

export function getJsonPath(...paths) {
  return resolve(NUXT_PATH, "static", "json", ...paths);
}

export function getFrontMatter(name, source, fileName) {
  try {
    const frontmatter = matter.read(getMarkdownPath(name));

    return frontmatter.data;
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error("Could not find the content.md file for " + name);
    } else if (e.name === "YAMLException") {
      console.error("Could not parse the front matter in the content.md file for " + name, e.message);
    } else {
      console.error(e.message);
    }

    return { __error: true };
  }
}

export function parseLanguageFromFilename(filename) {
  // Ensure no extension.
  filename = basename(filename, extname(filename));

  // Check for e.g. "-en", "-sv" at end of filename.
  const match = filename.match(/-([a-zA-Z]{2})$/);

  return match ? match[1] : null;
}

export function parseSlugFromFilename(filename) {
  filename = basename(filename, extname(filename));

  const hasLanguage = !!parseLanguageFromFilename(filename);

  return hasLanguage ? filename.substr(0, filename.length - 3) : filename;
}

export function writeJSONFiles(processed, source) {
  const data = {};

  if (!existsSync(getJsonPath())) {
    mkdirSync(getJsonPath());
  }

  if (source.nested) {
    /*
      TODO: Implement.
    */
  } else {
    console.log(processed);

    for (const [name, { frontmatter }] of Object.entries(processed)) {
      for (const relationship of source.relationships) {
        if (!frontmatter[relationship]) {
          console.error(
            "Relationship " + relationship + " not found in the front matter for the " + source.name + " called " + name
          );
          continue;
        }

        if (!data[relationship]) {
          data[relationship] = {};
        }

        for (const entry of frontmatter[relationship]) {
          if (!data[relationship][entry]) {
            data[relationship][entry] = [];
          }

          data[relationship][entry].push(name);
        }
      }
    }

    const jsonToLoad = [];

    for (const [relationshipName, relationshipList] of Object.entries(data)) {
      try {
        const namespacedName = source.name + "_" + relationshipName;

        writeFileSync(getJsonPath(namespacedName + ".json"), JSON.stringify(relationshipList));
        console.log("Wrote JSON file for " + namespacedName);
        jsonToLoad.push(namespacedName);
      } catch (e) {
        console.error(e);
      }
    }

    data[source.name] = {};

    for (const [name, { frontmatter }] of Object.entries(processed)) {
      try {
        data[source.name][name] = frontmatter;
      } catch (e) {
        console.error(e);
      }
    }

    try {
      writeFileSync(getJsonPath(source.name + ".json"), JSON.stringify(data[source.name]));
      console.log("Wrote JSON file for " + source.name);
      jsonToLoad.push(source.name);
    } catch (e) {
      console.error(e);
    }

    return jsonToLoad;
  }
}

module.exports.meta = require("../package.json");
