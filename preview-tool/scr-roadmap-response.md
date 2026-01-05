# Feedback for SCR Roadmap

Based on the recent refactor of the `preview-tool`, here are my thoughts on your roadmap questions:

## 1. Typed Context Support
**"Should we add built-in support for typed context extensions?"**

**YES, High Priority.**
*   **The Pain:** Right now, I have to manually define a `PreviewContext` type intersection and cast `ctx as PreviewContext` at the top of every plugin. It works, but it feels like a workaround.
*   **The Dream:**
    ```typescript
    // When defining the runtime
    interface MyConfig { jobId: string; }
    const runtime = new Runtime<MyConfig>(...);
    
    // In a plugin
    setup(ctx: RuntimeContext<MyConfig>) {
       // ctx.host.config is automatically typed!
       console.log(ctx.host.config.jobId); 
    }
    ```
    Making `Runtime` and `PluginDefinition` generic would eliminate a lot of boilerplate code and " trust me, I casted it" moments.

## 2. Standard Config Plugin
**"Would a @scr/config plugin template with Zod integration be valuable?"**

**YES.**
*   **The Pattern:** Almost every CLI tool needs: `CLI Args` + `Env Vars` -> `Validation` -> `Runtime Config`.
*   **Suggestion:** A `@scr/plugin-config` package where I can just pass a Zod schema would be amazing.
    ```typescript
    runtime.registerPlugin(createConfigPlugin({
        schema: z.object({ ... }),
        sources: ['env', 'cli', 'file'] // Priority order
    }));
    ```
    This would standardize how apps handle "dirty" inputs vs "clean" trusted runtime configuration.

## 3. Remaining Friction Points
**"Any remaining friction points after this refactor?"**

### A. Sync vs Async Access
I noticed that while SCR encourages using `actions` (which are async), foundational things like **Configuration** or **Logging** often feel better as synchronous, direct APIs on the context. 
*   *Friction:* Calling `await ctx.actions.runAction('config:get', 'ver')` for every little config check is verbose and forces `async` everywhere.
*   *Suggestion:* Maybe distinct `services` (sync) vs `actions` (async/side-effect)? Or just officially blessing `ctx.host.config` as the "Sync Store".

### B. Dependency Declaration
In `index.ts`, I still have to manually order my plugins. 
*   *Friction:* If I accidentally register `BrowserPlugin` before `ConfigPlugin`, it might crash if it tries to read config in `setup()`.
*   *Suggestion:* I'd love to say `BrowserPlugin.dependencies = ['config']`. The Runtime could then throw a helpful error: *"Plugin 'browser' requires 'config' but it is not registered yet."*

---
This refactor has made the codebase significantly more robust, and these SCR improvements would make the *next* tool I build with it even faster to setup! 🚀
