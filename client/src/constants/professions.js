import {
  Accessibility, Ambulance, Anchor, Armchair, Baby, Bed, Bike, BookOpen, Boxes, Brain, BrickWall, Briefcase, Brush,
  Bubbles, Building, Building2, Bus, Cable, Calculator, Camera, Car, CarTaxiFront, ChartLine, ChefHat, Clapperboard,
  Cloud, CodeXml, Coffee, Cog, Construction, Container, Cpu, Croissant, Database, Droplets, Dumbbell, Eye, Factory,
  Fan, Fish, Flag, Flame, Flower2, Footprints, Forklift, Fuel, Gem, GraduationCap, Guitar, Hammer, Hand, HandHeart,
  Handshake, HardHat, Headset, HeartPulse, Hotel, House, KeyRound, Landmark, Languages, Laptop, Leaf, Lightbulb,
  Megaphone, Microscope, Mountain, Music, Package, PaintRoller, Paintbrush, Palette, PawPrint, PenTool, Pickaxe, Pill,
  Plane, Plug, Printer, Receipt, Rocket, Ruler, Scale, School, Scissors, Scroll, Server, Shapes, Shield, ShieldCheck,
  Shirt, ShoppingCart, Shovel, Signpost, Siren, Smartphone, Soup, Sparkles, Sprout, Stethoscope, Store, Syringe, Tag,
  Tractor, Truck, Users, UtensilsCrossed, Video, Warehouse, WashingMachine, Wheat, Wine, Wrench, Zap,
} from 'lucide-vue-next';
import { useProfessionsStore } from '@/stores/professions';

/** Icon names stored in the database map to these components (keep in sync with server PROFESSION_ICONS). */
export const PROFESSION_ICONS = {
  Accessibility, Ambulance, Anchor, Armchair, Baby, Bed, Bike, BookOpen, Boxes, Brain, BrickWall, Briefcase, Brush,
  Bubbles, Building, Building2, Bus, Cable, Calculator, Camera, Car, CarTaxiFront, ChartLine, ChefHat, Clapperboard,
  Cloud, CodeXml, Coffee, Cog, Construction, Container, Cpu, Croissant, Database, Droplets, Dumbbell, Eye, Factory,
  Fan, Fish, Flag, Flame, Flower2, Footprints, Forklift, Fuel, Gem, GraduationCap, Guitar, Hammer, Hand, HandHeart,
  Handshake, HardHat, Headset, HeartPulse, Hotel, House, KeyRound, Landmark, Languages, Laptop, Leaf, Lightbulb,
  Megaphone, Microscope, Mountain, Music, Package, PaintRoller, Paintbrush, Palette, PawPrint, PenTool, Pickaxe, Pill,
  Plane, Plug, Printer, Receipt, Rocket, Ruler, Scale, School, Scissors, Scroll, Server, Shapes, Shield, ShieldCheck,
  Shirt, ShoppingCart, Shovel, Signpost, Siren, Smartphone, Soup, Sparkles, Sprout, Stethoscope, Store, Syringe, Tag,
  Tractor, Truck, Users, UtensilsCrossed, Video, Warehouse, WashingMachine, Wheat, Wine, Wrench, Zap,
};

export const iconFor = (name) => PROFESSION_ICONS[name] || Briefcase;

export const RATE_UNITS = [
  { value: 'hour', label: 'per hour', short: 'hr' },
  { value: 'day', label: 'per day', short: 'day' },
  { value: 'job', label: 'per job / visit', short: 'job' },
  { value: 'month', label: 'per month', short: 'month' },
];

export const CURRENCIES = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
  { value: 'AED', label: 'AED' },
];

/** Profession details for a key, with icon component resolved. Reactive once the catalog has loaded. */
export const getProfession = (key) => useProfessionsStore().get(key);
export const getCategory = (key) => useProfessionsStore().category(key);
