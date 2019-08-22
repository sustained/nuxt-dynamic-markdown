# nuxt-dynamic-markdown

## Disclaimer

This project is **pre-alpha** and you should 100% not use it in a production environment!

- Some parts of the code don't have proper error checking.
- There are no tests. Zero. Nada. Keine. Zilch.
- I haven't tried running any of this in other browsers; on other OSes; with different versions of Nuxt, Vue etc. nor can I guarantee that it works in parallel dimensions, different universes or alternate timelines.
- It currently relies on `fs.promises` (experimental API, requires `node > 8` I believe).
- The README presumes you understood Nuxt and Vue to a decent degree.
- Just because the README says something doesn't mean that feature is ready, or that it has even been started, or that it will ever come, or that it's possible, or that you'd like it if any of those things were true.
- While there is a basic guide/walkthrough there is no actual documentation (API or otherwise) at this early stage.
- I'm really new to Nuxt and I'm learning as I go so this may well be the worst Nuxt module of all time!

Finally, you should check out [NuxtPress](https://github.com/nuxt/press) because it does kind of a similar-ish (but not really) thing but probably in a far far better way.

## What is it?

It basically takes directories that contain markdown files that contain YAML front matter and builds "entities" and the relationships (e.g. `hasMany`) between them.

All of this gets dumped into JSON which in turn is pulled into Vuex. Also, getters/setters are dynamically generated for us to help us with our relationships (please note that it doesn't help you with your real life relationships).

Finally, the **DynamicMarkdown** component helps us to quickly/easily render our strange Frankensteinesque creation.

If that didn't make any sense then try the [walkthrough](#walkthrough)!

## How do I install it?

### Create a Nuxt project, if you haven't already

```sh
npx create-nuxt-app my-project
```

### Install the module with npm/yarn

```sh
npm i --save nuxt-dynamic-markdown
# or
yarn add nuxt-dynamic-markdown
```

### Register the module in nuxt.config.js

```js
// nuxt.config.js
import NuxtDynamicMarkdown from "nuxt-dynamic-markdown";

export default {
  modules: [
    [
      NuxtDynamicMarkdown,
      {
        /*
          Sources are how you tell NDM what to load, 
          where from and how you define your relationships.
          
          IMPORTANT: This data-source is presumed to be 
          present for the duration of this README.
        */
        sources: [
          {
            nested: false,
            name: "projects",
            directory: "projects",
            relationships: ["keywords"]
          }
        ]
      }
    ]
  ]
};
```

Installation complete. Well done, you made it this far!

---

## Walkthrough

### Directory structure

Okay. Presume we have a directory called `contents` in our Nuxt project with the following structure:

```
contents/
  projects/
    my-first-project/
      content.md
```

### Entity definition file

And the following `content.md` file:

```markdown
---
title: Foo Project
keywords: [foo, bar, baz]
description: I am foo project!
components: [Bar]
---

# Foo

I am foo project! The one! The only!

## Attributes (Frontmatter)

My keywords are: {{ keywords.join(", ") }}.

### Custom Attributes

This is a custom attribute:

{{ custom }}

## Components

This is a component:

<Bar />

Isn't it great?
```

#### Notes

The YAML frontmatter can be pretty much anything you want, as can the markdown that comes after it.

If you want to use non-global components then you'll need to register them in the frontmatter, as in the example above.

Note how you can refer to anything defined in the frontmatter. Also note how you can refer to "custom attributes".

---

### Creating Nuxt pages

Next, we'll create a `projects` folder in `pages` and within it we'll create two files.

The first file will be called `_project.vue`:

```html
<template>
  <section>
    <DynamicMarkdown v-bind="project" :custom-attributes="{ custom: 'Hello!' }" />
  </section>
</template>

<script>
  import {
    getMeta, setHead, asyncData
  } from "nuxt-dynamic-markdown/lib/mixin";

  export default {
    mixins: [getMeta, setHead],
    asyncData
  };
</script>
```

And the second file will be called `index.vue`:

```html
<template>
  <section>
    <h1>My Projects</h1>

    <ul>
      <li v-for="project in projects">
        <nuxt-link
          :to="{
            name: 'projects-project',
            params: { project: projectName }
          }"
        >
          {{ project }}
        </nuxt-link>
      </li>
    </ul>
  </section>
</template>

<script>
  import { getEntities } from "nuxt-dynamic-markdown/lib/mixin";

  export default {
    asyncData: getEntities("projects")
  };
</script>
```

#### Notes

The convention is that since the route parameter is `project` (due to the file being called `_project`) that the data returned to us is also `project`.

There's a lot of magic going on there (especially in the first file) but we'll ignore most of it for now.

### Creating the `Bar` component

Finally we'll create a file called `Bar.vue` in `components` since we referenced it in our `content.md` file.

```html
<template>
  <div>
    <p>I am bar component</p>
  </div>
</template>
```

### Result

If the stars were aligned properly and you uttered the incantations with the correct stress and prosody then you should see something like this:

(result coming soon - I need to now take a detour and create the demo/example repo so I can take screenshots)