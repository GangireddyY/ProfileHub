import {
  Car,
  Bike,
  Laptop,
  Smartphone,
  Sofa,
  Refrigerator,
  BookOpen,
  Shirt,
  Wrench,
  Dumbbell,
  Guitar,
  Baby,
  PawPrint,
  Building2,
  Package,
} from 'lucide-vue-next';
import { t } from '@/i18n';

/** `label` is a getter so it follows the selected language wherever it is read. */
const translated = (list, prefix, idKey) =>
  list.map((item) =>
    Object.defineProperty(item, 'label', { get: () => t(`${prefix}.${item[idKey]}`), enumerable: true }),
  );

export const LISTING_CATEGORIES = translated(
  [
    { key: 'vehicles', icon: Car, hue: 210 },
    { key: 'bikes', icon: Bike, hue: 15 },
    { key: 'mobiles', icon: Smartphone, hue: 250 },
    { key: 'electronics', icon: Laptop, hue: 230 },
    { key: 'furniture', icon: Sofa, hue: 30 },
    { key: 'appliances', icon: Refrigerator, hue: 190 },
    { key: 'books', icon: BookOpen, hue: 40 },
    { key: 'fashion', icon: Shirt, hue: 320 },
    { key: 'tools', icon: Wrench, hue: 25 },
    { key: 'sports', icon: Dumbbell, hue: 140 },
    { key: 'music', icon: Guitar, hue: 280 },
    { key: 'kids', icon: Baby, hue: 345 },
    { key: 'pets', icon: PawPrint, hue: 95 },
    { key: 'property', icon: Building2, hue: 175 },
    { key: 'other', icon: Package, hue: 220 },
  ],
  'market.cat',
  'key',
);

const byKey = Object.fromEntries(LISTING_CATEGORIES.map((c) => [c.key, c]));
export const getListingCategory = (key) => byKey[key] || byKey.other;

export const CONDITIONS = translated(
  [{ value: 'new' }, { value: 'like_new' }, { value: 'good' }, { value: 'fair' }, { value: 'for_parts' }],
  'market.cond',
  'value',
);
export const conditionLabel = (value) => CONDITIONS.find((c) => c.value === value)?.label || value;

export const LISTING_SORTS = translated(
  [{ value: 'newest' }, { value: 'price_asc' }, { value: 'price_desc' }, { value: 'distance' }],
  'market.sort',
  'value',
);

export const MAX_LISTING_IMAGES = 8;
