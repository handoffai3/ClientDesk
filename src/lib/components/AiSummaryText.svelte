<script lang="ts">
  import { renderSummary } from '$lib/renderSummary';
  let { text = '', size = 'text-sm' }: { text?: string; size?: string } = $props();
  const html = $derived(renderSummary(text));
</script>

<div class="ai-summary {size} text-on-surface leading-relaxed break-words">{@html html}</div>

<style>
  .ai-summary :global(h4) { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin: 0.6rem 0 0.2rem; opacity: 0.75; }
  .ai-summary :global(h4:first-child) { margin-top: 0; }
  .ai-summary :global(ul) { list-style: disc; padding-left: 1.1rem; margin: 0.15rem 0 0.35rem; }
  .ai-summary :global(li) { margin: 0.1rem 0; }
  .ai-summary :global(p) { margin: 0.2rem 0; }
  .ai-summary :global(code) { font-family: monospace; font-size: 0.9em; }
</style>
