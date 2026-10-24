import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
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
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: 'Settings' },
      },
    ],
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
    if (to.name === from.name && to.name === 'messages') return false;
    return { top: 0 };
  },
});

let initPromise = null;

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) {
    initPromise ||= auth.init();
    await initPromise;
  }

  if (to.meta.requiresAuth && !auth.isAuthed) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined };
  }
  if (to.meta.guestOnly && auth.isAuthed) return { name: 'discover' };
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ProfileHUB` : 'ProfileHUB';
});

export default router;
