import { readdirSync, unlinkSync, existsSync, renameSync } from "fs";
import { resolve } from "path";

const JSON_PATH = resolve(__dirname, "static/json");

import chai, { expect, assert } from "chai";

import { processMarkdownSource, writeJSONFiles } from "../lib/module.js";
import { doesNotReject } from "assert";

/*
  NOTE: We do this because sometimes we do are going to be expeting errors 
        to be thrown but the stack traces mess up the pretty test output.
*/
process.on("unhandledRejection", () => {});

/*
  Empty out JSON directory.
*/
const files = readdirSync(JSON_PATH);
for (const file of files) {
  if (file === ".gitignore") {
    continue;
  }
  unlinkSync(resolve(JSON_PATH, file));
}

describe("processMarkdownSource()", () => {
  describe("options parsing", () => {
    it("requires entities to be present", async () => {
      try {
        const processed = await processMarkdownSource({ name: "test" }, { languages: ["en"] });
        throw new Error("Promise should reject.");
      } catch (e) {
        expect(e).to.be.an("error");
      }
    });

    it("requires entities to be an array", async () => {
      try {
        await processMarkdownSource({ name: "test", entities: 123, directory: "projects" }, { languages: ["en"] });
        throw new Error("Promise should reject.");
      } catch (e) {
        expect(e).to.be.an("error");
      }
    });

    it("requires at least one entity", async () => {
      try {
        await processMarkdownSource({ name: "test", entities: [], directory: "projects" }, { languages: ["en"] });
        throw new Error("Promise should reject.");
      } catch (e) {
        expect(e).to.be.an("error");
      }
    });

    it("requires no more than two entities", async () => {
      try {
        await processMarkdownSource(
          { name: "test", entities: [{}, {}, {}], directory: "projects" },
          { languages: ["en"] }
        );
        throw new Error("Promise should reject.");
      } catch (e) {
        expect(e).to.be.an("error");
      }
    });

    it("should fail for non-existent directories", async () => {
      try {
        await processMarkdownSource(
          { name: "test", entities: ["test"], directory: "nonexistent" },
          { languages: ["en"] }
        );
        throw new Error("Promise should reject.");
      } catch (e) {
        expect(e).to.be.an("error");
      }
    });
  });

  describe("processing", () => {
    describe("example source (project)", () => {
      let processed;
      let entities, relationships;
      let languages, technologies;

      before(async () => {
        processed = await processMarkdownSource(
          {
            entities: ["projects"],
            relationships: ["languages", "technologies"]
          },
          { languages: ["en"] }
        );

        ({ entities, relationships } = processed.projects);
        ({ languages, technologies } = relationships);
      });

      it("should result in the correct number of entities and relationships", async () => {
        try {
          return (
            expect(entities.length).to.equal(4) &&
            expect(Object.keys(languages).length).to.equal(3) &&
            expect(Object.keys(technologies).length).to.equal(4)
          );
        } catch (e) {
          assert.fail(e.message);
        }
      });

      it("should result in the correct structure for all entities", async () => {
        try {
          const structureCheck = entities.every(project => {
            return (
              project.title &&
              project.meta &&
              project.meta.keywords &&
              project.meta.description &&
              project.technologies &&
              project.languages &&
              project.language &&
              project.translations
            );
          });

          return expect(structureCheck).to.be.true;
        } catch (e) {
          assert.fail(e.message);
        }
      });
    });

    describe("example source (blog)", () => {
      it("should parse the example blog source as expected", async () => {
        try {
          const processed = await processMarkdownSource(
            {
              entities: ["categories", "articles"],
              directory: "blog",
              relationships: ["tags"]
            },
            { languages: ["en"] }
          );

          const { entities: articles, relationships } = processed.articles;
          const { entities: categories } = processed.categories;
          const { tags } = relationships;

          return (
            expect(articles.length).to.equal(7) &&
            expect(categories.length).to.equal(2) &&
            expect(Object.keys(relationships.tags).length).to.equal(2)
          );
        } catch (e) {
          assert.fail(e.message);
        }
      });
    });
  });
});

describe("writeJsonFiles()", () => {
  it("should write the json for the project source as expected", async () => {
    try {
      const source = {
        entities: ["projects"],
        relationships: ["languages", "technologies"]
      };
      const processed = await processMarkdownSource(source, { languages: ["en"] });

      writeJSONFiles(processed, source);

      return (
        expect(existsSync(resolve(JSON_PATH, "projects.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "languages.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "technologies.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "projects_languages.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "projects_technologies.json"))).to.equal(true)
      );
    } catch (e) {
      assert.fail(e.message);
    }
  });

  it("should write the json for the example blog source as expected", async () => {
    try {
      const source = {
        entities: ["categories", "articles"],
        directory: "blog",
        relationships: ["tags"]
      };
      const processed = await processMarkdownSource(source, { languages: ["en"] });

      writeJSONFiles(processed, source);

      return (
        expect(existsSync(resolve(JSON_PATH, "categories.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "articles.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "tags.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "articles_tags.json"))).to.equal(true)
      );
    } catch (e) {
      assert.fail(e.message);
    }
  });
});
