<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Compass,
  Users,
  MessageCircle,
  Settings,
  LogOut,
  UserRound,
  Sun,
  Moon,
  WifiOff,
  Bell,
  Store,
  Search,
  ShieldHalf,
  Tag,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useRealtimeStore } from '@/stores/realtime';
import { useThemeStore } from '@/stores/theme';
import { useIsMobile } from '@/composables/useMediaQuery';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiDropdown from '@/components/ui/UiDropdown.vue';

const auth = useAuthStore();
const chat = useChatStore();
const realtime = useRealtimeStore();
const theme = useThemeStore();
const route = useRoute();
const router = useRouter();
const isMobile = useIsMobile();

const me = computed(() => auth.user);
const unread = computed(() => (chat.conversationsLoaded ? chat.totalUnread : me.value?.unreadMessages || 0));

const nav = computed(() => [
  { to: '/', label: 'Discover', icon: Compass, match: (n) => n === 'discover' },
  { to: '/market', label: 'Market', icon: Store, match: (n) => ['market', 'listing', 'listing-new', 'listing-edit'].includes(n) },
  { to: '/network', label: 'Network', icon: Users, badge: me.value?.pendingRequests, match: (n) => n === 'network' },
  { to: '/messages', label: 'Messages', icon: MessageCircle, badge: unread.value, match: (n) => n === 'messages' },
]);
const isAdmin = computed(() => me.value?.role === 'admin');

const topQuery = ref('');
watch(
  () => [route.name, route.query.q],
  ([name, q]) => (topQuery.value = name === 'search' && typeof q === 'string' ? q : ''),
  { immediate: true },
);
function submitSearch() {
  const q = topQuery.value.trim();
  router.push({ name: 'search', query: q ? { q } : {} });
}

const tabs = computed(() => [
  ...nav.value,
  {
    to: `/u/${me.value?.id}`,
    label: 'Profile',
    icon: UserRound,
    match: (n) => n === 'profile' && route.params.id === me.value?.id,
  },
]);

/** In an open chat on phones, give the conversation the whole screen. */
const showTabbar = computed(() => !(isMobile.value && route.name === 'messages' && route.params.userId));

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell" :class="{ 'has-tabbar': showTabbar }">
    <header class="topbar">
      <div class="container topbar__inner">
        <RouterLink to="/" class="brand" aria-label="ProfileHUB home">
          <img src="/favicon.svg" alt="" width="34" height="34" />
          <span>Profile<b>HUB</b></span>
        </RouterLink>

        <form class="topsearch" role="search" @submit.prevent="submitSearch">
          <Search class="topsearch__icon" aria-hidden="true" />
          <input
            v-model="topQuery"
            type="search"
            placeholder="Search people, jobs, items…"
            aria-label="Search ProfileHUB"
            enterkeyhint="search"
          />
        </form>

        <nav class="topnav" aria-label="Main">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="topnav__link"
            :class="{ 'is-active': item.match(route.name) }"
          >
            <span class="topnav__icon">
              <component :is="item.icon" />
              <span v-if="item.badge" class="count-badge">{{ item.badge > 99 ? '99+' : item.badge }}</span>
            </span>
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="topbar__right">
          <Transition name="fade">
            <span v-if="!realtime.connected" class="offline-pill" title="Realtime connection lost, retrying">
              <WifiOff /> <span class="offline-pill__text">Reconnecting</span>
            </span>
          </Transition>

          <RouterLink
            to="/search"
            class="icon-btn search-btn"
            :class="{ 'is-active': route.name === 'search' }"
            aria-label="Search"
          >
            <Search />
          </RouterLink>

          <RouterLink
            to="/notifications"
            class="icon-btn"
            :class="{ 'is-active': route.name === 'notifications' }"
            :aria-label="me?.unreadNotifications ? `Notifications, ${me.unreadNotifications} unread` : 'Notifications'"
          >
            <span class="topnav__icon">
              <Bell />
              <span v-if="me?.unreadNotifications" class="count-badge">
                {{ me.unreadNotifications > 99 ? '99+' : me.unreadNotifications }}
              </span>
            </span>
          </RouterLink>

          <button
            type="button"
            class="icon-btn"
            :aria-label="theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="theme.toggle()"
          >
            <Sun v-if="theme.isDark" />
            <Moon v-else />
          </button>

          <RouterLink to="/settings" class="icon-btn mobile-only" aria-label="Settings"><Settings /></RouterLink>

          <UiDropdown class="desktop-only">
            <template #trigger="{ toggle }">
              <button type="button" class="avatar-btn" aria-label="Account menu" @click="toggle">
                <UiAvatar :name="me?.name" :src="me?.avatarUrl" :size="38" :online="realtime.connected && me?.showOnlineStatus" />
              </button>
            </template>
            <div class="menu-head">
              <UiAvatar :name="me?.name" :src="me?.avatarUrl" :size="44" />
              <div class="grow">
                <strong class="truncate" style="display: block">{{ me?.name }}</strong>
                <span class="muted truncate" style="display: block; font-size: 0.82rem">{{ me?.roleTitle || me?.email }}</span>
              </div>
            </div>
            <RouterLink :to="`/u/${me?.id}`" class="menu-item"><UserRound /> View profile</RouterLink>
            <RouterLink :to="{ path: '/market', query: { tab: 'mine' } }" class="menu-item"><Tag /> My listings</RouterLink>
            <RouterLink to="/settings" class="menu-item"><Settings /> Settings & privacy</RouterLink>
            <RouterLink v-if="isAdmin" to="/admin" class="menu-item"><ShieldHalf /> Admin panel</RouterLink>
            <div class="menu-sep" />
            <button type="button" class="menu-item menu-item--danger" @click="logout"><LogOut /> Sign out</button>
          </UiDropdown>
        </div>
      </div>
    </header>

    <main class="shell__main" :class="{ 'is-full': route.meta.fullHeight }">
      <RouterView v-if="me" v-slot="{ Component, route: r }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="r.meta.fullHeight || r.meta.stableKey ? r.name : r.fullPath" />
        </Transition>
      </RouterView>
    </main>

    <nav v-if="showTabbar" class="tabbar" aria-label="Main">
      <RouterLink
        v-for="item in tabs"
        :key="item.label"
        :to="item.to"
        class="tabbar__link"
        :class="{ 'is-active': item.match(route.name) }"
      >
        <span class="tabbar__icon">
          <component :is="item.icon" />
          <span v-if="item.badge" class="count-badge">{{ item.badge > 99 ? '99+' : item.badge }}</span>
        </span>
        <span class="tabbar__label">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  --tabbar-space: 0px;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--nav-h);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
}
.topbar__inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 16px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 1.15rem;
  letter-spacing: -0.02em;
}
.brand b {
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.brand img {
  border-radius: 10px;
}

.topnav {
  display: none;
  margin: 0 auto;
  gap: 4px;
  height: 100%;
}
.topsearch {
  display: none;
  position: relative;
  align-items: center;
  width: clamp(200px, 22vw, 320px);
}
.topsearch__icon {
  position: absolute;
  left: 12px;
  width: 17px;
  height: 17px;
  color: var(--text-3);
  pointer-events: none;
}
.topsearch input {
  width: 100%;
  height: 40px;
  padding: 0 14px 0 38px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 0.9rem;
  transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease), background-color 0.15s var(--ease);
}
.topsearch input::-webkit-search-cancel-button {
  display: none;
}
.topsearch input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: var(--ring);
}
.topnav__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--text-2);
  transition: color 0.15s var(--ease);
}
.topnav__link:hover {
  color: var(--text);
}
.topnav__link.is-active {
  color: var(--primary);
}
.topnav__link.is-active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--primary);
}
.topnav__icon,
.tabbar__icon {
  position: relative;
  display: grid;
  place-items: center;
}
.topnav__icon svg {
  width: 20px;
  height: 20px;
}

.count-badge {
  position: absolute;
  top: -7px;
  right: -10px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 99px;
  background: var(--danger);
  color: #fff;
  font-size: 0.66rem;
  font-weight: 700;
  display: grid;
  place-items: center;
  border: 2px solid var(--surface);
}

.topbar__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text-2);
  transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
}
.icon-btn:hover {
  background: var(--surface-3);
  color: var(--text);
}
.icon-btn svg {
  width: 20px;
  height: 20px;
}
.icon-btn.is-active {
  background: var(--primary-soft);
  color: var(--primary);
}
.avatar-btn {
  border: 0;
  padding: 2px;
  border-radius: 50%;
  background: transparent;
}
.avatar-btn:hover {
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.menu-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 10px 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.offline-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 99px;
  background: var(--warning-soft);
  color: var(--warning);
  font-size: 0.78rem;
  font-weight: 700;
}
.offline-pill svg {
  width: 15px;
  height: 15px;
}

.shell__main {
  flex: 1;
  padding: 20px 0 calc(var(--tabbar-space) + 28px);
}
.shell__main.is-full {
  flex: none;
  display: flex;
  flex-direction: column;
  padding: 0;
  height: calc(100dvh - var(--nav-h) - var(--tabbar-space));
  overflow: hidden;
}
.shell__main.is-full > :deep(*) {
  flex: 1;
  min-height: 0;
}

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  height: calc(var(--tabbar-h) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  backdrop-filter: saturate(180%) blur(14px);
  border-top: 1px solid var(--border);
}
.tabbar__link {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--text-3);
  font-size: 0.7rem;
  font-weight: 600;
  transition: color 0.15s var(--ease);
}
.tabbar__icon {
  width: 52px;
  height: 30px;
  border-radius: 99px;
  transition: background-color 0.2s var(--ease);
}
.tabbar__icon svg {
  width: 22px;
  height: 22px;
}
.tabbar__icon .count-badge {
  top: -4px;
  right: 6px;
}
.tabbar__link.is-active {
  color: var(--primary);
}
.tabbar__link.is-active .tabbar__icon {
  background: var(--primary-soft);
}

.desktop-only {
  display: none;
}

@media (max-width: 767px) {
  .shell.has-tabbar {
    --tabbar-space: calc(var(--tabbar-h) + var(--safe-bottom));
  }
  .offline-pill__text {
    display: none;
  }
  .brand span {
    font-size: 1.05rem;
  }
}

@media (min-width: 768px) {
  .topnav {
    display: flex;
  }
  .tabbar,
  .mobile-only {
    display: none;
  }
  .desktop-only {
    display: block;
  }
  .shell__main {
    padding-top: 28px;
  }
  .topnav__link {
    padding: 0 12px;
  }
}

@media (min-width: 1180px) {
  .topsearch {
    display: flex;
  }
  .search-btn {
    display: none;
  }
}
</style>
