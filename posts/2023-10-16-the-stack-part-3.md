---
title: "The Stack Part 3: Building a Frontend"
tags: rust, typescript, wasm, nextjs, leptos, aws, cloud, infrastructure, cdk, ci
---

In [the last post](/posts/2023-10-07-the-stack-part-2.html) we set up our deployment, fully automated on merge to our `main` branch. In this post we will be building our UI (Frontend) applications. See the full overview of posts [here](/posts/2023-01-29-the-stack.html#what-will-we-be-covering).

At the end of this post we will have:

- A [Next.js](https://nextjs.org/) Frontend app with support for localization, using Tailwind CSS.
- A [Leptos](https://github.com/leptos-rs/leptos) Rust/WASM Frontend app with support for localization, using Tailwind CSS.
- Automatic deployment of our Apps AWS using CDK, statically hosted using S3 + CloudFront.

We are essentially hedging our bets by building both a JavaScript-based Frontend, which is the safe bet, and a Rust/WASM-based Frontend, which is the future bet. We will be using the same GraphQL API for both, so we can easily switch between them.

There is quite a lot to cover. My recommendation is to clone down the Part 3 branch in the [GitHub repository](https://github.com/codetalkio/the-stack/tree/part-3-frontend) and use this post as an explanation of what is set up.

<div></div><!--more-->

- [Prelude: Static Site Generation](#prelude-static-site-generation)
- [Next.js](#next.js)
    - [Setting up our Next.js App](#setting-up-our-next.js-app)
    - [Building Static Files](#building-static-files)
    - [Setting up Localization](#setting-up-localization)
- [Leptos (Rust/WASM)](#leptos-rustwasm)
    - [Setting up our Leptos App](#setting-up-our-leptos-app)
    - [Setting up Tailwind CSS](#setting-up-tailwind-css)
    - [Setting up Localization](#setting-up-localization-1)
- [Bonus: End-to-End Tests](#bonus-end-to-end-tests)
- [Bonus: DevEx Improvements](#bonus-devex-improvements)
- [Automating Deployments via CDK](#automating-deployments-via-cdk)
    - [Building artifacts in CI](#building-artifacts-in-ci)
    - [Deploying to S3 + CloudFront](#deploying-to-s3-cloudfront)
- [Next Steps](#next-steps)


## Prelude: Static Site Generation

While SSR (Server Side Rendering) is seeing a renaissance these days, we are intentionally avoiding this functionality. If you remember the architecture outlined in [our introduction to the series](/posts/2023-01-29-the-stack.html#what-will-we-be-covering), we want to be able to serve our Frontend entirely using static file hosting.

There are multiple reasons for this, going back to our core design goals:

- **Low cost**: Static file hosting is extremely cheap, and scales as well as S3/CloudFront does (i.e. *very well*).
- **Low operational overhead**: Static file hosting is extremely simple to operate—there are no servers for us to worry about and scale up/down as needed, no need for any orchestration yet.
- **Performant**: Static file hosting is extremely performant, as the files are served directly from the edge, and not from a server.

We do sacrifice the ability to do SSR and the various User Experiences that can potentially bring, but the benefits are far outweighed by the downsides in this tradeoff.

## Next.js

Next.js is one of the most popular React frameworks at the moment, and supports a lot of niceties as well as sets us on a path of a good structure from the get-go. It has a lot of momentum behind it, a strong focus on the Developer Experience, and uses React which makes it a very familiar option for a large majority of Frontend Engineers out there.

We'll once again use [Bun](https://bun.sh/), which you can install via:

```bash
$ curl -fsSL https://bun.sh/install | bash
```

While [bun unfortunately doesn't fully support the Next.js App Router yet](https://bun.sh/guides/ecosystem/nextjs) we will still rely on it for installing dependencies and being our general go-to tool for running anything JS related.

#### Setting up our Next.js App

Let's get our Next.js app set up, which we will call `ui-app`:

```bash
$ bun create next-app # Call it ui-app
✔ What is your project named? … ui-app
✔ Would you like to use TypeScript? … Yes
✔ Would you like to use ESLint? … Yes
✔ Would you like to use Tailwind CSS? … Yes
✔ Would you like to use `src/` directory? … Yes
✔ Would you like to use App Router? (recommended) … Yes
✔ Would you like to customize the default import alias (@/*)? … No
```

This gets us quite far, we now have an App we can run, Tailwind CSS is already set up, and we got a lot of the structure set up for us:

```bash
$ cd ui-app
$ bun run dev # or bun run build
next dev
  ▲ Next.js 13.5.4
  - Local:        http://localhost:3000

 ✓ Ready in 3s
```

Voila, we've got a little Hello World Next.js app!

#### Building Static Files

We need to do just one small change to our Next.js setup to make it output static files for us. We'll do this by adding `output: "export"` to our `next.config.js` file at the root of `ui-app/`:

```typescript
// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    // Statically type links to prevent typos and other errors when using next/link, improving type safety when navigating between pages.
    typedRoutes: true,
  },
};

module.exports = nextConfig;
```

We also enabled `trailingSlash` ([docs here](https://nextjs.org/docs/pages/api-reference/next-config-js/trailingSlash)) to make Next.js work nicely with CloudFront.

This tells Next.js that we want to to [Statically Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports) our files, which will generate an HTML file per route, which allows each route to serve the minimal content it needs, enabling faster page loads, instead of the traditional SPA approach of serving one large file upfront.

We get the best of both worlds here, as we still get the reduced bundle sizes typical of SSR, but can retain the static file advantage of SPAs.

#### Setting up Localization

As our customer-base grows, we will inevitably run into the need to localization. To do this, we will restructure our App with basic support for this, as well as bring in a dependency to help us with this, namely [next-intl](https://www.npmjs.com/package/next-intl). Vercel also has some good documentation on how to [Get Started](https://next-intl-docs.vercel.app/docs/getting-started/app-router-client-components) here.

Let's start by adding the dependency:

```bash
$ bun add next-intl
```

We'll also create a folder that will contain our localization files, which we'll call `locales/` in the root of the `ui-app/` project:

```bash
$ mkdir messages
```

This allows us to set up some text for our first languages. Create an English locale, `messages/en.json`, with the following:

```json
{
  "home": {
    "intro": "Welcome!"
  }
}
```

And also a French locale, in `messages/fr.json`:

```json
{
  "home": {
    "intro": "Bienvenue!"
  }
}
```

To make this a bit nicer to work with, we'll also [add typesafety](https://next-intl-docs.vercel.app/docs/workflows/typescript) by letting TypeScript know what keys we support in our localization function. Create a `ui-app/global.d.ts` file with the following:

```typescript
// Use type safe message keys with `next-intl`, based on the contents/keys of
// our default english locale.
type Messages = typeof import("./messages/en.json");
declare interface IntlMessages extends Messages {}
```

This ensures that if we misspell a key, or even remove one later on, we will be highlighted of the incorrect usage by TypeScript.

We can now set up a route using the App Router to pick up our locale. We'll want the locale to be part of our URL as a prefix on all routes, so that we can pick it up as a [dynamic segment](https://nextjs.org/docs/app/building-your-application/routing/defining-routes#creating-routes) and use it to load the correct localization file.

First we will create a folder where our localized pages will live in, and also clean up the default files that Next.js created for us:

```bash
$ mkdir "src/app/[locale]"
$ rm src/app/page.tsx src/app/layout.tsx
```

Let's create a simply page in here at `src/app/[locale]/page.tsx`, and get our welcome text from the localization file:

```typescript
"use client";

import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("home");

  return (
    <div className="grid place-content-center content-center h-screen">
      <h1 className="text-6xl">{t("intro")}</h1>
      <div className="grid gap-4 grid-cols-2">
        <a href="/fr">Go to fr</a>
        <a href="/en">Go to en</a>
      </div>
    </div>
  );
}
```

We'll need to mark the component as `'use client'` for now, while [next-intl is working on server-side support](https://next-intl-docs.vercel.app/docs/getting-started/app-router-server-components).

Since we removed existing layout file, we need to define a new one that also handles setting up our localization at the root of our components. We'll create a `src/app/[locale]/layout.tsx` file with the following:

```typescript
import "../globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { ReactNode } from 'react';
import { promises as fs } from 'fs';

export const metadata: Metadata = {
  title: "Hello, World!",
  description: "Ready to set things up",
}

const inter = Inter({ subsets: ["latin"] });

/**
 * Set up all supported locales as static parameters, which ensures we generate
 * static pages for each possible value of `locale`.
 */
export async function generateStaticParams() {
  // Construct an array of all supported locales based on the files in the `messages/` directory.
  const localeFiles = await fs.readdir(`${process.cwd()}/messages`);
  return localeFiles.map((f) => ({locale: f.replace(/\.json$/, "")}));
}

/**
 * Load the contents of a given locale's messages file.
 */
async function messagesContent(locale: string) {
  try {
    return (await import(`../../../messages/${locale}.json`)).default;
  } catch (error) {
    console.error("Something went wrong", error);
    notFound();
  }
}

type Props = {
  children: ReactNode;
  params: {
    locale: string;
  };
};

export default async function Layout({ children, params: { locale } }: Props) {
  const messages = await messagesContent(locale);
  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

To avoid needing to maintain a hardcoded list of locales, we dynamically find all the locales defined in our `messages/` folder during build time, and construct a list of supported locales from this. We then pass the contents of this into `NextIntlClientProvider`.

We could imagine later on, once our translation file becomes massive, that we split up `en.json` into smaller segments such as `en/home.json`, and load these parts specifically in a `app/[locale]/home/layout.tsx` file. For now though, we'll keep it simple.

As the final piece of this puzzle, we need a way to let Next.js know where it should route to by default, since we removed the default root pages.

We unfortunately cannot use [middleware's](https://next-intl-docs.vercel.app/docs/routing/middleware) when statically exporting our site, so we will instead redirect the user upon loading the page. Create a `src/app/page.tsx` file with the following:

```typescript
import { redirect } from "next/navigation";

export default function Root() {
  redirect("/en");
}
```

Along with a root layout file at `src/app/layout.tsx`:

```typescript
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return children;
}
```

You should now have a structure that looks like this:

```bash
.
├── README.md
├── bun.lockb
├── global.d.ts
├── messages
│   └── en.json
│   └── fr.json
├── next.config.js
├── package.json
├── postcss.config.js
├── public
│   └── favicon.ico
├── src
│   └── app
│       ├── [locale]
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── favicon.ico
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── tailwind.config.ts
└── tsconfig.json
```

And that's it! We're now able to run our app and check it out in the browser:

```bash
$ bun run dev
```

<div style="text-align:center;">
<a href="/resources/images/the-stack-part-3-ui-app-skeleton.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/the-stack-part-3-ui-app-skeleton.thumbnail.png" loading="lazy" alt="Screenshot of our ui-app" title="Screenshot of our ui-app" width="60%" /></a>
</div>

It may not look like much, but we've implemented a lot of the core functionality we need to get started, such as static builds and localization.

As the final step we will add our commands to just, [extending our existing justfile](/posts/2023-10-07-the-stack-part-2.html#bonus-just):

```makefile
_setup-ui-app:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd ui-app
  bun install
```

We'll also set up a new command for running our development server:

```makefile
# Run <project> development server, e.g. `just dev ui-app`.
dev project:
  just _dev-{{project}}

_dev-ui-app:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd ui-app
  bun dev
```

## Leptos (Rust/WASM)

Leptos is one of the newer entries on the Rust/WASM scene. It has a radical focus on performance and scalability of your codebase, so that as your codebase grows your App doesn't just start to become slower which is a typical issue in React and VDOM-based frameworks.

Leptos should feel somewhat familiar, although it is more closely related to something like [Solid.js](https://www.solidjs.com/) which is based on Signals and not using a VDOM. Leptos has a good quick overview of features [here](https://github.com/leptos-rs/leptos#what-does-that-mean) and a nice [FAQ here](https://github.com/leptos-rs/leptos#faqs).

#### Setting up our Leptos App

We will be using Trunk for developing and building our Leptos App. Trunk is a great tool for developing Rust/WASM Apps, and is very similar to Bun (in a sense) in that it is a wrapper around the underlying tools. Let's install it first:

```bash
# Install dependencies
$ cargo install trunk
```

We can then set up our project, which we'll call `ui-internal`:

```bash
$ cargo init ui-internal
$ cd ui-internal
```

We'll immediately adjust our `Cargo.toml` file with the dependencies we'll need, as well as a few common WASM optimizations for our release builds:

```toml
[package]
name = "ui-internal"
version = "0.1.0"
edition = "2021"

# Define our supported locales.
[package.metadata.leptos-i18n]
default = "en"
locales = ["en"]
locales-dir = "./messages"

# Optimize for WASM binary size.
[profile.release]
opt-level = 'z'
lto = true
codegen-units = 1

[dependencies]
# Core leptos library.
leptos = { version = "0.5.1", features = ["csr", "nightly"] }
# Leptos Meta adds support for adjusting <head> from within components.
leptos_meta = { version = "0.5.1", features = ["csr", "nightly"] }
# Router and Route state management.
leptos_router = { version = "0.5.1", features = ["csr", "nightly"] }
# Leptos support for i18n localization.
leptos_i18n = { version = "0.2", features = ["csr", "nightly"] }
# Lightweight logging support.
log = "0.4"

# Common WASM libraries.
wasm-bindgen = { version = "0.2" }
console_log = { version = "1" }
console_error_panic_hook = { version = "0.1" }

```

And finally, we'll use Rust Nightly to develop our App, which gives us a few better ergonomics:

```bash
$ rustup toolchain install nightly
$ rustup default nightly
$ rustup target add wasm32-unknown-unknown
```

Let's create a quick `index.html` file in the root of the `ui-internal/` folder, just to get started:

```html
<!DOCTYPE html>
<html>
  <head></head>
  <body></body>
</html>
```

And replace the contents of our `src/main.rs`:

```rust
use leptos::*;

mod app;

pub fn main() {
    // Register log and panich handlers.
    let _ = console_log::init_with_level(log::Level::Debug);
    console_error_panic_hook::set_once();

    mount_to_body(|| {
        view! { <app::Layout /> }
    });
}
```

We'll also create a `src/app.rs` file with the following (we'll update this file later):

```rust
use leptos::*;

#[component]
pub fn Layout() -> impl IntoView {
    view! { <p>"Hello, world!"</p>}
}
```

We can now run our App using Trunk:

```bash
$ trunk serve --open
```

Voila, we've got a little Hello World Leptos app!

#### Setting up Tailwind CSS

Let's configure Tailwind CSS for our Leptos App. First, we need to tell Tailwind where to look for files that might contain our CSS classes. Create a `ui-internal/tailwind.config.ts` file with the following:

```typescript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    files: ["*.html", "./src/**/*.rs"],
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
```

We also need to tell `trunk` to build Tailwind CSS as part of its build process. We can do this by creating a `ui-internal/Trunk.toml` file:

```toml
[[hooks]]
stage = "pre_build"
command = "sh"
command_arguments = [
  "-c",
  "bunx tailwindcss --input resources/input.css --output public/output.css",
]
```

This let's `trunk` know that before it builds our WASM App, it should run the `bunx tailwindcss ...` command, which will generate our Tailwind CSS file, which it puts into `public/output.css`.

Now, you might have noticed we also have an input file. Let's get that set up, along with a `resources/` folder:

```bash
$ mkdir ui-internal/resources
```

We'll then create our base Tailwind CSS file at `ui-internal/resources/input.css`, mimicing our Next.js setup:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}

```

Final step, we need to pull in our Tailwind CSS file in our `index.html`. Update the contents to the following:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link data-trunk rel="rust" data-wasm-opt="z" />
    <link data-trunk rel="icon" type="image/ico" href="/public/favicon.ico" />
    <link data-trunk rel="css" href="/public/output.css" />
    <title>Hello, World!</title>
  </head>

  <body></body>
</html>
```

And that's it! We've now integrated Tailwind CSS into our Leptos App.

#### Setting up Localization

We're using [leptos_i18n](https://github.com/Baptistemontan/leptos_i18n) for localization in Leptos, which supports an API that's very close to the one we used in Next.js. We already pulled in the dependency when we updated our `Cargo.toml` file earlier, so let's get the rest of it set up.

We'll create a `ui-internal/messages/` folder where our locales will live:

```bash
$ mkdir ui-internal/messages
```

We'll define our first locale, English, in a `messages/en.json` file:

```json
{
  "home": {
    "intro": "Welcome!"
  }
}
```

And also a French locale, in a `messages/fr.json` file:

```json
{
  "home": {
    "intro": "Bienvenue!"
  }
}
```

[leptos_i18n](https://github.com/Baptistemontan/leptos_i18n#loading-the-locales) exposes a macro `load_locales!()` that looks for our configuration and generates code specific for our project that we can load in our App.

Let's update `src/main.rs`, and also pull in a new module `home` in anticipation of creating splitting our code out from the current `app.rs` file:

```rust
use leptos::*;

mod app;
mod home;

// Load our locales from the files defined in `Cargo.toml`.
leptos_i18n::load_locales!();

pub fn main() {
    // Register log and panich handlers.
    let _ = console_log::init_with_level(log::Level::Debug);
    console_error_panic_hook::set_once();

    mount_to_body(|| {
        view! { <app::Layout /> }
    });
}
```

Let's create a `src/home.rs` in which will use our locales:

```rust
use crate::i18n::*;
use leptos::*;
use leptos_router::*;

#[component]
pub fn Page() -> impl IntoView {
    let i18n = use_i18n();

    view! {
        <div class="grid place-content-center content-center h-screen">
            <h1 class="text-6xl">{t!(i18n, home.intro)}</h1>
            <div class="grid gap-4 grid-cols-2">
                <A href="/fr">"Go to fr"</A>
                <A href="/en">"Go to en"</A>
            </div>
        </div>
    }
}
```

The magic here comes from the `crate::i18n::*` which got generated by `leptos_i18n::load_locales!()`, and the `use_i18n` hook that we now got access to. Very similar to our Next.js App, we then call the macro `t!` to get the correct translation for the current locale, given a JSON key.

We're not entirely done yet, we need to tell our Leptos App about the `I18nContext` at the root of our application. We also still need to add support for routing between locales.

Let's update `src/app.rs` to do this:

```rust
use crate::i18n::*;
use leptos::*;
use leptos_meta::*;
use leptos_router::*;

use crate::home;

const DEFAULT_LOCALE: &str = "en";

#[derive(Params, PartialEq, Clone, Debug)]
pub struct LayoutParams {
    locale: String,
}

#[component(transparent)]
fn LocalizedRoute<P, F, IV>(path: P, view: F) -> impl IntoView
where
    P: std::fmt::Display,
    F: Fn() -> IV + 'static,
    IV: IntoView,
{
    view! {
        <Route path=format!("/:locale{}", path) view=move || {
            // Extract the locale from the path.
            let i18n = use_i18n();
            let params = use_params::<LayoutParams>();
            let chosen_locale = move || params().map(|params| params.locale).unwrap_or(DEFAULT_LOCALE.to_string());

            create_effect(move |_| {
                // Figure out what the current locale is, and if it matches the chosen locale from path.
                let current_locale = i18n();
                let new_locale = match chosen_locale().as_str() {
                    "fr" => Locale::fr,
                    "en" => Locale::en,
                    _ => Locale::en,
                };
                // Update the locale if necessary.
                if current_locale != new_locale {
                    i18n(new_locale);
                }
            });

            view! {
                {view()}
            }
        }/>
    }
}

#[component]
pub fn Layout() -> impl IntoView {
    provide_meta_context();
    provide_i18n_context();

    view! {
        <Router>
            <main>
                <Routes>
                    <Route path="" view=move || view! { <Redirect path=format!("/{}", DEFAULT_LOCALE)/> }/>
                    <LocalizedRoute path="" view=move || view! { <home::Page/> }/>
                </Routes>
            </main>
        </Router>
    }
}
```

There's a lot to unpack here, so let's go through it step by step.

- In our `pub fn Layout() -> impl IntoView` component we set up a normal `Router` component, which will handle routing for us.
- We introduce a special route, `LocalizedRoute`, which handles detecting our locale and switching the active locale if the path changes.
- In our `fn LocalizedRoute` function we wrap the normal `Route` component, and inject a bit of logic before returning the `view` that was otherwise passed into our `LocalizedRoute`.

The last part is the most interesting, so let's break down what we are doing inside the `Route` we are setting up for `LocalizedRoute`.

First we get the current parameters, which we know will contain a `locale` key:

```rust
// Extract the locale from the path.
let i18n = use_i18n();
let params = use_params::<LayoutParams>();
let chosen_locale = move || params().map(|params| params.locale).unwrap_or(DEFAULT_LOCALE.to_string());
```

We then create an effect that will run every time the parameters change, which will be every time the path changes:

```rust
create_effect(move |_| {
    // Figure out what the current locale is, and if it matches the chosen locale from path.
    let current_locale = i18n();
    let new_locale = match chosen_locale().as_str() {
        "fr" => Locale::fr,
        "en" => Locale::en,
        _ => Locale::en,
    };
    // Update the locale if necessary.
    if current_locale != new_locale {
        i18n(new_locale);
    }
});
```

The thing that makes our effect rerun is our usage of `i18n()` which subscribes us to the signal, and thus reruns the effect every time the locale changes.


You should now have a structure that looks like this:

```bash
.
├── Cargo.lock
├── Cargo.toml
├── Trunk.toml
├── index.html
├── messages
│   ├── en.json
│   └── fr.json
├── public
│   └── favicon.ico
├── resources
│   └── input.css
├── src
│   ├── app.rs
│   ├── home.rs
│   └── main.rs
├── tailwind.config.ts
```

And that's it! We're now able to run our app and check it out in the browser:

```bash
$ trunk serve --open
```

<div style="text-align:center;">
<a href="/resources/images/the-stack-part-3-ui-internal-skeleton.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/the-stack-part-3-ui-internal-skeleton.thumbnail.png" loading="lazy" alt="Screenshot of our ui-internal" title="Screenshot of our ui-internal" width="60%" /></a>
</div>

Again, it may not look like much, but we've implemented a lot of the core functionality we need to get started!

As the final step we will add our commands to just, [extending our existing justfile](/posts/2023-10-07-the-stack-part-2.html#bonus-just):

```makefile
_setup-ui-internal:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd ui-internal
  rustup toolchain install nightly
  rustup default nightly
  rustup target add wasm32-unknown-unknown

_dev-ui-internal:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd ui-internal
  trunk serve
```

## Bonus: End-to-End Tests

End-to-End tests are a great way to ensure that our App is working as expected, and that we don't accidentally break something when we make changes. We'll use [Playwright](https://playwright.dev/) for this, which is a great tool for writing End-to-End tests.

We want three different test suites to cover:

- **ui-app**: Test our Next.js App.
- **ui-internal**: Test our Leptos App.
- **deployment**.: Test our deployed App to verify it is working as expected.

Let's start by setting up our folder structure. Many of our configuration files will be the same across all three test suites, let's create an `end2end` folder for our projects:

```bash
$ mkdir -p deployment/end2end/tests
$ mkdir -p ui-app/end2end/tests
$ mkdir -p ui-internal/end2end/tests
```

We intentionally make a distinction between `end2end/` and unit/integration tests which will live in `tests/`. These have very different requirements for how to run them, and we often want to run them at different times.

Before we can run anything, we will need a couple of other files to set up Playwright as well as support for TypeScript.

Let's create a `tsconfig.json` for all for all three projects (`ui-app`, `ui-internal`, and `deployment`). We'll place it at `<project>/end2end/tsconfig.json`:

```json
{
  "compilerOptions": {
    "lib": ["esnext"],
    "module": "esnext",
    "target": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "moduleDetection": "force",
    "allowJs": true, // allow importing `.js` from `.ts`
    "esModuleInterop": true, // allow default imports for CommonJS modules
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noImplicitAny": false
  }
}
```

Now, let's configure Playwright for all for all three projects (`ui-app`, `ui-internal`, and `deployment`). We'll place it at `<project>/end2end/playwright.config.ts`:

```typescript
import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";

const SERVER = `http://localhost:8080`;

const config: PlaywrightTestConfig = {
  testDir: "./tests",
  // Maximum time one test can run for.
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  // Run tests in files in parallel.
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  // Retry on CI only.
  retries: process.env.CI ? 2 : 0,
  // [Optional] Opt out of parallel tests on CI.
  // workers: process.env.CI ? 1 : undefined,
  // Limit the number of failures on CI to save resources
  maxFailures: process.env.CI ? 10 : undefined,

  reporter: "html",
  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: SERVER,
    // Maximum time each action such as `click()` can take. Defaults to 0 (no limit).
    actionTimeout: 0,
    // Collect trace when retrying the failed test.
    trace: "on-first-retry",
  },

  // Configure which browsers to test against.
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "just dev ui-internal",
    url: SERVER,
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
  },
};

export default config;
```

There are some minor adjustments we want to do in the above configuration for each project:

- **ui-app**: Set the `SERVER` variable to `http://localhost:3000` and command to `just dev ui-app`.
- **ui-internal**: Set the `SERVER` variable to `http://localhost:8080` and command to `just dev ui-internal`.
- **deployment**: Remove the `webServer` block, and set the `SERVER` variable to `http://${process.env.DOMAIN}`.


And a `package.json` in `<project>/end2end/package.json`:

```json
{
  "name": "end2end",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "setup": "playwright install",
    "e2e": "playwright test"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "bun-types": "latest",
    "@types/node": "^20.5.0",
    "typescript": "^5",
    "@playwright/test": "^1.38.1"
  }
}
```

We are now ready to add our first test! Since we have just added localization, let's make sure that it works and doesn't regress.

For all three projects `ui-app`, `deployment`, and `ui-internal` we'll create a test in `<project>/end2end/tests/localization.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("localization translates text when changing language", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(
    "Welcome!"
  );

  await page.getByText('Go to fr').dblclick();
  await expect(page.locator("h1")).toHaveText(
    "Bienvenue!"
  );
});

test("localization loads correct text from URL", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator("h1")).toHaveText(
    "Bienvenue!"
  );
});
```

This same test works for both apps since we've set them up with the same functionality.

Let's try and run them:

```bash
$ cd ui-app/end2end # or cd ui-internal/end2end
$ bun run e2e
```

And for `deployment` we can test it locally by starting up `just dev ui-app` in another terminal, and then running:

```bash
$ cd deployment/end2end # or cd ui-internal/end2end
$ DOMAIN="localhost:3000" bun run e2e
```

NOTE: You might want to add the following to your `.gitignore`:

```
playwright-report
test-results
```

And that's it! We've now got an easy way to run End-to-End tests. Let's do our final step and add this to our `justfile`:

```makefile
# Run End-to-End tests for <project>, e.g. `just e2e ui-internal`.
e2e project:
  just _e2e-{{project}}

_e2e-deployment:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd deployment/end2end
  bun run e2e

_e2e-ui-app:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd ui-app/end2end
  bun run e2e

_e2e-ui-internal:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd ui-internal/end2end
  bun run e2e
```

And we'll also update our `_setup-project` commands to setup the Playwright dependencies:

```makefile
_setup-deployment:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd deployment
  bun install
  cd end2end
  bun install
  bun run setup

_setup-ui-app:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd ui-app
  bun install
  cd end2end
  bun install
  bun run setup

_setup-ui-internal:
  #!/usr/bin/env bash
  set -euxo pipefail
  cd ui-internal
  rustup toolchain install nightly
  rustup default nightly
  rustup target add wasm32-unknown-unknown
  cd end2end
  bun install
  bun run setup
```

## Bonus: DevEx Improvements

There are a few Editor improvements [that are recommended](https://leptos-rs.github.io/leptos/appendix_dx.html) for working with Leptos and Tailwind CSS if you are using VS Code.

Add to your settings:

```json
{
  "rust-analyzer.procMacro.ignored": {
    "leptos_macro": ["server", "component"]
  },
  "emmet.includeLanguages": {
    "rust": "html",
    "*.rs": "html"
  },
  "tailwindCSS.includeLanguages": {
    "rust": "html",
    "*.rs": "html"
  },
  "files.associations": {
    "*.rs": "rust"
  },
  "editor.quickSuggestions": {
    "other": "on",
    "comments": "on",
    "strings": true
  },
  "css.validate": false
}
```

Another nice tool is [leptosfmt](https://github.com/bram209/leptosfmt), which helps keep our Leptos View macro code nicely formatted.

You can install it via:

```bash
$ cargo install leptosfmt
```

And then add this to your settings:

```json
{
  "rust-analyzer.rustfmt.overrideCommand": ["leptosfmt", "--stdin", "--rustfmt"]
}
```

## Automating Deployments via CDK

- Build artifact
  - [x] Split ui-app/ui-internal build into a workflow
  - [x] Pass optional argument to upload artifact
  - [x] Pass optional argument for release build
  - [x] Run builds in cd-deploy to upload artifacts
  - [x] Fetch artifacts in wf-deploy
- [ ] Publish to S3 + CloudFront
- [ ] Configure API route proxy on CloudFront already?

Since we are now generating artifacts that we want to deploy, from multiple projects, we need to restructure our existing deployment pipeline slightly.

We still want to retain staggered deployments, but we need a bit of coordination to make sure we have all relevant artifacts before we deploy.

Our new flow will look like this:

<div style="text-align:center;">
<a href="/resources/images/the-stack-part-3-updated-flow.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/the-stack-part-3-updated-flow.thumbnail.png" loading="lazy" alt="Updated deployment pipeline" title="Updated deployment pipeline" width="100%" /></a>
</div>

#### Building artifacts in CI

In this part we will be doing the following:

- Extend our existing `cd-deploy.yml` workflow to build artifacts for `ui-app` and `ui-internal` via a reuseable workflow.
- Extend our existing `wf-deploy.yml` workflow to download artifacts so it can use it during deployments.
- Set up a reuseable workflow, `wf-build.yml`, that will build our artifacts.
- Set up a reuseable workflows for both `ui-app` and `ui-internal` that will do the actual building.


Let's start with our `wf-build-ui-app.yml` workflow:

```yaml
name: "Build: ui-app"

on:
  workflow_call:
    inputs:
      release:
        type: boolean
        default: false
      upload-artifact:
        type: boolean
        default: false

jobs:
  ui-app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - uses: oven-sh/setup-bun@v1
      - uses: extractions/setup-just@v1

      - name: Install dependencies
        working-directory: ./ui-app
        run: bun install

      - name: Build Next.js project
        run: just build ui-app

      - uses: actions/upload-artifact@v3
        if: ${{ inputs.upload-artifact }}
        with:
          name: ui-app
          path: ui-app/out
          if-no-files-found: error
          retention-days: 1
```

And our `wf-build-ui-internal.yml` workflow:

```yaml
name: "Build: ui-internal"

on:
  workflow_call:
    inputs:
      release:
        type: boolean
        default: false
      upload-artifact:
        type: boolean
        default: false

jobs:
  ui-internal:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - uses: extractions/setup-just@v1
      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@nightly
        with:
          toolchain: nightly-2023-10-11
          targets: wasm32-unknown-unknown

      - name: Install trunk
        uses: jaxxstorm/action-install-gh-release@v1.9.0
        with:
          repo: thedodd/trunk
          platform: linux # Other valid options: 'windows' or 'darwin'.
          arch: x86_64

      - uses: actions/cache@v3
        continue-on-error: false
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            ui-internal/target
          key: cargo-${{ hashFiles('Cargo.lock') }}-${{ hashFiles('ui-internal/Cargo.lock') }}-ui-internal
          restore-keys: cargo-

      - name: Build release build
        if: ${{ inputs.release }}
        run: just build ui-internal

      - name: Build debug build
        if: ${{ !inputs.release }}
        run: just build ui-internal true

      - uses: actions/upload-artifact@v3
        if: ${{ inputs.upload-artifact }}
        with:
          name: ui-internal
          path: ui-internal/dist
          if-no-files-found: error
          retention-days: 1
```

Both of these workflows take two optional arguments:

- `release`: Whether or not to build a release build.
- `upload-artifact`: Whether or not to upload the artifact to GitHub.

This means we can easily reuse these builds from our CI workflows. Once our jobs are building, we'll see these artifacts in the **Summary** view of our workflow, which will look something like this:

<div style="text-align:center;">
<a href="/resources/images/the-stack-part-3-artifacts.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/the-stack-part-3-artifacts.thumbnail.png" loading="lazy" alt="Deployment artifacts" title="Deployment artifacts" width="70%" /></a>
</div>

With these in place we can now stitch them together in a `wf-build.yml`:

```yaml
name: "Build Artifacts"

on:
  workflow_call:

jobs:
  ui-app:
    uses: ./.github/workflows/wf-build-ui-app.yml
    with:
      release: true
      upload-artifact: true

  ui-internal:
    uses: ./.github/workflows/wf-build-ui-internal.yml
    with:
      release: true
      upload-artifact: true
```

Not much going on here, we are simply calling our previously defined reuseable workflows.

We can now update our `cd-deploy.yml` workflow to call our new `wf-build.yml` workflow. To do this, we extend the existing file by adding a `build-artifacts` job as well as mark our `stage-1` job as `needs: [build-artifacts]`:

```yaml
# ...
jobs:
  # Build deployment artifacts
  build-artifacts:
    name: "Build Artifacts"
    uses: ./.github/workflows/wf-build.yml

  # Stage 1 tests that the deployment is working correctly.
  stage-1:
    name: "Stage 1"
    needs: [build-artifacts]
    uses: ./.github/workflows/wf-deploy.yml
    # ...the rest is the same
```

The final change we need to make is to make our `wf-deploy.yml` workflow download the artifacts we just built:

```yaml
# ...
jobs:
  deploy:
    name: "Deploy"
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    # Limit to only one concurrent deployment per environment.
    concurrency:
      group: ${{ inputs.environment }}
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - uses: extractions/setup-just@v1

      - name: Setup artifact directory
        run: mkdir -p ./deployment/artifacts

      # Download all artifacts from previous jobs.
      - uses: actions/download-artifact@v3
        with:
          path: ./deployment/artifacts/

      - name: Display structure of downloaded files
        working-directory: ./deployment/artifacts/
        run: ls -R

      - name: Validate artifacts
        working-directory: ./deployment/artifacts
        run: just deploy-validate-artifacts

      - name: Install dependencies
        working-directory: ./deployment
        run: bun install
      # ...the rest is the same
```

The new additions here are the steps:

- `extractions/setup-just@v1`: Make `just` available in our workflow.
- `Setup artifact directory`: Creating our artifacts folder.
- `actions/download-artifact@v3y`: Download all uploaded assets into this folder.
- `Display structure of downloaded files`: Very helpful for any debugging.
- `Validate artifacts`: Make sure we have all the artifacts we need.

The `deploy-validate-artifacts` command is defined in our `justfile`:

```makefile
# Validate that all deployment artifacts are present.
deploy-validate-artifacts:
  @ [ -d "./deployment/artifacts/ui-app" ] && echo "ui-app exists" || exit 1
  @ [ -d "./deployment/artifacts/ui-internal" ] && echo "ui-internal exists" || exit 1
```


#### Deploying to S3 + CloudFront

If we remember our three groupings, we see that `ui-app` and `ui-internal` would fit into `Services`:

- `Cloud`: Hosted Zones, VPC, Certificates, infrequently changing things
- `Platform`: DynamoDB, Cache, SQS
- `Services`: Lambdas, API Gateway, etc

So let's get our `Services` stack set up!

All files will live in the `deployment/` folder. We'll first adjust our `bin/deployment.ts`, adding our `Services` stack. Append the following at the end:

```typescript
// ...
import { Stack as ServicesStack } from "../lib/services/stack";
import { Stack as ServicesCertificateStack } from "../lib/services/stack-certificate";
// ...

/**
 * Define our 'Services' stack that provisions our applications and services, such as our
 * UI applications and APIs.
 *
 * ```bash
 * bun run cdk deploy --concurrency 4 'Services' 'Services/**'
 * ```
 */
const servicesStackName = "Services";
if (matchesStack(app, servicesStackName)) {
  // Set up our us-east-1 specific resources.
  const certificateStack = new ServicesCertificateStack(
    app,
    `${servicesStackName}Certificate`,
    {
      env: {
        account: process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT,
        region: "us-east-1",
      },
      crossRegionReferences: true,
      domain: validateEnv("DOMAIN", `${servicesStackName}Certificate`),
    }
  );
  // Set up our service resources.
  new ServicesStack(app, servicesStackName, {
    env: {
      account: process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT,
      region:
        process.env.AWS_REGION ||
        process.env.AWS_DEFAULT_REGION ||
        process.env.CDK_DEFAULT_REGION,
    },
    crossRegionReferences: true,
    domain: validateEnv("DOMAIN", servicesStackName),
    certificate: certificateStack.certificate,
  });
}
```

We need to do a bit of a cross-region stack dance here, since CloudFront certificates can only live in `us-east-1`, but our actual services are defined in a different region. We split these two up into two different stacks, and then pass the certificate from the `ServicesCertificateStack` to the `ServicesStack`.

Additionally, we need to enable `crossRegionReferences` down through all of our stacks that might access cross-region resources ([docs here](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib-readme.html#accessing-resources-in-a-different-stack-and-region)).

Our `ServicesCertificateStack` points to our new stack which we will set up in `lib/services/stack-certificate.ts`:

```typescript
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";

interface StackProps extends cdk.StackProps {
  /**
   * The domain name the application is hosted under.
   */
  readonly domain: string;
}

export class Stack extends cdk.Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.domain,
    });

    // Importantly this has to live in us-east-1 for CloudFront to be able to use it.
    // Set up an ACM certificate for the domain + subdomains, and validate it using DNS.
    const cert = new acm.Certificate(this, "Certificate", {
      domainName: props.domain,
      subjectAlternativeNames: [`*.${props.domain}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
    this.certificate = cert;
  }
}
```

And our `ServicesStack` is defined in `lib/services/stack.ts`:

```typescript
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3Website from "./s3-website";
import * as acm from "aws-cdk-lib/aws-certificatemanager";

interface StackProps extends cdk.StackProps {
  /**
   * The domain name the application is hosted under.
   */
  readonly domain: string;

  /**
   * The ACM Certificate ARN to use with CloudFront.
   */
  readonly certificate: acm.Certificate;
}

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Set up our s3 website for ui-app.
    new s3Website.Stack(this, "WebsiteUiApp", {
      ...props,
      assets: "artifacts/ui-app",
      index: "index.html",
      error: "404.html",
      domain: props.domain,
      hostedZone: props.domain,
      certificateArn: props.certificate.certificateArn,
      billingGroup: "ui-app",
      rewriteUrls: true,
    });

    // Set up our s3 website for ui-internal.
    new s3Website.Stack(this, "WebsiteUiInternal", {
      ...props,
      assets: "artifacts/ui-internal",
      index: "index.html",
      error: "index.html",
      domain: `internal.${props.domain}`,
      hostedZone: props.domain,
      certificateArn: props.certificate.certificateArn,
      billingGroup: "ui-internal",
    });
  }
}
```

In here we deploy both `ui-app` and `ui-internal` the same way, but do some minor adjustments to the props we pass on to the stack to ensure it gets the right assets and also the right domain.

This brings us to our final part, which is the most lengthy, our `lib/services/s3-website.ts`:

```typescript
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Patterns from "aws-cdk-lib/aws-route53-patterns";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfrontOrigins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "path";

export interface StackProps extends cdk.StackProps {
  /**
   * The path to the assets we are deploying.
   */
  readonly assets: string;

  /**
   * The file to use as the root/index page.
   */
  readonly index: string;

  /**
   * The file to redirect upon errors or 404s.
   */
  readonly error: string;

  /**
   * The domain name the application is hosted under.
   */
  readonly domain: string;

  /**
   * The hosted zone that controls the DNS for the domain.
   */
  readonly hostedZone: string;

  /**
   * The billing group to associate with this stack.
   */
  readonly billingGroup: string;

  /**
   * The ACM Certificate ARN.
   */
  readonly certificateArn: string;

  /**
   * Whether to rewrite URLs to /folder/ -> /folder/index.html.
   */
  readonly rewriteUrls?: boolean;
}

/**
 * Set up an S3 bucket, hosting our assets, with CloudFront in front of it.
 */
export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Create our S3 Bucket, making it private and secure.
    const bucket = new s3.Bucket(this, "WebsiteBucket", {
      publicReadAccess: false,
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    cdk.Tags.of(bucket).add("billing", `${props.billingGroup}-s3`);
    cdk.Tags.of(bucket).add("billing-group", `${props.billingGroup}`);

    // Set up access between CloudFront and our S3 Bucket.
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "OriginAccessIdentity"
    );
    bucket.grantRead(originAccessIdentity);

    // Rewrite requests to /folder/ -> /folder/index.html.
    let rewriteUrl: cloudfront.experimental.EdgeFunction | undefined;
    if (props.rewriteUrls) {
      rewriteUrl = new cloudfront.experimental.EdgeFunction(this, "RewriteFn", {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: "rewrite-urls.handler",
        code: lambda.Code.fromAsset(path.resolve("edge-functions")),
      });
    }

    // Configure our CloudFront distribution.
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      domainNames: [props.domain],
      certificate: acm.Certificate.fromCertificateArn(
        this,
        "Certificate",
        props.certificateArn
      ),
      // Allow both HTTP 2 and 3.
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // Our default behavior is to redirect to our index page.
      defaultRootObject: props.index,
      defaultBehavior: {
        // Set our S3 bucket as the origin.
        origin: new cloudfrontOrigins.S3Origin(bucket, {
          originAccessIdentity,
        }),
        // Redirect users from HTTP to HTTPs.
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        edgeLambdas:
          rewriteUrl !== undefined
            ? [
                {
                  functionVersion: rewriteUrl.currentVersion,
                  eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
                },
              ]
            : undefined,
      },
      // Set up redirects when a user hits a 404 or 403.
      errorResponses: [
        {
          httpStatus: 403,
          responsePagePath: `/${props.error}`,
          responseHttpStatus: 200,
        },
        {
          httpStatus: 404,
          responsePagePath: `/${props.error}`,
          responseHttpStatus: 200,
        },
      ],
    });
    cdk.Tags.of(distribution).add(
      "billing",
      `${props.billingGroup}-cloudfront`
    );
    cdk.Tags.of(distribution).add("billing-group", `${props.billingGroup}`);

    // Upload our assets to our bucket, and connect it to our distribution.
    new s3deploy.BucketDeployment(this, "WebsiteDeployment", {
      destinationBucket: bucket,
      sources: [s3deploy.Source.asset(path.resolve(props.assets))],
      // Invalidate the cache for / and index.html when we deploy so that cloudfront serves latest site
      distribution,
      distributionPaths: ["/", `/${props.index}`],
    });

    // Set up our DNS records that points to our CloudFront distribution.
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.hostedZone,
    });

    new route53.ARecord(this, "Alias", {
      zone: hostedZone,
      recordName: props.domain,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution)
      ),
    });

    // Make www redirect to the root domain.
    new route53Patterns.HttpsRedirect(this, "Redirect", {
      zone: hostedZone,
      recordNames: [`www.${props.domain}`],
      targetDomain: props.domain,
    });
  }
}
```

And our Lambda@Edge function to rewrite urls is defined in `edge-functions/rewrite-urls.js`:

```typescript
exports.handler = (event, _, callback) => {
  let request = event.Records[0].cf.request;

  // Check whether the URI is missing a file name.
  if (request.uri.endsWith("/")) {
    request.uri += "index.html";
  } else if (!request.uri.includes(".")) {
    // Check whether the URI is missing a file extension.
    request.uri += "/index.html";
  }

  return callback(null, request);
};
```


There is quite a bit going on here. A rough overview of what is happening:

- We create an S3 Bucket, which will host our assets.
- The S3 Bucket will be configured to with encryption and to block public read access.
- We create a CloudFront distribution, which will serve our assets.
- The CloudFront distribution will also redirect HTTP to HTTPS, use our domain name and certificate, as well as support HTTP 2 and 3.
- If enabled via `rewriteUrls`, we will also set up a Lambda@Edge function that will rewrite URLs to `/folder/` -> `/folder/index.html`. This is necessary to support the way Next.js generates its files.

And that's it! Your `ui-app` will now live at the root of your domain, e.g. `app.example.com`, and `ui-internal` will live at the subdomain `internal` e.g. `internal.app.example.com`.

## Next Steps

Next up is to set up our Federated GraphQL API! Follow along in Part 4 of the series (will be posted soon).