<script>
import Vue from "vue";

export default {
  props: {
    /*
      The render function provided by frontmatter-markdown-loader.
    */
    renderFunction: {
      type: String,

      default() {
        return "return function render() {};";
      }
    },

    /*
      The static render functions provided by frontmatter-markdown-loader.
    */
    staticRenderFunctions: {
      type: String,

      default() {
        return "return [];";
      }
    },

    /*
      A list of components to provide to the markdown file.
    */
    componentList: {
      type: Array,

      default() {
        return [];
      }
    },

    /*
      The frontmatter attributes which will be merged into data and
      accessible via e.g. {{ attributeName }} in markdown files.
    */
    attributes: {
      type: Object,

      default() {
        return {};
      }
    },

    /*
      Custom attributes to merge into the frontmatter attributes.

      Example:

        Vue component:

          <DynamicMarkdown v-bind="entity" :custom-attributes="{ foo: 'bar' }" />

        Markdown file:

          {{ foo }}
    */
    customAttributes: {
      type: Object,

      default() {
        return {};
      }
    }
  },

  /*
    Merge YAML frontmatter + custom attributes into data.
  */
  data() {
    const data = {};

    for (const [key, value] of Object.entries(this.attributes)) {
      data[key] = value;
    }

    for (const [key, value] of Object.entries(this.customAttributes)) {
      data[key] = value;
    }

    return data;
  },

  beforeDestroy() {
    this.unregisterComponents();
  },

  created() {
    /*
      Allow specifying the componentList via attributes.components 
      but only in the case that componentList is empty.
    */
    if (this.componentList.length === 0) {
      if (Array.isArray(this.attributes.components)) {
        this.componentList = this.attributes.components;
      }
    }

    this.registerComponents();

    this.renderer = new Function(this.renderFunction).bind()();
    this.$options.staticRenderFns = new Function(this.staticRenderFunctions)();
  },

  methods: {
    /*
      HACK: We define global components temporarily so that we can access a 
            component as <Foo /> in the markdown since there is no good way 
            to dynamically set components, the only alternative would be e.g. 
            <Component is="components.Foo" /> which is awful in its own right.
    */
    registerComponents() {
      this.componentList.forEach(component => {
        const [name, path] = this.getComponentNameAndPath(component);

        Vue.component(name, () => import(`~/components/${path}.vue`));
      });
    },

    unregisterComponents() {
      this.componentList.forEach(component => {
        const [name] = this.getComponentNameAndPath(component);

        delete Vue.options.components[name];
      });
    },

    getComponentNameAndPath(component) {
      if (!component.includes("/")) {
        return [component, component];
      }

      const parts = component.split("/");

      const componentName = parts.pop();
      const componentPath = parts.join("/") + componentName + ".vue";

      return [componentName, componentPath];
    }
  },

  render(createElement) {
    return this.renderer
      ? this.renderer()
      : createElement("div", "Please wait...");
  }
};
</script>
