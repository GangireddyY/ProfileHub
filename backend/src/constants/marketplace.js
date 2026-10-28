export const LISTING_CATEGORIES = [
  'vehicles',
  'bikes',
  'electronics',
  'mobiles',
  'furniture',
  'appliances',
  'books',
  'fashion',
  'tools',
  'sports',
  'music',
  'kids',
  'pets',
  'property',
  'other',
];

/** Words people search with, so "bike" also finds a "Royal Enfield" listed under bikes. */
export const LISTING_CATEGORY_KEYWORDS = {
  vehicles: 'cars vehicles auto jeep suv van',
  bikes: 'bikes motorbikes motorcycles scooters scooty cycles bicycles',
  electronics: 'electronics laptops computers tv television camera headphones monitor',
  mobiles: 'mobiles phones smartphones iphone android tablets',
  furniture: 'furniture sofa table chair bed wardrobe cupboard',
  appliances: 'appliances fridge refrigerator washing machine ac cooler microwave',
  books: 'books novels textbooks',
  fashion: 'fashion clothes clothing shoes dress watch bags',
  tools: 'tools drill hardware ladder',
  sports: 'sports fitness gym cricket football treadmill',
  music: 'music instruments guitar keyboard piano',
  kids: 'kids baby toys stroller',
  pets: 'pets dog cat aquarium',
  property: 'property rent flat house apartment land plot pg',
  other: '',
};

export const LISTING_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'for_parts'];
export const LISTING_STATUSES = ['active', 'sold', 'archived'];
export const MAX_LISTING_IMAGES = 8;
