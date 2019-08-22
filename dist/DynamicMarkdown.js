import Vue from 'vue';

var script = {
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
      if (!component.contains("/")) {
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

function normalizeComponent(template, style, script, scopeId, isFunctionalTemplate, moduleIdentifier
/* server only */
, shadowMode, createInjector, createInjectorSSR, createInjectorShadow) {
  if (typeof shadowMode !== 'boolean') {
    createInjectorSSR = createInjector;
    createInjector = shadowMode;
    shadowMode = false;
  } // Vue.extend constructor export interop.


  var options = typeof script === 'function' ? script.options : script; // render functions

  if (template && template.render) {
    options.render = template.render;
    options.staticRenderFns = template.staticRenderFns;
    options._compiled = true; // functional template

    if (isFunctionalTemplate) {
      options.functional = true;
    }
  } // scopedId


  if (scopeId) {
    options._scopeId = scopeId;
  }

  var hook;

  if (moduleIdentifier) {
    // server build
    hook = function hook(context) {
      // 2.3 injection
      context = context || // cached call
      this.$vnode && this.$vnode.ssrContext || // stateful
      this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext; // functional
      // 2.2 with runInNewContext: true

      if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
        context = __VUE_SSR_CONTEXT__;
      } // inject component styles


      if (style) {
        style.call(this, createInjectorSSR(context));
      } // register component module identifier for async chunk inference


      if (context && context._registeredComponents) {
        context._registeredComponents.add(moduleIdentifier);
      }
    }; // used by ssr in case component is cached and beforeCreate
    // never gets called


    options._ssrRegister = hook;
  } else if (style) {
    hook = shadowMode ? function () {
      style.call(this, createInjectorShadow(this.$root.$options.shadowRoot));
    } : function (context) {
      style.call(this, createInjector(context));
    };
  }

  if (hook) {
    if (options.functional) {
      // register for functional component in vue file
      var originalRender = options.render;

      options.render = function renderWithStyleInjection(h, context) {
        hook.call(context);
        return originalRender(h, context);
      };
    } else {
      // inject component registration as beforeCreate hook
      var existing = options.beforeCreate;
      options.beforeCreate = existing ? [].concat(existing, hook) : [hook];
    }
  }

  return script;
}

var normalizeComponent_1 = normalizeComponent;

/* script */
const __vue_script__ = script;

/* template */

  /* style */
  const __vue_inject_styles__ = undefined;
  /* scoped */
  const __vue_scope_id__ = undefined;
  /* module identifier */
  const __vue_module_identifier__ = undefined;
  /* functional template */
  const __vue_is_functional_template__ = undefined;
  /* style inject */
  
  /* style inject SSR */
  

  
  var DynamicMarkdown = normalizeComponent_1(
    {},
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    undefined,
    undefined
  );

export default DynamicMarkdown;
