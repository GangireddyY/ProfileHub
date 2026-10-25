<script setup>
import { ref, reactive, computed, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { ImagePlus, X, Star, ArrowLeft, Send, Save, Camera, PackageX } from 'lucide-vue-next';
import { api, errorMessage, fieldErrors } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/composables/useToast';
import { LISTING_CATEGORIES, CONDITIONS, MAX_LISTING_IMAGES, getListingCategory } from '@/constants/marketplace';
import { CURRENCIES } from '@/constants/professions';
import { formatMoney } from '@/utils/format';
import UiCard from '@/components/ui/UiCard.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiTextarea from '@/components/ui/UiTextarea.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiToggle from '@/components/ui/UiToggle.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiEmpty from '@/components/ui/UiEmpty.vue';
import UiSpinner from '@/components/ui/UiSpinner.vue';

const props = defineProps({ id: { type: String, default: '' } });
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const auth = useAuthStore();
const router = useRouter();
const isEdit = computed(() => Boolean(props.id));

const form = reactive({
  title: '',
  category: '',
  condition: 'good',
  price: '',
  currency: auth.user?.currency || 'INR',
  negotiable: true,
  city: auth.user?.city || '',
  description: '',
});
/** Unified photo list: { key, url, file? } — `file` marks a new upload not yet on the server. */
const photos = ref([]);
const errors = ref({});
const formError = ref('');
const saving = ref(false);
const progress = ref(0);
const loading = ref(isEdit.value);
const loadError = ref('');
const fileInput = ref(null);
const dragging = ref(false);

const pricePreview = computed(() => (form.price === '' ? '' : formatMoney(Number(form.price) || 0, form.currency)));
const selectedCategory = computed(() => (form.category ? getListingCategory(form.category) : null));

async function loadListing() {
  try {
    const { data } = await api.get(`/listings/${props.id}`);
    const l = data.listing;
    if (!l.isMine) {
      loadError.value = 'You can only edit your own listings';
      return;
    }
    Object.assign(form, {
      title: l.title,
      category: l.category,
      condition: l.condition,
      price: l.price,
      currency: l.currency,
      negotiable: l.negotiable,
      city: l.city,
      description: l.description,
    });
    photos.value = l.images.map((url) => ({ key: url, url }));
  } catch (err) {
    loadError.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}
if (isEdit.value) loadListing();

function addFiles(fileList) {
  const files = [...fileList];
  const room = MAX_LISTING_IMAGES - photos.value.length;
  if (files.length > room) toast.info(`You can add up to ${MAX_LISTING_IMAGES} photos`);
  for (const file of files.slice(0, Math.max(0, room))) {
    if (!TYPES.includes(file.type)) {
      toast.error(`${file.name} is not a supported image`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name} is larger than 8 MB`);
      continue;
    }
    photos.value.push({ key: `${file.name}-${file.size}-${Math.random()}`, url: URL.createObjectURL(file), file });
  }
}

function onPick(e) {
  addFiles(e.target.files);
  e.target.value = '';
}

function onDrop(e) {
  dragging.value = false;
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
}

function removePhoto(i) {
  const [p] = photos.value.splice(i, 1);
  if (p.file) URL.revokeObjectURL(p.url);
}

function makeCover(i) {
  const [p] = photos.value.splice(i, 1);
  photos.value.unshift(p);
}

function validateForm() {
  const e = {};
  if (form.title.trim().length < 3) e.title = 'Use at least 3 characters';
  if (!form.category) e.category = 'Pick a category';
  if (form.price === '' || Number(form.price) < 0) e.price = 'Enter a price (0 for free)';
  errors.value = e;
  return !Object.keys(e).length;
}

async function submit() {
  formError.value = '';
  if (!validateForm()) {
    formError.value = 'Please fix the highlighted fields';
    return;
  }
  const body = new FormData();
  for (const [k, v] of Object.entries(form)) body.append(k, typeof v === 'string' ? v.trim() : String(v));

  const newFiles = photos.value.filter((p) => p.file);
  newFiles.forEach((p) => body.append('images', p.file));
  if (isEdit.value) {
    body.append('keepImages', JSON.stringify(photos.value.filter((p) => !p.file).map((p) => p.url)));
    body.append('order', JSON.stringify(photos.value.map((p) => (p.file ? `new:${newFiles.indexOf(p)}` : p.url))));
  }

  saving.value = true;
  progress.value = 0;
  try {
    const config = {
      timeout: 120000,
      onUploadProgress: (e) => e.total && (progress.value = Math.round((e.loaded / e.total) * 100)),
    };
    const { data } = isEdit.value
      ? await api.put(`/listings/${props.id}`, body, config)
      : await api.post('/listings', body, config);
    toast.success(isEdit.value ? 'Listing updated' : 'Your listing is live!');
    router.replace(`/market/${data.listing.id}`);
  } catch (err) {
    errors.value = fieldErrors(err);
    formError.value = errorMessage(err);
  } finally {
    saving.value = false;
  }
}

onBeforeUnmount(() => photos.value.forEach((p) => p.file && URL.revokeObjectURL(p.url)));
</script>

<template>
  <div class="container editor">
    <UiButton :to="isEdit ? `/market/${id}` : '/market'" variant="ghost" size="sm" :icon="ArrowLeft" class="back">
      {{ isEdit ? 'Back to listing' : 'Marketplace' }}
    </UiButton>

    <header class="page-head">
      <div>
        <h1 class="page-title">{{ isEdit ? 'Edit listing' : 'Sell something' }}</h1>
        <p class="muted">Good photos and an honest description help you sell faster.</p>
      </div>
    </header>

    <div v-if="loading" class="center"><UiSpinner :size="28" /></div>

    <UiCard v-else-if="loadError">
      <UiEmpty :icon="PackageX" title="Can't edit this listing" :description="loadError">
        <UiButton to="/market" variant="secondary">Back to Marketplace</UiButton>
      </UiEmpty>
    </UiCard>

    <form v-else class="layout" novalidate @submit.prevent="submit">
      <div class="stack" style="--gap: 16px; min-width: 0">
        <UiCard>
          <header class="card-head">
            <h2 class="section-title">Photos</h2>
            <span class="subtle">{{ photos.length }}/{{ MAX_LISTING_IMAGES }} · first photo is the cover</span>
          </header>
          <div
            class="photos"
            :class="{ 'is-dragging': dragging }"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <TransitionGroup name="list">
              <div v-for="(p, i) in photos" :key="p.key" class="photo">
                <img :src="p.url" alt="" />
                <span v-if="i === 0" class="photo__cover">Cover</span>
                <div class="photo__actions">
                  <button v-if="i > 0" type="button" aria-label="Make cover photo" title="Make cover" @click="makeCover(i)"><Star /></button>
                  <button type="button" aria-label="Remove photo" title="Remove" @click="removePhoto(i)"><X /></button>
                </div>
              </div>
            </TransitionGroup>
            <button v-if="photos.length < MAX_LISTING_IMAGES" type="button" class="photo photo--add" @click="fileInput.click()">
              <ImagePlus />
              <span>{{ photos.length ? 'Add more' : 'Add photos' }}</span>
              <small>or drag &amp; drop</small>
            </button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onPick" />
          <p v-if="!photos.length" class="hint"><Camera /> Listings with photos get far more replies. You can also post without one.</p>
        </UiCard>

        <UiCard class="stack" style="--gap: 16px">
          <h2 class="section-title">Details</h2>
          <UiInput v-model="form.title" label="Title" maxlength="100" placeholder="e.g. Honda Activa 6G, 2023, single owner" :error="errors.title" />

          <fieldset class="group">
            <legend class="field__label">Category</legend>
            <div class="cats">
              <button
                v-for="c in LISTING_CATEGORIES"
                :key="c.key"
                type="button"
                class="cat"
                :class="{ 'is-active': form.category === c.key }"
                :style="{ '--hue': c.hue }"
                :aria-pressed="form.category === c.key"
                @click="form.category = c.key"
              >
                <span class="cat__icon"><component :is="c.icon" /></span>
                {{ c.label }}
              </button>
            </div>
            <p v-if="errors.category" class="field__msg field__msg--error">{{ errors.category }}</p>
          </fieldset>

          <fieldset class="group">
            <legend class="field__label">Condition</legend>
            <div class="conds" role="radiogroup">
              <button
                v-for="c in CONDITIONS"
                :key="c.value"
                type="button"
                role="radio"
                class="cond"
                :class="{ 'is-active': form.condition === c.value }"
                :aria-checked="form.condition === c.value"
                @click="form.condition = c.value"
              >
                {{ c.label }}
              </button>
            </div>
          </fieldset>

          <UiTextarea
            v-model="form.description"
            label="Description"
            :maxlength="4000"
            :rows="6"
            placeholder="Age, usage, any defects, what's included, why you're selling…"
            :error="errors.description"
          />
        </UiCard>
      </div>

      <div class="side">
        <UiCard class="stack" style="--gap: 16px">
          <h2 class="section-title">Price &amp; location</h2>
          <div class="price-row">
            <UiSelect v-model="form.currency" label="Currency" :options="CURRENCIES" />
            <UiInput
              v-model="form.price"
              label="Price"
              type="number"
              min="0"
              inputmode="numeric"
              placeholder="0 = free"
              :error="errors.price"
              :hint="pricePreview"
            />
          </div>
          <UiToggle v-model="form.negotiable" label="Open to offers" description="Show buyers the price is negotiable" />
          <UiInput v-model="form.city" label="City / area" maxlength="100" placeholder="e.g. Indiranagar, Bengaluru" :error="errors.city" />
          <p class="subtle small">
            If you share your location, buyers see how far away the item is. Your exact location is never shown.
          </p>
        </UiCard>

        <UiCard class="preview" :style="{ '--hue': selectedCategory?.hue ?? 220 }">
          <span class="preview__label">Preview</span>
          <div class="preview__media">
            <img v-if="photos[0]" :src="photos[0].url" alt="" />
            <component :is="selectedCategory.icon" v-else-if="selectedCategory" class="preview__icon" />
          </div>
          <strong class="preview__price">{{ pricePreview || '₹ —' }}</strong>
          <span class="preview__title">{{ form.title || 'Your listing title' }}</span>
        </UiCard>

        <p v-if="formError" class="form-alert" role="alert">{{ formError }}</p>
        <UiButton type="submit" size="lg" block :loading="saving" :icon="isEdit ? Save : Send">
          {{ saving && progress < 100 && photos.some((p) => p.file) ? `Uploading ${progress}%` : isEdit ? 'Save changes' : 'Publish listing' }}
        </UiButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.back {
  align-self: flex-start;
  margin-left: -8px;
}
.center {
  display: grid;
  place-items: center;
  padding: 48px 0;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.card-head .subtle {
  font-size: 0.82rem;
}

.photos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  padding: 4px;
  border-radius: var(--radius);
  transition: background-color 0.15s;
}
.photos.is-dragging {
  background: var(--primary-soft);
  outline: 2px dashed var(--primary);
}
.photo {
  position: relative;
  aspect-ratio: 1;
  border-radius: 14px;
  overflow: hidden;
  background: var(--surface-3);
}
.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo__cover {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--primary);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
}
.photo__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
}
.photo__actions button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.7);
  color: #fff;
}
.photo__actions button:hover {
  background: rgba(15, 23, 42, 0.9);
}
.photo__actions svg {
  width: 15px;
  height: 15px;
}
.photo--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 2px dashed var(--border-strong);
  background: var(--surface-2);
  color: var(--text-2);
  font-weight: 700;
  font-size: 0.86rem;
  transition: border-color 0.15s, color 0.15s;
}
.photo--add:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.photo--add svg {
  width: 26px;
  height: 26px;
}
.photo--add small {
  font-weight: 500;
  font-size: 0.72rem;
  color: var(--text-3);
}
.hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 0.84rem;
  color: var(--text-3);
}
.hint svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.group {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.cat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.84rem;
  text-align: left;
  transition: all 0.15s var(--ease);
}
.cat:hover {
  border-color: hsl(var(--hue) 60% 60%);
}
.cat__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 9px;
  background: hsl(var(--hue) 85% 95%);
  color: hsl(var(--hue) 60% 42%);
}
[data-theme='dark'] .cat__icon {
  background: hsl(var(--hue) 60% 50% / 0.18);
  color: hsl(var(--hue) 85% 75%);
}
.cat__icon svg {
  width: 16px;
  height: 16px;
}
.cat.is-active {
  border-color: hsl(var(--hue) 65% 52%);
  background: hsl(var(--hue) 85% 52% / 0.08);
  color: var(--text);
  box-shadow: 0 0 0 3px hsl(var(--hue) 70% 55% / 0.16);
}
.cat.is-active .cat__icon {
  background: hsl(var(--hue) 65% 52%);
  color: #fff;
}
.conds {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cond {
  height: 38px;
  padding: 0 14px;
  border-radius: 99px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.86rem;
  transition: all 0.15s var(--ease);
}
.cond.is-active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

.side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.price-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}
.small {
  font-size: 0.8rem;
}
.preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.preview__label {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
}
.preview__media {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(135deg, hsl(var(--hue) 70% 94%), hsl(calc(var(--hue) + 30) 70% 88%));
  color: hsl(var(--hue) 55% 45%);
}
[data-theme='dark'] .preview__media {
  background: linear-gradient(135deg, hsl(var(--hue) 40% 18%), hsl(calc(var(--hue) + 30) 40% 14%));
  color: hsl(var(--hue) 80% 72%);
}
.preview__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview__icon {
  width: 30%;
  height: 30%;
  stroke-width: 1.4;
}
.preview__price {
  font-size: 1.15rem;
  font-weight: 800;
}
.preview__title {
  color: var(--text-2);
  font-size: 0.9rem;
}
.form-alert {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.9rem;
  font-weight: 500;
}

@media (min-width: 960px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
  .side {
    position: sticky;
    top: calc(var(--nav-h) + 24px);
  }
}
</style>
