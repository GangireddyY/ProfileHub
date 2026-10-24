<script setup>
import { Radar, MessageCircle, Users, ShieldCheck, Sun, Moon, MapPin, UserPlus } from 'lucide-vue-next';
import { getProfession } from '@/constants/professions';
import { useThemeStore } from '@/stores/theme';

const theme = useThemeStore();
const year = new Date().getFullYear();

const features = [
  { icon: Radar, title: 'Discover nearby', text: 'Find professionals within any range.' },
  { icon: Users, title: 'Grow your network', text: 'Invite, connect and keep track.' },
  { icon: MessageCircle, title: 'Realtime chat', text: 'Live typing & read receipts.' },
  { icon: ShieldCheck, title: 'You stay in control', text: 'Location is always opt-in.' },
];

/** Positions are percentages inside the radar circle. */
const orbit = [
  { key: 'software', x: 50, y: 13 },
  { key: 'doctor', x: 84, y: 36 },
  { key: 'designer', x: 74, y: 80 },
  { key: 'teacher', x: 32, y: 84 },
  { key: 'finance', x: 15, y: 54 },
  { key: 'lawyer', x: 25, y: 23 },
].map((o, i) => ({ ...getProfession(o.key), x: o.x, y: o.y, delay: `${i * 0.45}s` }));
</script>

<template>
  <div class="auth">
    <aside class="hero">
      <div class="hero__bg" aria-hidden="true">
        <span class="hero__blob hero__blob--a" />
        <span class="hero__blob hero__blob--b" />
        <span class="hero__blob hero__blob--c" />
        <span class="hero__grid" />
      </div>

      <div class="hero__inner">
        <RouterLink to="/" class="brand brand--light">
          <img src="/favicon.svg" alt="" width="38" height="38" />
          <span>ProfileHUB</span>
        </RouterLink>

        <div class="hero__copy">
          <span class="hero__eyebrow"><span class="live-dot" /> Professionals near you, live</span>
          <h1>Your professional world, <span class="gradient-text">right around the corner.</span></h1>
          <p class="hero__lead">
            Doctors, developers, designers, teachers and more. Meet the people near you and build a network that matters.
          </p>
        </div>

        <div class="hero__visual" aria-hidden="true">
          <div class="radar">
            <span class="radar__ring" />
            <span class="radar__ring" />
            <span class="radar__ring" />
            <span class="radar__sweep" />
            <span class="radar__you" />
            <span
              v-for="p in orbit"
              :key="p.key"
              class="radar__node"
              :style="{ '--hue': p.hue, left: `${p.x}%`, top: `${p.y}%`, animationDelay: p.delay }"
            >
              <component :is="p.icon" />
            </span>
          </div>

          <div class="glass glass--profile">
            <span class="glass__avatar" style="--hue: 350">AK</span>
            <div class="glass__body">
              <strong>Dr. Aisha Khan</strong>
              <span class="glass__meta"><MapPin /> Cardiologist · 0.8 km</span>
            </div>
            <span class="glass__action"><UserPlus /></span>
          </div>

          <div class="glass glass--message">
            <span class="glass__avatar" style="--hue: 243">SM</span>
            <div class="glass__body">
              <strong>Sam Miller <em>now</em></strong>
              <span class="glass__text">Coffee near the office tomorrow?</span>
            </div>
            <span class="typing"><i /><i /><i /></span>
          </div>
        </div>

        <ul class="hero__features">
          <li v-for="f in features" :key="f.title">
            <span class="hero__feature-icon"><component :is="f.icon" /></span>
            <div>
              <strong>{{ f.title }}</strong>
              <p>{{ f.text }}</p>
            </div>
          </li>
        </ul>
      </div>
    </aside>

    <main class="auth__main">
      <div class="auth__glow" aria-hidden="true" />

      <header class="auth__top">
        <RouterLink to="/" class="brand brand--mobile">
          <img src="/favicon.svg" alt="" width="34" height="34" />
          <span>ProfileHUB</span>
        </RouterLink>
        <button
          type="button"
          class="theme-btn"
          :aria-label="theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="theme.toggle()"
        >
          <Transition name="fade" mode="out-in">
            <Sun v-if="theme.isDark" key="sun" />
            <Moon v-else key="moon" />
          </Transition>
        </button>
      </header>

      <div class="auth__panel">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>

      <footer class="auth__foot">© {{ year }} ProfileHUB · Privacy-first networking</footer>
    </main>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

/* ---------- Brand ---------- */
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}
.brand img {
  border-radius: 11px;
  box-shadow: 0 8px 24px -6px rgba(79, 70, 229, 0.55);
}
.brand--light {
  color: #fff;
}

/* ---------- Hero ---------- */
.hero {
  display: none;
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow: hidden;
  color: #fff;
  background: #070b1a;
  isolation: isolate;
}
.hero__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
}
.hero__blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.55;
  animation: drift 18s ease-in-out infinite alternate;
}
.hero__blob--a {
  width: 520px;
  height: 520px;
  top: -160px;
  left: -120px;
  background: #4f46e5;
}
.hero__blob--b {
  width: 420px;
  height: 420px;
  bottom: -140px;
  right: -100px;
  background: #0891b2;
  animation-delay: -6s;
}
.hero__blob--c {
  width: 320px;
  height: 320px;
  top: 40%;
  left: 45%;
  background: #a21caf;
  opacity: 0.35;
  animation-delay: -12s;
}
.hero__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 85%);
}

.hero__inner {
  height: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 36px 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
}
.hero__copy {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hero__eyebrow {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 10px;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
}
.live-dot {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
}
.live-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: inherit;
  animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.hero h1 {
  font-size: clamp(2.1rem, 3.3vw, 3rem);
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: -0.035em;
}
.gradient-text {
  background: linear-gradient(92deg, #a5b4fc 0%, #67e8f9 50%, #f0abfc 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero__lead {
  max-width: 46ch;
  font-size: 1.02rem;
  color: rgba(255, 255, 255, 0.7);
}

/* ---------- Radar visual ---------- */
.hero__visual {
  position: relative;
  height: 250px;
  flex-shrink: 0;
}
.radar {
  position: absolute;
  top: 0;
  left: 0;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(103, 232, 249, 0.08), transparent 70%);
}
.radar__ring {
  position: absolute;
  inset: 0;
  margin: auto;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.radar__ring:nth-child(1) {
  width: 34%;
  height: 34%;
}
.radar__ring:nth-child(2) {
  width: 67%;
  height: 67%;
}
.radar__ring:nth-child(3) {
  width: 100%;
  height: 100%;
  border-style: dashed;
}
.radar__sweep {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, rgba(103, 232, 249, 0.32), transparent 22%);
  mask-image: radial-gradient(circle, black 60%, transparent 71%);
  animation: spin 6s linear infinite;
}
.radar__you {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: #67e8f9;
  box-shadow: 0 0 0 4px rgba(103, 232, 249, 0.25), 0 0 24px #67e8f9;
}
.radar__you::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid #67e8f9;
  animation: ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.radar__node {
  position: absolute;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  color: hsl(var(--hue) 95% 82%);
  background: hsl(var(--hue) 70% 50% / 0.22);
  border: 1px solid hsl(var(--hue) 85% 70% / 0.45);
  backdrop-filter: blur(6px);
  box-shadow: 0 0 20px hsl(var(--hue) 80% 60% / 0.3);
  animation: bob 4s ease-in-out infinite;
}
.radar__node svg {
  width: 18px;
  height: 18px;
}

.glass {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 270px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(16px);
  box-shadow: 0 20px 40px -16px rgba(0, 0, 0, 0.6);
  animation: float 6s ease-in-out infinite;
}
.glass--profile {
  top: 20px;
  right: 0;
}
.glass--message {
  bottom: 14px;
  right: 36px;
  animation-delay: -3s;
}
.glass__avatar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 800;
  background: linear-gradient(135deg, hsl(var(--hue) 80% 62%), hsl(calc(var(--hue) + 40) 80% 52%));
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18);
}
.glass__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  line-height: 1.3;
}
.glass__body strong {
  font-size: 0.88rem;
}
.glass__body em {
  font-style: normal;
  font-weight: 500;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 4px;
}
.glass__meta,
.glass__text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.glass__text {
  display: block;
}
.glass__meta svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}
.glass__action {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #06b6d4);
}
.glass__action svg {
  width: 16px;
  height: 16px;
}
.typing {
  display: inline-flex;
  gap: 3px;
  padding: 8px 9px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.1);
}
.typing i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  animation: typing 1.2s ease-in-out infinite;
}
.typing i:nth-child(2) {
  animation-delay: 0.15s;
}
.typing i:nth-child(3) {
  animation-delay: 0.3s;
}

/* ---------- Features ---------- */
.hero__features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.hero__features li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.hero__features strong {
  font-size: 0.88rem;
}
.hero__features p {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.6);
}
.hero__feature-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 11px;
  color: #a5f3fc;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(6, 182, 212, 0.25));
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.hero__feature-icon svg {
  width: 18px;
  height: 18px;
}

/* ---------- Form side ---------- */
.auth__main {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100dvh;
  padding: 20px 16px calc(20px + var(--safe-bottom));
  overflow: hidden;
  isolation: isolate;
}
.auth__glow {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(600px 360px at 85% -5%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 70%),
    radial-gradient(500px 320px at 0% 105%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%);
}
.auth__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
}
.brand--mobile {
  color: var(--text);
}
.theme-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-left: auto;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  box-shadow: var(--shadow-xs);
  transition: color 0.18s var(--ease), border-color 0.18s var(--ease), transform 0.18s var(--ease);
}
.theme-btn:hover {
  color: var(--text);
  border-color: var(--border-strong);
  transform: rotate(-12deg);
}
.theme-btn svg {
  width: 18px;
  height: 18px;
}

.auth__panel {
  width: 100%;
  max-width: 460px;
  margin: auto;
  padding: 28px 22px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
}
.auth__foot {
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-3);
}

/* Shared styling for the views rendered in this layout. */
.auth__panel :deep(.auth-head) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.auth__panel :deep(.auth-title) {
  font-size: clamp(1.65rem, 3vw, 2.05rem);
  font-weight: 800;
  letter-spacing: -0.035em;
}
.auth__panel :deep(.field__input) {
  height: 50px;
  border-radius: 14px;
  background: var(--surface-2);
}
.auth__panel :deep(.field__input:focus) {
  background: var(--surface);
}
.auth__panel :deep(.form-alert) {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.9rem;
  font-weight: 500;
}
.auth__panel :deep(.switch) {
  text-align: center;
  font-size: 0.92rem;
  color: var(--text-2);
}
.auth__panel :deep(.link) {
  color: var(--primary);
  font-weight: 700;
}
.auth__panel :deep(.link:hover) {
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (min-width: 560px) {
  .auth__panel {
    padding: 36px;
  }
}

@media (min-width: 1024px) {
  .auth {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  }
  .hero {
    display: block;
  }
  .brand--mobile {
    display: none;
  }
  .auth__main {
    padding: 28px 40px;
  }
  .auth__top {
    max-width: none;
  }
  .auth__panel {
    max-width: 420px;
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
    backdrop-filter: none;
  }
}

@media (min-width: 1024px) and (max-height: 860px) {
  .hero__visual {
    display: none;
  }
}

@keyframes drift {
  to {
    transform: translate(60px, 40px) scale(1.12);
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes ping {
  75%,
  100% {
    transform: scale(2.4);
    opacity: 0;
  }
}
@keyframes bob {
  50% {
    transform: translate(-50%, calc(-50% - 5px));
  }
}
@keyframes float {
  50% {
    transform: translateY(-8px);
  }
}
@keyframes typing {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
</style>
