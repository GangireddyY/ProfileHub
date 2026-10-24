<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { MessagesSquare, Search, Users } from 'lucide-vue-next';
import { api, errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import ConversationList from '@/components/chat/ConversationList.vue';
import ChatPanel from '@/components/chat/ChatPanel.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSheet from '@/components/ui/UiSheet.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiSpinner from '@/components/ui/UiSpinner.vue';

const props = defineProps({ userId: { type: String, default: '' } });
const router = useRouter();

const newChatOpen = ref(false);
const connections = ref([]);
const loadingConnections = ref(false);
const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return connections.value.filter((u) => !q || u.name.toLowerCase().includes(q) || u.roleTitle?.toLowerCase().includes(q));
});

async function openNewChat() {
  newChatOpen.value = true;
  search.value = '';
  loadingConnections.value = true;
  try {
    const { data } = await api.get('/connections');
    connections.value = data.items;
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    loadingConnections.value = false;
  }
}

function startChat(u) {
  newChatOpen.value = false;
  router.push(`/messages/${u.id}`);
}
</script>

<template>
  <div class="messages-page">
    <div class="messages" :class="{ 'has-active': props.userId }">
      <aside class="messages__list">
        <ConversationList :active-id="props.userId" @new-chat="openNewChat" />
      </aside>
      <section class="messages__chat">
        <ChatPanel v-if="props.userId" :user-id="props.userId" />
        <div v-else class="messages__placeholder">
          <UiEmpty
            :icon="MessagesSquare"
            title="Your conversations"
            description="Pick a conversation or start a new one with someone in your network."
          >
            <UiButton @click="openNewChat">New message</UiButton>
          </UiEmpty>
        </div>
      </section>
    </div>

    <UiSheet v-model:open="newChatOpen" title="New message" width="460px">
      <div class="stack" style="--gap: 12px">
        <UiInput v-model="search" :icon="Search" placeholder="Search your connections" type="search" aria-label="Search connections" />
        <div v-if="loadingConnections" class="center"><UiSpinner :size="24" /></div>
        <UiEmpty
          v-else-if="!connections.length"
          compact
          :icon="Users"
          title="No connections yet"
          description="Connect with people first, then you can message them here."
        >
          <UiButton to="/" size="sm" @click="newChatOpen = false">Discover people</UiButton>
        </UiEmpty>
        <div v-else class="pick-list">
          <button v-for="u in filtered" :key="u.id" type="button" class="pick" @click="startChat(u)">
            <UiAvatar :name="u.name" :src="u.avatarUrl" :size="42" :online="u.online" />
            <span class="pick__text">
              <strong class="truncate">{{ u.name }}</strong>
              <span class="muted truncate">{{ u.roleTitle }}</span>
            </span>
          </button>
          <p v-if="!filtered.length" class="subtle center">No matches</p>
        </div>
      </div>
    </UiSheet>
  </div>
</template>

<style scoped>
.messages-page {
  height: 100%;
  width: 100%;
}
.messages {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  background: var(--surface);
}
.messages__list {
  min-height: 0;
  border-right: 1px solid var(--border);
}
.messages__chat {
  display: none;
  min-height: 0;
  min-width: 0;
}
.messages.has-active .messages__list {
  display: none;
}
.messages.has-active .messages__chat {
  display: block;
}
.messages__placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  background: var(--surface-2);
}
.center {
  display: grid;
  place-items: center;
  padding: 20px;
}
.pick-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 55dvh;
  overflow-y: auto;
}
.pick {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  text-align: left;
}
.pick:hover {
  background: var(--surface-2);
}
.pick__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 0.9rem;
}

@media (min-width: 900px) {
  .messages-page {
    padding: 24px clamp(12px, 3vw, 24px);
    max-width: var(--content-max);
    margin: 0 auto;
  }
  .messages {
    grid-template-columns: 340px minmax(0, 1fr);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .messages.has-active .messages__list,
  .messages__list {
    display: block;
  }
  .messages__chat {
    display: block;
  }
}
</style>
