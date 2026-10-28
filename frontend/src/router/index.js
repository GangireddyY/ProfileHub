import { watch } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { i18n, t } from '@/i18n';
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
      { path: '', name: 'discover', component: () => import('@/views/DiscoverView.vue'), meta: { title: 'Discover', memberOnly: true } },
      { path: 'u/:id', name: 'profile', component: () => import('@/views/ProfileView.vue'), props: true },
      {
        path: 'search',
        name: 'search',
        component: () => import('@/views/SearchView.vue'),
        // The page rewrites ?q= as you type; don't remount it on every keystroke.
        meta: { title: 'Search', stableKey: true, memberOnly: true },
      },
      {
        path: 'market',
        name: 'market',
        component: () => import('@/views/MarketView.vue'),
        meta: { title: 'Marketplace', memberOnly: true },
      },
      {
        path: 'market/new',
        name: 'listing-new',
        component: () => import('@/views/ListingEditorView.vue'),
        meta: { title: 'Sell something', memberOnly: true },
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
        meta: { title: 'Edit listing', memberOnly: true },
      },
      {
        path: 'network',
        name: 'network',
        component: () => import('@/views/NetworkView.vue'),
        meta: { title: 'My network', memberOnly: true },
      },
      {
        path: 'messages/:userId?',
        name: 'messages',
        component: () => import('@/views/MessagesView.vue'),
        props: true,
        meta: { title: 'Messages', fullHeight: true, memberOnly: true },
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
        meta: { title: 'Plans', memberOnly: true },
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/views/AdminView.vue'),
        // Switching sections only changes ?tab=; keep the console mounted so its sidebar doesn't reload.
        meta: { title: 'Admin', requiresAdmin: true, stableKey: true },
      },
    ],
  },
  {
    path: '/welcome',
    name: 'welcome',
    component: () => import('@/views/OnboardingView.vue'),
    meta: { requiresAuth: true, title: 'Set up your profile', memberOnly: true },
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
      {
        path: 'forgot-password',
        name: 'forgot-password',
        component: () => import('@/views/ForgotPasswordView.vue'),
        meta: { title: 'Forgot password' },
      },
    ],
  },
  // Links from emails: they work whether or not this tab is signed in.
  {
    path: '/',
    component: AuthLayout,
    children: [
      {
        path: 'reset-password',
        name: 'reset-password',
        component: () => import('@/views/ResetPasswordView.vue'),
        meta: { title: 'Choose a new password' },
      },
      {
        path: 'verify-email',
        name: 'verify-email',
        component: () => import('@/views/VerifyEmailView.vue'),
        meta: { title: 'Confirm your email' },
      },
    ],
  },
  // Readable whether or not you are signed in.
  { path: '/privacy', name: 'privacy', component: () => import('@/views/PrivacyView.vue'), meta: { title: 'Privacy policy' } },
  { path: '/terms', name: 'terms', component: () => import('@/views/TermsView.vue'), meta: { title: 'Terms & guidelines' } },
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
    if (to.name === 'admin' && from.name === 'admin') return { top: 0, behavior: 'smooth' };
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
  // Sign-in and sign-up stay reachable while signed in: signing in switches only this tab (sessions are per tab),
  // and creating an account doesn't sign anyone out. The pages explain this to the signed-in user.
  // Admins run the app: member pages (Discover, Market, Network, Messages, Plans) send them to the admin panel.
  if (to.meta.memberOnly && auth.user?.role === 'admin') return { name: 'admin' };
  if (to.meta.requiresAdmin && auth.user?.role !== 'admin') {
    return { name: 'login', query: { redirect: to.fullPath, switch: 'admin' } };
  }
});

const te = (key) => i18n.global.te(key, 'en');

function pageTitle(route) {
  const key = `title.${String(route.name)}`;
  const translated = route.name && te(key) ? t(key) : route.meta.title;
  return translated ? `${translated} · ProfileHUB` : 'ProfileHUB';
}

router.afterEach((to) => {
  document.title = pageTitle(to);
});

watch(i18n.global.locale, () => {
  document.title = pageTitle(router.currentRoute.value);
});

export default router;
