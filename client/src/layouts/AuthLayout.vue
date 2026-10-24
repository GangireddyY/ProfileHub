<script setup>
import { Radar, MessageCircle, Users, ShieldCheck } from 'lucide-vue-next';
import { PROFESSIONS } from '@/constants/professions';

const features = [
  { icon: Radar, title: 'Discover nearby', text: 'Find professionals within any range around you.' },
  { icon: Users, title: 'Grow your network', text: 'Send invitations and track your connections.' },
  { icon: MessageCircle, title: 'Realtime chat', text: 'Message your network with live typing & read receipts.' },
  { icon: ShieldCheck, title: 'You stay in control', text: 'Location and online status are always opt-in.' },
];
</script>

<template>
  <div class="auth">
    <aside class="auth__hero">
      <div class="auth__hero-inner">
        <RouterLink to="/" class="auth__brand">
          <img src="/favicon.svg" alt="" width="40" height="40" />
          <span>ProfileHUB</span>
        </RouterLink>

        <h1>Your professional world, <span>right around the corner.</span></h1>
        <p class="auth__lead">Doctors, developers, designers, teachers and more. Meet the people near you and build a network that matters.</p>

        <ul class="auth__features">
          <li v-for="f in features" :key="f.title">
            <span class="auth__feature-icon"><component :is="f.icon" /></span>
            <div>
              <strong>{{ f.title }}</strong>
              <p>{{ f.text }}</p>
            </div>
          </li>
        </ul>

        <div class="auth__chips" aria-hidden="true">
          <span v-for="p in PROFESSIONS.slice(0, 8)" :key="p.key" class="auth__chip" :style="{ '--hue': p.hue }">
            <component :is="p.icon" /> {{ p.label }}
          </span>
        </div>
      </div>
    </aside>

    <main class="auth__main">
      <RouterLink to="/" class="auth__brand auth__brand--mobile">
        <img src="/favicon.svg" alt="" width="36" height="36" />
        <span>ProfileHUB</span>
      </RouterLink>
      <div class="auth__card">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1fr;
}
.auth__hero {
  display: none;
  position: relative;
  overflow: hidden;
  color: #fff;
  background: radial-gradient(900px 500px at 10% 10%, rgba(255, 255, 255, 0.18), transparent 60%),
    linear-gradient(140deg, #4f46e5 0%, #6d28d9 45%, #0891b2 100%);
}
.auth__hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(to bottom, black, transparent 85%);
  pointer-events: none;
}
.auth__hero-inner {
  position: relative;
  z-index: 1;
  max-width: 560px;
  margin: 0 auto;
  padding: 56px 48px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  height: 100%;
  justify-content: center;
}
.auth__brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
  font-size: 1.3rem;
}
.auth__brand img {
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}
.auth__hero h1 {
  font-size: clamp(2rem, 3.2vw, 2.8rem);
  font-weight: 800;
  line-height: 1.1;
}
.auth__hero h1 span {
  color: #a5f3fc;
}
.auth__lead {
  font-size: 1.05rem;
  opacity: 0.88;
}
.auth__features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.auth__features li {
  display: flex;
  gap: 12px;
}
.auth__features p {
  font-size: 0.88rem;
  opacity: 0.8;
}
.auth__feature-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(6px);
}
.auth__feature-icon svg {
  width: 20px;
  height: 20px;
}
.auth__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.auth__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.auth__chip svg {
  width: 14px;
  height: 14px;
  color: hsl(var(--hue) 90% 82%);
}

.auth__main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px calc(32px + var(--safe-bottom));
  gap: 24px;
}
.auth__brand--mobile {
  color: var(--text);
}
.auth__card {
  width: 100%;
  max-width: 440px;
  padding: clamp(22px, 5vw, 36px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow);
}

@media (min-width: 960px) {
  .auth {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  }
  .auth__hero {
    display: block;
  }
  .auth__brand--mobile {
    display: none;
  }
}
</style>
