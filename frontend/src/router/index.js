import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useProfessionsStore } from '@/stores/professions';
import AppLayout from '@/layouts/AppLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';

const routes = [
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'discover', component: () => import('@/views/DiscoverView.vue'), meta: { title: 'Discover' } },
      { path: 'u/:id', name: 'profile', component: () => import('@/views/ProfileView.vue'), props: true },
      {
        path: 'search',
        name: 'search',
        component: () => import('@/views/SearchView.vue'),
        // The page rewrites ?q= as you type; don't remount it on every keystroke.
        meta: { title: 'Search', stableKey: true },
      },
      {
        path: 'market',
        name: 'market',
        component: () => import('@/views/MarketView.vue'),
        meta: { title: 'Marketplace' },
      },
      {
        path: 'market/new',
        name: 'listing-new',
        component: () => import('@/views/ListingEditorView.vue'),
        meta: { title: 'Sell something' },
      },
      {
        path: 'market/:id',
        name: 'listing',
        component: () => import('@/views/ListingView.vue'),
        props: true,
        meta: { title: 'Listing' },
      },
      {
        path: 'market/:id/edit',
        name: 'listing-edit',
        component: () => import('@/views/ListingEditorView.vue'),
        props: true,
        meta: { title: 'Edit listing' },
      },
      {
        path: 'network',
        name: 'network',
        component: () => import('@/views/NetworkView.vue'),
        meta: { title: 'My network' },
      },
      {
        path: 'messages/:userId?',
        name: 'messages',
        component: () => import('@/views/MessagesView.vue'),
        props: true,
        meta: { title: 'Messages', fullHeight: true },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/views/NotificationsView.vue'),
        meta: { title: 'Notifications' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: 'Settings' },
      },
      {
        path: 'plans',
        name: 'plans',
        component: () => import('@/views/PlansView.vue'),
        meta: { title: 'Plans' },
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/views/AdminView.vue'),
        meta: { title: 'Admin', requiresAdmin: true },
      },
    ],
  },
  {
    path: '/welcome',
    name: 'welcome',
    component: () => import('@/views/OnboardingView.vue'),
    meta: { requiresAuth: true, title: 'Set up your profile' },
  },
  {
    path: '/',
    component: AuthLayout,
    meta: { guestOnly: true },
    children: [
      { path: 'login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: 'Sign in' } },
      {
        path: 'signup',
        name: 'signup',
        component: () => import('@/views/SignupView.vue'),
        meta: { title: 'Create account' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved;
    if (to.hash) {
      // Wait for the page transition to render the target section.
      return new Promise((resolve) => setTimeout(() => resolve({ el: to.hash, top: 80, behavior: 'smooth' }), 300));
    }
    if (to.name === from.name && ['messages', 'search', 'market'].includes(to.name)) return false;
    return { top: 0 };
  },
});

let initPromise = null;

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) {
    initPromise ||= Promise.all([auth.init(), useProfessionsStore().load().catch(() => {})]);
    await initPromise;
  }

  if (to.meta.requiresAuth && !auth.isAuthed) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined };
  }
  // `?switch` lets a signed-in tab sign in as another account (sessions are per tab).
  if (to.meta.guestOnly && auth.isAuthed && !to.query.switch) return { name: 'discover' };
  if (to.meta.requiresAdmin && auth.user?.role !== 'admin') {
    return { name: 'login', query: { redirect: to.fullPath, switch: 'admin' } };
  }
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ProfileHUB` : 'ProfileHUB';
});

export default router;
