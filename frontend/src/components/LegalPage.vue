<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { Sun, Moon } from 'lucide-vue-next';
import { useThemeStore } from '@/stores/theme';
import { LEGAL_UPDATED, SUPPORT_EMAIL } from '@/constants/legal';
import BackButton from './BackButton.vue';

/** Shared frame for the Privacy policy and Terms pages, readable whether or not you are signed in. */
defineProps({
  title: { type: String, required: true },
  intro: { type: String, default: '' },
  /** [{ id, label }] for the table of contents. */
  sections: { type: Array, default: () => [] },
});

const theme = useThemeStore();
const route = useRoute();

// The title block stays pinned while the policy scrolls; the contents sidebar and section anchors sit below it.
const head = ref(null);
const headHeight = ref(0);
let observer;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => (headHeight.value = Math.ceil(entry.target.getBoundingClientRect().height)));
  observer.observe(head.value);
  // Arriving via a link like /terms#safety: scroll again once the pinned header is measured, so the
  // section isn't hidden underneath it (scrollIntoView respects each heading's scroll-margin).
  if (route.hash) {
    setTimeout(() => document.getElementById(route.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
  }
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="legal">
    <header class="legal__top">
      <RouterLink to="/" class="legal__brand">
        <img src="/favicon.svg" alt="" width="32" height="32" />
        <span>ProfileHUB</span>
      </RouterLink>
      <nav class="legal__nav" aria-label="Policies">
        <RouterLink to="/privacy">Privacy policy</RouterLink>
        <RouterLink to="/terms">Terms &amp; guidelines</RouterLink>
      </nav>
      <button
        type="button"
        class="legal__theme"
        :aria-label="theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="theme.toggle()"
      >
        <Sun v-if="theme.isDark" />
        <Moon v-else />
      </button>
    </header>

    <main class="legal__main" :style="{ '--head-h': `${headHeight}px` }">
      <div ref="head" class="legal__head">
        <BackButton />
        <h1 class="legal__title">{{ title }}</h1>
        <p class="legal__updated">Last updated: {{ LEGAL_UPDATED }}</p>
        <p v-if="intro" class="legal__intro">{{ intro }}</p>
      </div>

      <div class="legal__layout" :class="{ 'has-toc': sections.length }">
        <nav v-if="sections.length" class="legal__toc" aria-label="On this page">
          <strong>On this page</strong>
          <ol>
            <li v-for="s in sections" :key="s.id"><a :href="`#${s.id}`">{{ s.label }}</a></li>
          </ol>
        </nav>

        <div class="legal__content">
          <article class="legal__body">
            <slot />
          </article>

          <footer class="legal__foot">
            Questions or something to report? Email <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>.
          </footer>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.legal {
  min-height: 100dvh;
  background: var(--bg);
}
.legal__top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 60px;
  padding: 0 var(--page-pad);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.legal__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 1.1rem;
}
.legal__brand img {
  border-radius: 10px;
}
.legal__nav {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.legal__nav a {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-2);
}
.legal__nav a:hover {
  background: var(--surface-3);
  color: var(--text);
}
.legal__nav a.router-link-exact-active {
  color: var(--primary);
  background: var(--primary-soft);
}
.legal__theme {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
}
.legal__theme svg {
  width: 18px;
  height: 18px;
}
.legal__main {
  --top-h: 60px;
  --pinned: calc(var(--top-h) + var(--head-h, 0px));
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 0 var(--page-pad) 64px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.legal__head {
  position: sticky;
  top: var(--top-h);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 calc(-1 * var(--page-pad));
  padding: 18px var(--page-pad) 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.legal__intro {
  max-width: 900px;
}
.legal__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.legal__content {
  min-width: 0;
}
.legal__title {
  font-size: clamp(1.8rem, 3.2vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}
.legal__updated {
  font-size: 0.85rem;
  color: var(--text-3);
}
.legal__intro {
  font-size: 1.02rem;
  color: var(--text-2);
}
.legal__toc {
  padding: 14px 18px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.9rem;
}
.legal__toc ol {
  margin: 8px 0 0;
  padding-left: 20px;
  columns: 2;
  column-gap: 24px;
}
.legal__toc li {
  margin-bottom: 4px;
  break-inside: avoid;
}
.legal__toc a {
  color: var(--primary);
}
.legal__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  line-height: 1.65;
}
.legal__body :deep(h2) {
  margin-top: 22px;
  font-size: 1.25rem;
  font-weight: 800;
  scroll-margin-top: calc(var(--pinned) + 16px);
}
.legal__body :deep(h3) {
  margin-top: 10px;
  font-size: 1rem;
  font-weight: 700;
}
.legal__body :deep(p),
.legal__body :deep(li) {
  color: var(--text-2);
}
.legal__body :deep(ul) {
  margin: 0;
  padding-left: 22px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.legal__body :deep(strong) {
  color: var(--text);
}
.legal__body :deep(a) {
  color: var(--primary);
  font-weight: 600;
}
.legal__body :deep(.callout) {
  display: flex;
  gap: 12px;
  margin: 6px 0;
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, var(--border));
  background: var(--warning-soft);
}
.legal__body :deep(.callout--danger) {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
  background: var(--danger-soft);
}
.legal__body :deep(.callout svg) {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--warning);
}
.legal__body :deep(.callout--danger svg) {
  color: var(--danger);
}
.legal__body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.legal__body :deep(th),
.legal__body :deep(td) {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}
.legal__body :deep(th) {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-3);
}
.legal__body :deep(.table-wrap) {
  overflow-x: auto;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
}
.legal__foot {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-size: 0.9rem;
  color: var(--text-2);
}
.legal__foot a {
  color: var(--primary);
  font-weight: 600;
}
/* Wide screens: contents become a sticky sidebar so the page uses the full width. */
@media (min-width: 1024px) {
  .legal__layout.has-toc {
    grid-template-columns: 260px minmax(0, 1fr);
    gap: 32px;
  }
  /* Pinned beside the text, compact enough to show every section without its own scrollbar. */
  .legal__toc {
    position: sticky;
    top: calc(var(--pinned) + 16px);
    padding: 12px 14px;
    font-size: 0.86rem;
  }
  .legal__toc ol {
    columns: 1;
    margin-top: 6px;
  }
  .legal__toc li {
    margin-bottom: 2px;
  }
  .legal__toc a {
    display: block;
    padding: 3px 6px;
    margin-left: -6px;
    border-radius: var(--radius-xs);
  }
  .legal__toc a:hover {
    background: var(--primary-soft);
  }
  .legal__body :deep(h2:first-child) {
    margin-top: 0;
  }
}
@media (max-width: 640px) {
  /* On phones the long intro would cover too much of the screen, so only the top bar stays pinned. */
  .legal__main {
    --pinned: var(--top-h);
  }
  .legal__head {
    position: static;
  }
  .legal__nav {
    display: none;
  }
  .legal__theme {
    margin-left: auto;
  }
  .legal__toc ol {
    columns: 1;
  }
}
</style>
