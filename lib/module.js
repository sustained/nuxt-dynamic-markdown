/*
  TODO: Figure out what we should be doing wrt paths. Options are
        __dirname and process.cwd() and presumably something or
        another which is attached to the Nuxt context or whatever.

  NOTE: Using gray-matter is sort of a workaround since we can't get 
        Webpack loaders to work within Nuxt modules. So instead we're 
        using matter.read which is not really an issue but it would be 
        nice if we could get it working or figure out why it doesn't.
*/

const { mkdirSync, existsSync, writeFileSync } = require("fs");
const { resolve, normalize } = require("path");
const matter = require("gray-matter");
const { getDirectory } = require("./utility");
const { getMeta, setHead, asyncData, getEntities } = require("./mixin");
/*
  TODO: I get a feeling that using rollup to conver this to CJS really 
        isn't the best option - research more and find out what is.
*/
// const DynamicMarkdown = require("../dist/DynamicMarkdown.js");

module.exports = {
  mixins: { getMeta, setHead, asyncData, getEntities },

  // components: { DynamicMarkdown },

  module: async function DynamicMarkdown(options) {
    console.log(options);

    /*
    Add Webpack loaders for Markdown and YAML files.
  */
    this.extendBuild(function(config, { isDev, isClient, isServer, loaders }) {
      const fmMdLoaderOptions = {
        vue: {
          root: "dynamicMarkdown"
        }
      };

      if (options.render) {
        fmMdLoaderOptions.markdown = options.render;
      }

      config.module.rules.push({
        test: /\.md$/,
        loader: "frontmatter-markdown-loader",
        // include: resolve(__dirname, "contents"),
        options: fmMdLoaderOptions
      });

      // config.module.rules.push({
      //   test: /\.ya?ml$/,
      //   // include: resolve(__dirname, "contents"),
      //   loader: "js-yaml-loader"
      // });
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

    TODO: We can probably think more about the options we pass in to it to
          make the work it needs to do a little bit simpler.
  */
    this.addPlugin({
      src: resolve(__dirname, "plugin.js"),
      fileName: "dynamic-markdown-plugin.js",
      options: {
        toLoad: jsonToLoad,
        sources: options.sources,
        pluginPath: normalize(__dirname + "/")
      }
    });

    /*
    We're probably going to need to make use of some of these at some point
    or another so they're mainly here just for reference purposes.
  */
    this.nuxt.addHooks({
      build: {
        extend(config, { isDev, isClient, isServer, loaders }) {
          console.log("extend hook");
        },
        before() {
          console.log("build done hook");
        },
        compile() {
          console.log("build compile hook");
        },
        done() {
          console.log("build done hook");
        }
      },
      generate: {
        distCopied() {
          console.log("generate dist copied hook");
        },
        extendRoutes() {
          console.log("generate extend routes hook");
        }
      }
    });
  }
};

/*
  NOTE: This function sucks.

  The whole thing needs lots of work but especially this pile of crap. :D
*/
async function processMarkdownSource(source) {
  console.log("processMarkdownSource", source);

  const markdownPath = resolve(process.cwd(), "contents", source.directory);

  if (!existsSync(markdownPath)) {
    console.warn("[dynamic-markdown] Directory " + source.directory + " does not exist!");

    return false;
  }

  /*
    TODO: This whole thing should probably be recursive.
  */
  const parentDirs = await getDirectory(markdownPath);

  const result = parentDirs.reduce((accum, value) => {
    accum[value] = { frontmatter: {} };

    if (source.nested) {
      accum[value].children = {};
    }

    return accum;
  }, {});

  const toRemove = [];

  for (let i = 0; i < parentDirs.length; i++) {
    const parent = parentDirs[i];
    const frontmatter = getFrontMatter(parent, source);

    if (frontmatter.__error) {
      toRemove.push(parent);
      continue;
    }

    result[parent].frontmatter = frontmatter;

    if (source.nested) {
      let childDirs = await getDirectory(markdownPath, parent);

      childDirs = childDirs.filter(item => item !== "_meta.md").map(item => item.replace(/.md$/, ""));

      for (let i = 0; i < childDirs.length; i++) {
        const child = childDirs[i];
        const frontmatter = getFrontMatter(parent, source, child);

        result[parent].children[child] = { frontmatter };
      }
    }
  }

  toRemove.forEach(remove => delete result[remove]);

  return result;
}

function getMarkdownPath(...paths) {
  return resolve(process.cwd(), "contents", ...paths);
}

function getJsonPath(...paths) {
  return resolve(process.cwd(), "static", "json", ...paths);
}

function getFrontMatter(name, source, fileName) {
  try {
    if (!fileName) {
      fileName = source.nested ? "_meta.md" : "content.md";
    } else {
      fileName += ".md";
    }

    const frontmatter = matter.read(getMarkdownPath(source.directory, name, fileName));

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

function writeJSONFiles(processed, source) {
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
