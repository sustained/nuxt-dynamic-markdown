import { plural } from "pluralize";

/*
  A "mixin" for use on a page that has a route parameter that
  corresponds to a dynamic markdown entity such as `pages/projects/_project.vue`.

  TODO: Add error handling and such. What if the route param
        doesn't exist for some reason? And so on.
*/
export async function asyncData({ app, store, params, error }) {
  const entityName = Object.keys(params)[0];
  const entitiesName = plural(entityName);
  const entityValue = Object.values(params)[0];

  const entity = store.getters[`dynamic-markdown/${entitiesName}`](entityValue);

  if (!entity) {
    error({ statusCode: 404, message: `That ${entityName} does not exist!` });
  }

  try {
    const markdown = await app.loadMarkdown(`${entitiesName}/${entityValue}/content.md`);

    return { [entityName]: markdown };
  } catch (e) {
    throw e;
  }
}

/*
  This is probably completely unnecessary because the following:

  import { getEntities } from "dynamic-markdown";
  export default {
    layout: "projects",
    asyncData: getEntities("projects")
  };

  ...isn't a worthwhile reduction in boilerplate than manual wiring:

  export default {
    layout: "projects",
    computed: {
      projects() {
        return this.$store.state["dynamic-markdown"].projects;
      }
    }
  };
*/
export function getEntities(entityName) {
  return function({ store }) {
    return { [entityName]: store.state["dynamic-markdown"][entityName] };
  };
}

/*
  Get the keywords, description etc. from the entity.
*/
export const getMeta = {
  computed: {
    meta() {
      let entityMetadata = {};
      let entityValue = "";

      if (Object.keys(this.$route.params).length > 0) {
        const entityName = Object.keys(this.$route.params)[0];
        const entitiesName = plural(entityName);

        entityValue = Object.values(this.$route.params)[0];

        /* eslint-disable-next-line */
        entityMetadata = this.$store.state["dynamic-markdown"][entitiesName][entityValue];
      }

      return {
        name: entityMetadata.name || entityValue.substr(0, 1).toUpperCase() + entityValue.substr(1),
        keywords: entityMetadata.keywords || [],
        description: entityMetadata.description || []
      };
    }
  }
};

/*
  Apply the keywords, description etc.
*/
export const setHead = {
  head() {
    const entityName = Object.keys(this.$route.params)[0];
    const entitiesName = plural(entityName);

    return {
      title: `${this.meta.name} - ${entitiesName.substr(0, 1).toUpperCase() + entitiesName.substr(1)}`,

      meta: [
        {
          hid: "keywords",
          name: "keywords",
          content: this.meta.keywords
        },
        {
          hid: "description",
          name: "description",
          content: this.meta.description
        }
      ]
    };
  }
};
