import { readdirSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";

const JSON_PATH = resolve(__dirname, "static/json");

import chai, { expect, assert, should } from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);

import { processMarkdownSource, writeJSONFiles } from "../lib/module.js";

/*
  NOTE: We do this because sometimes we do are going to be expeted errors 
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
    it("requires entities to be present", () => {
      return expect(processMarkdownSource({ name: "test" })).to.eventually.be.rejectedWith(/Entities must be an array/);
    });

    it("requires entities to be an array", () => {
      return expect(
        processMarkdownSource({ name: "test", entities: 123, directory: "projects" })
      ).to.eventually.be.rejectedWith(/Entities must be an array./);
    });

    it("requires at least one entity", () => {
      return expect(
        processMarkdownSource({ name: "test", entities: [], directory: "projects" })
      ).to.eventually.be.rejectedWith(/At least one entity must be specified./);
    });

    it("requires no more than two entities", () => {
      return expect(
        processMarkdownSource({ name: "test", entities: [1, 2, 3], directory: "projects" })
      ).to.eventually.be.rejectedWith(/At most two entities may be specified./);
    });

    it("should fail for non-existent directories", async () => {
      return expect(
        processMarkdownSource({ name: "test", entities: ["test"], directory: "nonexistent" })
      ).to.eventually.be.rejectedWith(/Directory .+ does not exist!/);
    });
  });

  describe("processing", () => {
    it("should parse the example project source as expected", async () => {
      const processed = await processMarkdownSource({
        entities: ["projects"],
        relationships: ["languages", "technologies"]
      });

      const { entities: projects, relationships } = processed.projects;
      const { languages, technologies } = relationships;

      return (
        expect(projects.length).to.equal(4) &&
        expect(Object.keys(languages).length).to.equal(3) &&
        expect(Object.keys(technologies).length).to.equal(4)
      );
    });

    it("should parse the example blog source as expected", async () => {
      const processed = await processMarkdownSource({
        entities: ["categories", "articles"],
        directory: "blog",
        relationships: ["tags"]
      });

      const { entities: articles, relationships } = processed.articles;
      const { entities: categories } = processed.categories;
      const { tags } = relationships;

      return (
        expect(articles.length).to.equal(7) &&
        expect(categories.length).to.equal(2) &&
        expect(Object.keys(relationships.tags).length).to.equal(2)
      );
    });
  });

  describe("writing json", () => {
    it("should write the json for the project source as expected", async () => {
      const source = {
        entities: ["projects"],
        relationships: ["languages", "technologies"]
      };
      const processed = await processMarkdownSource(source);

      writeJSONFiles(processed, source);

      return (
        expect(existsSync(resolve(JSON_PATH, "projects.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "languages.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "technologies.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "projects_languages.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "projects_technologies.json"))).to.equal(true)
      );
    });

    it("should write the json for the example blog source as expected", async () => {
      const source = {
        entities: ["categories", "articles"],
        directory: "blog",
        relationships: ["tags"]
      };
      const processed = await processMarkdownSource(source);

      writeJSONFiles(processed, source);

      return (
        expect(existsSync(resolve(JSON_PATH, "categories.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "articles.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "tags.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "articles_tags.json"))).to.equal(true)
      );
    });
  });
});
