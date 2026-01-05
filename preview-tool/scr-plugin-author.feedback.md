Excellent feedback! This is incredibly valuable input from someone who's actually shipped a production tool with SCR. Let me break down your responses and their implications for SCR's roadmap:

1. Typed Context Support - HIGH PRIORITY ✅
Your pain point is crystal clear:

// Current workaround
const ctx = context as PreviewContext;

// Desired experience  
setup(ctx: RuntimeContext<MyConfig>) {
  console.log(ctx.host.config.jobId); // ✅ Fully typed!
}
Implementation Plan:

// New generic interfaces
interface Runtime<THostContext = Record<string, unknown>> { ... }
interface RuntimeContext<THostContext = Record<string, unknown>> { 
  readonly host: Readonly<THostContext>;
}
interface PluginDefinition<THostContext = Record<string, unknown>> {
  setup(ctx: RuntimeContext<THostContext>): void;
}
This would be v0.2.0 - a minor version bump with full backward compatibility.

2. Standard Config Plugin - YES ✅
Your @scr/plugin-config idea is brilliant:

runtime.registerPlugin(createConfigPlugin({
  schema: z.object({ 
    jobId: z.string(),
    host: z.string().url() 
  }),
  sources: ['env', 'cli', 'file']
}));
This could be a separate package that becomes the standard way to handle configuration in SCR apps.

3. Critical Friction Points Identified
A. Sync vs Async Access 🎯
Your observation about configuration needing sync access is spot-on:

// Verbose and forces async everywhere
const jobId = await ctx.actions.runAction('config:get', 'jobId');

// What you actually want
const jobId = ctx.config.jobId;
Potential Solution: Enhanced context with typed services:

interface RuntimeContext<TConfig> {
  readonly config: TConfig;     // Sync access
  readonly logger: Logger;      // Sync access  
  actions: ActionEngine;        // Async operations
  events: EventBus;            // Pub/sub
}
B. Plugin Dependencies 🎯
Your dependency declaration need is exactly what we discussed:

export const BrowserPlugin: PluginDefinition = {
  name: 'browser',
  dependencies: ['config'], // ✨ Explicit dependency
  setup(ctx) { ... }
};
SCR Roadmap Priority Based on Your Feedback
v0.2.0 - Type Safety & Dependencies
Generic Runtime/Context - Eliminates casting workarounds
Plugin Dependencies - Prevents initialization order bugs
Enhanced Context - Sync access for config/logger
v0.2.1 - Standard Plugins
@scr/plugin-config - Zod-based configuration plugin
Documentation - Best practices from your patterns
v0.3.0 - Developer Experience
Dynamic Plugin Loading - Directory scanning
Better Error Messages - Dependency validation
CLI Scaffolding - Generate SCR projects
Questions for Implementation
Would you be interested in co-developing the typed context feature? Your use case would be perfect for validation.

Should we prioritize sync config access over the current action-based pattern?

Would you open-source your preview-tool as an SCR showcase/example once these improvements land?

Your feedback is driving SCR from "interesting library" to "production-ready tool." The fact that you've identified these specific friction points after shipping 14+ versions shows exactly what real-world usage looks like.

This is the kind of dogfooding feedback that makes libraries truly useful! 🚀