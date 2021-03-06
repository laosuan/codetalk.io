---
title: Mobile Haskell (iOS)
tags: haskell, mobile, iOS
versions:
- 'Xcode Version 9.2 (9C40b)'
- 'Cabal HEAD (commit [94a7374](https://github.com/haskell/cabal/commit/94a7374d7b1a9b55454209e92d5057ba81be7d6a){target="_blank" rel="noopener noreferrer"})'
- 'Stack Version 1.6.3'
- 'LLVM Version 5.0.1'
---

A lot of progress has been going on to make Haskell work on mobile natively, instead of e.g. generating JavaScript via GHCJS and using that. Unfortunately, not much documentation exists yet on how to build a project using these tools all together.

This post will be an attempt to piece together the tools and various attempts into a coherent step-by-step guide. We will start by setting up the tools needed, and then build an iOS app that runs in both the simulator and on the device itself (i.e. a x86 build and an arm build).

<div></div><!--more-->

For the impatient and brave, simply,

- clone down the [MobileHaskellFun](https://github.com/Tehnix/MobileHaskellFun){target="_blank" rel="noopener noreferrer"} repository,
- run `./setup-tools.sh` to set up the tools,
- `cd` into `Offie/hs-src/`
  - build the package index `./call x86_64-apple-ios-cabal new-update --allow-newer`,
  - run `./call make iOS` to compile the program for iOS,
- and finally launch Xcode and start the simulator.

## Setting up the Tools

A bunch of tools are needed, so we will set these up first. You might have some of these, but I will go through them anyways, for good measure. The steps will assume that we are on macOS for some parts, but it should not be part to adapt these to your system (all steps using `brew`).

If you don't have [stack](https://docs.haskellstack.org/en/stable/README/){target="_blank" rel="noopener noreferrer"} installed already, set it up with,

```bash
$ curl -sSL https://get.haskellstack.org/ | sh
```

We will collect all our tools and GHC versions in a folder in `$HOME`—for convenience—so first we are a going to create that directory,

```bash
$ mkdir -p ~/.mobile-haskell
```

Next step is cloning down [cabal](github.com/haskell/cabal){target="_blank" rel="noopener noreferrer"} and building cabal-install. This is necessary until `new-update` lands.

```bash
$ cd ~/.mobile-haskell
$ git clone git@github.com:haskell/cabal.git
$ cd cabal-install && stack exec --no-ghc-package-path -- ./bootstrap.sh
```

If you have `cabal-install` and a system GHC already, then you can try and install it via `cabal new-build cabal-install` instead, which is less brittle. I wanted to remove the need to setup these though, so I went with the `./bootstrap.sh` approach.

*NOTE*: If you are having trouble with e.g. errors on packages being shadowed, try the good ol' cabal-hell fix, and nuke `~/.ghc` and `~/.cabal/`.

Install LLVM version 5,

```bash
$ brew install llvm
```

This should set up LLVM in `/usr/local/opt/llvm@5/bin` (or just `/usr/local/opt/llvm/bin`), remember this path for later.

We'll now set up the tools from [http://hackage.mobilehaskell.org](http://hackage.mobilehaskell.org){target="_blank" rel="noopener noreferrer"}, namely the toolchain-wrapper and the different GHC versions we will use.

Let's start off with getting our GHCs, by downloading `ghc-8.4.0.20180109-x86_64-apple-ios.tar.xz` and `ghc-8.4.0.20180109-aarch64-apple-ios.tar.xz`, for the simulator and device respectively. You can download the by cliking their links on the website, or curl them down with (the links are probably outdated soon, so replace the links with the ones on the site),

```bash
$ cd ~/.mobile-haskell
$ curl -o ghc-aarch64-apple-ios.tar.xz http://releases.mobilehaskell.org/x86_64-apple-darwin/9824f6e473/ghc-8.4.0.20180109-aarch64-apple-ios.tar.xz
$ curl -o ghc-x86_64-apple-ios.tar.xz http://releases.mobilehaskell.org/x86_64-apple-darwin/9824f6e473/ghc-8.4.0.20180109-x86_64-apple-ios.tar.xz
```

Now, let's unpack these into their own folders (assuming you're still in `~/.mobile-haskell`),

```bash
$ mkdir -p ghc-aarch64-apple-ios && xz -d ghc-aarch64-apple-ios.tar.xz && tar -xf ghc-aarch64-apple-ios.tar -C ghc-aarch64-apple-ios
$ mkdir -p ghc-x86_64-apple-ios && xz -d ghc-x86_64-apple-ios.tar.xz && tar -xf ghc-x86_64-apple-ios.tar -C ghc-x86_64-apple-ios
```

Next up is the toolchain-wrapper, which provides wrappers around `cabal` and other tools we need,

```bash
$ cd ~/.mobile-haskell
$ git clone git@github.com:zw3rk/toolchain-wrapper.git
$ cd toolchain-wrapper && ./bootstrap
```

<!--
We will also need an up-to-date version of [libffi](https://github.com/libffi/libffi) with support for other architectures (this [PR](https://github.com/libffi/libffi/pull/307)). We will use the fork from `zw3rk` for now,

```bash
$ cd ~/.mobile-haskell
$ mkdir -p lffi
$ git clone https://github.com/zw3rk/libffi.git
$ cd libffi
```

and then build libffi for each of our target architectures,

```bash
$ ./autogen.sh
$ CC="$HOME/.mobile-haskell/toolchain-wrapper/aarch64-apple-ios-clang" \
CXX="$HOME/.mobile-haskell/toolchain-wrapper/aarch64-apple-ios-clang" \
        ./configure \
        --prefix=$HOME/.mobile-haskell/lffi/aarch64-apple-ios \
        --host=aarch64-apple-ios \
        --enable-static=yes --enable-shared=yes
$ make && make install
$ git clean -f -x -d
$ ./autogen.sh
$ CC="$HOME/.mobile-haskell/toolchain-wrapper/x86_64-apple-ios-clang" \
CXX="$HOME/.mobile-haskell/toolchain-wrapper/x86_64-apple-ios-clang" \
        ./configure \
        --prefix=$HOME/.mobile-haskell/lffi/x86_64-apple-ios \
        --host=x86_64-apple-ios \
        --enable-static=yes --enable-shared=yes
$ make && make install
```

We should now have our libffi files for the two targets living in `~/.mobile-haskell/lffi/aarch64-apple-ios` and `~/.mobile-haskell/lffi/x86_64-apple-ios` respectively.
-->

And that's it! We have now set up all the tools we need for later. If you want all the steps as a single script, check out the [setup script in the MobileHaskellFun repo](https://github.com/Tehnix/MobileHaskellFun/blob/master/setup-tools.sh){target="_blank" rel="noopener noreferrer"}.

## Setting up the Xcode Project

Setting up Xcode is a bit of a visual process, so I'll augment these steps with pictures, to hopefully make it clear what needs to be done.

First, let's set up our Xcode project, by creating a new project.

<a href="/resources/images/mobile-haskell-1. Create Project.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-1. Create Project.thumbnail.png" loading="lazy" alt="1. Create Project" title="1. Create Project" width="100%" /></a>

Choose `Single View Application`,

<a href="/resources/images/mobile-haskell-1.1. Create Project - Single View Application.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-1.1. Create Project - Single View Application.thumbnail.png" loading="lazy" alt="1.1. Create Project - Single View Application" title="1.1. Create Project - Single View Application" width="100%" /></a>

And set the name and location of your project,

<div class="clear two-images">
  <a href="/resources/images/mobile-haskell-1.2. Create Project - Name.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-1.2. Create Project - Name.thumbnail.png" loading="lazy" alt="1.2. Create Project - Name" title="1.2. Create Project - Name" /></a>
  <a href="/resources/images/mobile-haskell-1.3. Create Project - Set Location.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-1.3. Create Project - Set Location.thumbnail.png" loading="lazy" alt="1.3. Create Project - Set Location" title="1.3. Create Project - Set Location" /></a>
</div>

Now, let's add a folder to keep our Haskell code in and call it `hs-src`, by right-clicking our project and adding a `New Group`,

<div style="text-align:center;">
<a href="/resources/images/mobile-haskell-2. Add Source Folder for Haskell Code.png" target="_blank" rel="noopener noreferrer"><img width="40%" src="/resources/images/mobile-haskell-2. Add Source Folder for Haskell Code.thumbnail.png" loading="lazy" alt="2. Add Source Folder for Haskell Code" title="2. Add Source Folder for Haskell Code" /></a>
</div>



## Interlude: Set up the Haskell Code

Before we proceed, let's set up the Haskell code. Navigate to the `hs-src` directory, and add the following files (don't worry, we'll go through their contents),

```bash
$ mkdir -p src
$ touch MobileFun.cabal cabal.project Makefile call LICENSE src/Lib.hs
```

**./hs-src/cabal.project**

We use the features of `cabal.project` to set our package repository to use the hackage.mobilehaskell.org overlay.

```haskell
packages: .

repository hackage.mobilehaskell
  url: http://hackage.mobilehaskell.org/
  secure: True
  root-keys: 8184c1f23ce05ab836e5ebac3c3a56eecb486df503cc28110e699e24792582da
             81ff2b6c5707d9af651fdceded5702b9a6950117a1c39461f4e2c8fc07d2e36a
             8468c561cd02cc7dfe27c56de0da1a5c1a2b1b264fff21f4784f02b8c5a63edd
  key-threshold: 3
```

**./hs-src/MobileFun.cabal**

Just a simple cabal package setup.

```haskell
name:                MobileFun
version:             0.1.0.0
license:             BSD3
license-file:        LICENSE
author:              Your Name
maintainer:          email@example.com
copyright:           Your Name
category:            Miscellaneous
build-type:          Simple
cabal-version:       >=1.10

library
  hs-source-dirs:      src
  exposed-modules:     Lib
  build-depends:       base >= 4.7 && < 5
                     , freer-simple
  default-language:    Haskell2010
```

**./hs-src/Makefile**

The Makefile simplifies a lot of the compilation process and passes the flags we need to use.

```makefile
LIB=MobileFun

ARCHIVE=libHS${LIB}

.PHONY: cabal-build
cabal-build:
	$(CABAL) new-configure --disable-shared --enable-static --allow-newer --ghc-option=-fllvmng
	$(CABAL) new-build --allow-newer --ghc-option=-fllvmng

binaries/iOS/$(ARCHIVE).a:
	CABAL=x86_64-apple-ios-cabal make cabal-build
	CABAL=aarch64-apple-ios-cabal make cabal-build
	mkdir -p $(@D)
	find . -path "*-ios*" -name "${ARCHIVE}*ghc*.a" -exec lipo -create -output $@ {} +

binaries/macOS/$(ARCHIVE).a:
	CABAL=cabal make cabal-build
	mkdir -p $(@D)
	find . -path "*-osx*" -name "${ARCHIVE}*ghc*.a" -exec lipo -create -output $@ {} +

binaries/android/armv7a/${ARCHIVE}.a:
	CABAL=armv7-linux-androideabi-cabal make cabal-build
	mkdir -p $(@D)
	find . -path "*arm-*-android*" -name "${ARCHIVE}*ghc*.a" -exec cp {} $@ \;

binaries/android/arm64-v8a/${ARCHIVE}.a:
	CABAL=aarch64-linux-android-cabal make cabal-build
	mkdir -p $(@D)
	find . -path "*aarch64-*-android*" -name "${ARCHIVE}*ghc*.a" -exec cp {} $@ \;

.PHONY: iOS
.PHONY: macOS
.PHONY: android
.PHONY: all
.PHONY: clean
iOS: binaries/iOS/${ARCHIVE}.a
macOS: binaries/macOS/${ARCHIVE}.a
android: binaries/android/armv7a/${ARCHIVE}.a binaries/android/arm64-v8a/${ARCHIVE}.a
all: iOS macOS android
clean:
	rm -R binaries
```

**./hs-src/src/Lib.hs**

Our Haskell code for now, is simply some C FFI that sets up a small toy function.

```haskell
module Lib where

import Foreign.C (CString, newCString)

-- | export haskell function @chello@ as @hello@.
foreign export ccall "hello" chello :: IO CString

-- | Tiny wrapper to return a CString
chello = newCString hello

-- | Pristine haskell function.
hello = "Hello from Haskell"

```

**./hs-src/call**

We use the  `call` script to set up the various path variables that point to our tools, so we don't need these polluting our global command space. If you've followed the setup so far, the paths should match out-of-the-box.

```bash
#!/usr/bin/env bash
# Path to LLVM (this is the default when installing via `brew`)
export PATH=/usr/local/opt/llvm@5/bin:$PATH
# Path to Cross-target GHCs
export PATH=$HOME/.mobile-haskell/ghc-x86_64-apple-ios/bin:$PATH
export PATH=$HOME/.mobile-haskell/ghc-aarch64-apple-ios/bin:$PATH
export PATH=$HOME/.mobile-haskell/ghc-x86_64-apple-darwin/bin:$PATH
# Path to tools.
export PATH=$HOME/.mobile-haskell/toolchain-wrapper:$PATH
export PATH=$HOME/.mobile-haskell/head.hackage/scripts:$PATH
# Path to Cabal HEAD binary.
export PATH=$HOME/.cabal/bin:$PATH

# Pass everything as the command to call.
$@
```


## Compiling Our Haskell Code

First off, we need to build our package index, so run (inside `hs-src`),

```bash
$ ./call x86_64-apple-ios-cabal new-update --allow-newer
Downloading the latest package lists from:
- hackage.haskell.org
- hackage.mobilehaskell
```

Now we can build our project by running `make` on our target. For now, we have only set up iOS, so this is what we will build.

```bash
$ ./call make iOS
CABAL=x86_64-apple-ios-cabal make cabal-build
x86_64-apple-ios-cabal new-configure --disable-shared --enable-static --allow-newer --ghc-option=-fllvmng
'cabal.project.local' file already exists. Now overwriting it.
Resolving dependencies...
Build profile: -w ghc-8.4.0.20180109 -O1
In order, the following would be built (use -v for more details):
 - natural-transformation-0.4 (lib) (requires download & build)
 - transformers-compat-0.5.1.4 (lib) (requires download & build)
 - transformers-base-0.4.4 (requires download & build)
...
find . -path "*-ios*" -name "libHSMobileFun*ghc*.a" -exec lipo -create -output binaries/iOS/libHSMobileFun.a {} +
```

We should now have our library file at `hs-src/binaries/iOS/libHSMobileFun.a`. If you change your project, to will probably need to run `./call make clean` before running `./call make iOS` again.



## Back to Xcode

Now we need to tie together the Haskell code with Xcode. Drag-and-drop the newly created files into the `hs-src` group in Xcode (if it hasn't found it by itself).

<a href="/resources/images/mobile-haskell-3. Drag the files to Xcode.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-3. Drag the files to Xcode.thumbnail.png" loading="lazy" alt="3. Drag the files to Xcode" title="3. Drag the files to Xcode" width="100%" /></a>

Since we are using Swift, we need a bridging header to bring our C prototypes into Swift. We'll do this by adding an Objective-C file to the project, `tmp.m`, which will make Xcode ask if we want to create a bridging header, `Offie-Bridging-Header.h`, for which we will answer yes.

<div style="text-align:center;">
<a href="/resources/images/mobile-haskell-4. Create Objective-C File.png" target="_blank" rel="noopener noreferrer"><img width="40%" src="/resources/images/mobile-haskell-4. Create Objective-C File.thumbnail.png" loading="lazy" alt="4. Create Objective-C File" title="4. Create Objective-C File" /></a>
</div>

<div class="clear two-images">
  <a href="/resources/images/mobile-haskell-4.1. Create Objective-C File - Choose Filetype.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-4.1. Create Objective-C File - Choose Filetype.thumbnail.png" loading="lazy" alt="4.1. Create Objective-C File - Choose Filetype" title="4.1. Create Objective-C File - Choose Filetype" /></a>
  <a href="/resources/images/mobile-haskell-4.2. Create Objective-C File - Set Name.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-4.2. Create Objective-C File - Set Name.thumbnail.png" loading="lazy" alt="4.2. Create Objective-C File - Set Name" title="4.2. Create Objective-C File - Set Name" /></a>
</div>

<div class="clear two-images">
  <a href="/resources/images/mobile-haskell-4.3. Create Objective-C File - Set Location.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-4.3. Create Objective-C File - Set Location.thumbnail.png" loading="lazy" alt="4.3. Create Objective-C File - Set Location" title="4.3. Create Objective-C File - Set Location" /></a>
  <a href="/resources/images/mobile-haskell-4.4. Create Objective-C File - Create Bridging Header.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-4.4. Create Objective-C File - Create Bridging Header.thumbnail.png" loading="lazy" alt="4.4. Create Objective-C File - Create Bridging Header" title="4.4. Create Objective-C File - Create Bridging Header" /></a>
</div>

<div class="clear"></div>

**./Offie-Bridging-Header.h**

In our bridging file, `Offie-Bridging-Header.h`, we add our prototypes that we need to glue in the Haskell code,

```c
extern void hs_init(int * argc, char ** argv[]);
extern char * hello();
```

**./AppDelegate.swift**

Now let's go into `AppDelegate.swift` and call `hs_init` to initialize the Haskell code,

```objective-c
import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplicationLaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        hs_init(nil, nil)
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}
}
```



**./ViewController.swift**

Next, we will set up a label in a view controller. You can either set this up in the story board and connect it via an `IBOutlet`.

First go into the `Main.storyboard` and create a label element somewhere on the screen.

<a href="/resources/images/mobile-haskell-7. Add Label.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-7. Add Label.thumbnail.png" loading="lazy" alt="7. Add Label" title="7. Add Label" width="100%" /></a>

Then enable the `Assistant Editor` in the top right cornor, and ctrl-click on the label, dragging it over to the `ViewController.swift` and name `helloWorldLabel`.

<a href="/resources/images/mobile-haskell-7.1. Add Label - Connect IBOutlet.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-7.1. Add Label - Connect IBOutlet.thumbnail.png" loading="lazy" alt="7.1. Add Label - Connect IBOutlet" title="7.1. Add Label - Connect IBOutlet" width="100%" /></a>

We can now set the text of the label by calling our Haskell function with `cString: hello()`, making our `ViewController.swift` look like,

```objective-c
import UIKit

class ViewController: UIViewController {

    @IBOutlet var helloWorldLabel: UILabel!

    override func viewDidLoad() {
        super.viewDidLoad()
        helloWorldLabel.text = String(cString: hello())
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }
}
```

### Linking in our Haskell Library

The final step we need to do, is linking in our library that we built earlier, `hs-src/binaries/iOS/libHSMobileFun.a`, so that Xcode can find our C prototype functions.

We do this by going into `Build Phases`, which is exposed under the Xcode project settings, and click the `+` to add a new library,

<a href="/resources/images/mobile-haskell-5. Build Phases.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-5. Build Phases.thumbnail.png" loading="lazy" alt="5. Build Phases" title="5. Build Phases" width="100%" /></a>

Choose `Add Other...` to locate the library,

<a href="/resources/images/mobile-haskell-5.1. Build Phases - Add New.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-5.1. Build Phases - Add New.thumbnail.png" loading="lazy" alt="5.1. Build Phases - Add New" title="5.1. Build Phases - Add New" width="100%" /></a>

and finally locate the library file in `hs-src/binaries/iOS/libHSMobileFun.a`,

<a href="/resources/images/mobile-haskell-5.2. Build Phases - Locate the Library.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-5.2. Build Phases - Locate the Library.thumbnail.png" loading="lazy" alt="5.2. Build Phases - Locate the Library" title="5.2. Build Phases - Locate the Library" width="100%" /></a>

We also need to set the build to not generate bytecode, because we are using the external GHC library. This is done under `Build Settings`, locating `Enable Bitcode` (e.g. via the search) and setting it to `No`.

<a href="/resources/images/mobile-haskell-6. Build Settings.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-6. Build Settings.thumbnail.png" loading="lazy" alt="6. Build Settings" title="6. Build Settings" width="100%" /></a>

## Run the Code!

Final step, let's run our code in the simulator

<div style="text-align:center;">
  <a href="/resources/images/mobile-haskell-9. Run Simulator.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-9. Run Simulator.thumbnail.png" loading="lazy" alt="9. Run Simulator" title="9. Run Simulator" width="60%" /></a>
</div>

Congratulations! You're now calling Haskell code from Swift and running it in an iOS simulator.

<div class="callout">
  <div class="callout-bulb">💡</div>
  You might run into a problem like `could not create compact unwind for _ffi_call_unix64: does not use RBP or RSP based frame` in your Xcode builds. You can fix this by adding `libconv` to your libraries in `Build Phase`.
</div>

<a href="/resources/images/mobile-haskell-8. Add libconv to libraries.png" target="_blank" rel="noopener noreferrer"><img src="/resources/images/mobile-haskell-8. Add libconv to libraries.thumbnail.png" loading="lazy" alt="8. Add libconv to libraries" title="8. Add libconv to libraries" width="100%" /></a>

## Resources

Most of this is gathered from:

- [A Haskell Cross Compiler for iOS](https://medium.com/@zw3rk/a-haskell-cross-compiler-for-ios-7cc009abe208){target="_blank" rel="noopener noreferrer"} and some of the other medium posts.
- Various issues on the [mobile-haskell/hackage-overlay](https://github.com/mobilehaskell/hackage-overlay){target="_blank" rel="noopener noreferrer"} ([#5](https://github.com/mobilehaskell/hackage-overlay/issues/5){target="_blank" rel="noopener noreferrer"}, [#2](https://github.com/mobilehaskell/hackage-overlay/issues/2){target="_blank" rel="noopener noreferrer"}).
- The [preliminary user guide](http://mobile-haskell-user-guide.readthedocs.io/en/latest/).

If you are interested in following the development of Haskell in the mobile space, I recommend following [\@zw3rktech](https://twitter.com/zw3rktech){target="_blank" rel="noopener noreferrer"} and [\@mobilehaskell](https://twitter.com/mobilehaskell){target="_blank" rel="noopener noreferrer"}.


Finally, let me know if something is not working with the [MobileHaskellFun repository](https://github.com/Tehnix/MobileHaskellFun){target="_blank" rel="noopener noreferrer"}. I haven't dealt that much with setting up Xcode projects for sharing, so I'm a bit unclear on what settings follow the repository around.
