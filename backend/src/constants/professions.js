/** Profession groups. Professions themselves live in the `professions` table so admins can add more. */
export const PROFESSION_CATEGORIES = [
  { key: 'tech', label: 'Technology', icon: 'Laptop', hue: 243 },
  { key: 'health', label: 'Healthcare', icon: 'HeartPulse', hue: 350 },
  { key: 'education', label: 'Education & Fitness', icon: 'GraduationCap', hue: 32 },
  { key: 'creative', label: 'Creative & Media', icon: 'Palette', hue: 290 },
  { key: 'business', label: 'Business & Finance', icon: 'ChartLine', hue: 152 },
  { key: 'legal', label: 'Legal & Public Service', icon: 'Scale', hue: 210 },
  { key: 'engineering', label: 'Engineering', icon: 'HardHat', hue: 45 },
  { key: 'trades', label: 'Skilled Trades', icon: 'Wrench', hue: 25 },
  { key: 'construction', label: 'Construction & Labour', icon: 'Shovel', hue: 15 },
  { key: 'transport', label: 'Driving & Transport', icon: 'Truck', hue: 200 },
  { key: 'industrial', label: 'Operators & Factory', icon: 'Factory', hue: 260 },
  { key: 'home', label: 'Home & Personal Care', icon: 'House', hue: 170 },
  { key: 'hospitality', label: 'Food & Hospitality', icon: 'ChefHat', hue: 5 },
  { key: 'agriculture', label: 'Farming & Outdoors', icon: 'Sprout', hue: 110 },
  { key: 'retail', label: 'Sales & Retail', icon: 'Store', hue: 330 },
  { key: 'security', label: 'Security & Safety', icon: 'ShieldCheck', hue: 220 },
  { key: 'other', label: 'Students & Others', icon: 'Sparkles', hue: 225 },
];

export const CATEGORY_KEYS = PROFESSION_CATEGORIES.map((c) => c.key);

/** Icons the client knows how to render (see frontend/src/constants/professions.js). */
export const PROFESSION_ICONS = [
  'Accessibility', 'Ambulance', 'Anchor', 'Armchair', 'Baby', 'Bed', 'Bike', 'BookOpen', 'Boxes', 'Brain',
  'BrickWall', 'Briefcase', 'Brush', 'Bubbles', 'Building', 'Building2', 'Bus', 'Cable', 'Calculator', 'Camera',
  'Car', 'CarTaxiFront', 'ChartLine', 'ChefHat', 'Clapperboard', 'Cloud', 'CodeXml', 'Coffee', 'Cog',
  'Construction', 'Container', 'Cpu', 'Croissant', 'Database', 'Droplets', 'Dumbbell', 'Eye', 'Factory', 'Fan',
  'Fish', 'Flag', 'Flame', 'Flower2', 'Footprints', 'Forklift', 'Fuel', 'Gem', 'GraduationCap', 'Guitar', 'Hammer',
  'Hand', 'HandHeart', 'Handshake', 'HardHat', 'Headset', 'HeartPulse', 'Hotel', 'House', 'KeyRound', 'Landmark',
  'Languages', 'Laptop', 'Leaf', 'Lightbulb', 'Megaphone', 'Microscope', 'Mountain', 'Music', 'Package',
  'PaintRoller', 'Paintbrush', 'Palette', 'PawPrint', 'PenTool', 'Pickaxe', 'Pill', 'Plane', 'Plug', 'Printer',
  'Receipt', 'Rocket', 'Ruler', 'Scale', 'School', 'Scissors', 'Scroll', 'Server', 'Shapes', 'Shield',
  'ShieldCheck', 'Shirt', 'ShoppingCart', 'Shovel', 'Signpost', 'Siren', 'Smartphone', 'Soup', 'Sparkles',
  'Sprout', 'Stethoscope', 'Store', 'Syringe', 'Tag', 'Tractor', 'Truck', 'Users', 'UtensilsCrossed', 'Video',
  'Warehouse', 'WashingMachine', 'Wheat', 'Wine', 'Wrench', 'Zap',
];

export const RATE_UNITS = ['hour', 'day', 'job', 'month'];
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
