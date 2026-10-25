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

export const LISTING_CATEGORIES = [
  { key: 'vehicles', label: 'Cars & Vehicles', icon: Car, hue: 210 },
  { key: 'bikes', label: 'Bikes & Scooters', icon: Bike, hue: 15 },
  { key: 'mobiles', label: 'Mobiles', icon: Smartphone, hue: 250 },
  { key: 'electronics', label: 'Electronics', icon: Laptop, hue: 230 },
  { key: 'furniture', label: 'Furniture', icon: Sofa, hue: 30 },
  { key: 'appliances', label: 'Appliances', icon: Refrigerator, hue: 190 },
  { key: 'books', label: 'Books', icon: BookOpen, hue: 40 },
  { key: 'fashion', label: 'Fashion', icon: Shirt, hue: 320 },
  { key: 'tools', label: 'Tools & DIY', icon: Wrench, hue: 25 },
  { key: 'sports', label: 'Sports & Fitness', icon: Dumbbell, hue: 140 },
  { key: 'music', label: 'Music', icon: Guitar, hue: 280 },
  { key: 'kids', label: 'Kids & Baby', icon: Baby, hue: 345 },
  { key: 'pets', label: 'Pets', icon: PawPrint, hue: 95 },
  { key: 'property', label: 'Property & Rentals', icon: Building2, hue: 175 },
  { key: 'other', label: 'Other', icon: Package, hue: 220 },
];

const byKey = Object.fromEntries(LISTING_CATEGORIES.map((c) => [c.key, c]));
export const getListingCategory = (key) => byKey[key] || byKey.other;

export const CONDITIONS = [
  { value: 'new', label: 'Brand new' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'for_parts', label: 'For parts' },
];
export const conditionLabel = (value) => CONDITIONS.find((c) => c.value === value)?.label || value;

export const LISTING_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'distance', label: 'Nearest first' },
];

export const MAX_LISTING_IMAGES = 8;
