<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { Camera, Trash2 } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { errorMessage } from '@/api/http';
import { toast } from '@/composables/useToast';
import UiAvatar from '@/components/ui/UiAvatar.vue';
import UiButton from '@/components/ui/UiButton.vue';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

const auth = useAuthStore();
const input = ref(null);
const preview = ref('');
const progress = ref(null);
const removing = ref(false);

const hasPhoto = computed(() => Boolean(auth.user?.avatarUrl));

function clearPreview() {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = '';
}

async function onFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!ACCEPT.split(',').includes(file.type)) return toast.error('Choose a JPG, PNG, WebP, GIF or AVIF image');
  if (file.size > MAX_BYTES) return toast.error('Image must be 5 MB or smaller');

  clearPreview();
  preview.value = URL.createObjectURL(file);
  progress.value = 0;
  try {
    await auth.uploadAvatar(file, (p) => (progress.value = p));
    toast.success('Profile photo updated');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    progress.value = null;
    clearPreview();
  }
}

async function remove() {
  removing.value = true;
  try {
    await auth.removeAvatar();
    toast.success('Profile photo removed');
  } catch (err) {
    toast.error(errorMessage(err));
  } finally {
    removing.value = false;
  }
}

onBeforeUnmount(clearPreview);
</script>

<template>
  <div class="uploader">
    <button type="button" class="uploader__avatar" aria-label="Change profile photo" @click="input.click()">
      <UiAvatar :name="auth.user.name" :src="preview || auth.user.avatarUrl" :size="88" />
      <span v-if="progress !== null" class="uploader__progress" :style="{ '--p': progress }">{{ progress }}%</span>
      <span v-else class="uploader__hover"><Camera /></span>
    </button>
    <div class="uploader__text">
      <strong>Profile photo</strong>
      <p class="muted">JPG, PNG, WebP or GIF up to 5 MB. It will be cropped to a square.</p>
      <div class="row wrap">
        <UiButton size="sm" variant="secondary" :icon="Camera" :loading="progress !== null" @click="input.click()">
          {{ hasPhoto ? 'Change photo' : 'Upload photo' }}
        </UiButton>
        <UiButton v-if="hasPhoto" size="sm" variant="ghost" :icon="Trash2" :loading="removing" @click="remove">Remove</UiButton>
      </div>
    </div>
    <input ref="input" type="file" :accept="ACCEPT" class="sr-only" tabindex="-1" @change="onFile" />
  </div>
</template>

<style scoped>
.uploader {
  display: flex;
  align-items: center;
  gap: 18px;
}
.uploader__avatar {
  position: relative;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  flex-shrink: 0;
}
.uploader__hover,
.uploader__progress {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
}
.uploader__hover {
  background: rgba(8, 12, 28, 0.45);
  opacity: 0;
  transition: opacity 0.2s var(--ease);
}
.uploader__hover svg {
  width: 24px;
  height: 24px;
}
.uploader__avatar:hover .uploader__hover,
.uploader__avatar:focus-visible .uploader__hover {
  opacity: 1;
}
.uploader__progress {
  background: radial-gradient(closest-side, rgba(8, 12, 28, 0.55) 82%, transparent 84%),
    conic-gradient(var(--primary) calc(var(--p) * 1%), rgba(255, 255, 255, 0.3) 0);
}
.uploader__text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.uploader__text p {
  font-size: 0.84rem;
}
@media (max-width: 479px) {
  .uploader {
    flex-direction: column;
    text-align: center;
  }
  .uploader__text .row {
    justify-content: center;
  }
}
</style>
