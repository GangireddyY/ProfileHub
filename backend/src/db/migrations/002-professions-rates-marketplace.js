import { DataTypes } from 'sequelize';

const timestamps = () => ({
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
});
const userRef = (allowNull = false, onDelete = 'CASCADE') => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model: 'users', key: 'id' },
  onDelete,
  onUpdate: 'CASCADE',
});

/** Category hues; professions inherit their category colour unless they had one before this migration. */
const CATEGORY_HUES = {
  tech: 243,
  health: 350,
  education: 32,
  creative: 290,
  business: 152,
  legal: 210,
  engineering: 45,
  trades: 25,
  construction: 15,
  transport: 200,
  industrial: 260,
  home: 170,
  hospitality: 5,
  agriculture: 110,
  retail: 330,
  security: 220,
  other: 225,
};

// [key, label, category, icon, hue?]
const CATALOG = [
  ['software', 'Software Developer', 'tech', 'CodeXml', 243],
  ['data_scientist', 'Data Scientist', 'tech', 'Brain'],
  ['it_support', 'IT Support Technician', 'tech', 'Headset'],
  ['network_admin', 'Network Administrator', 'tech', 'Server'],
  ['cloud_engineer', 'Cloud / DevOps Engineer', 'tech', 'Cloud'],
  ['cybersecurity', 'Cybersecurity Analyst', 'tech', 'Shield'],
  ['computer_operator', 'Computer Operator', 'tech', 'Laptop'],
  ['data_entry', 'Data Entry Operator', 'tech', 'Database'],
  ['mobile_repair', 'Mobile Phone Repair', 'tech', 'Smartphone'],

  ['doctor', 'Doctor', 'health', 'Stethoscope', 350],
  ['healthcare', 'Healthcare Worker', 'health', 'HeartPulse', 0],
  ['nurse', 'Nurse', 'health', 'Syringe'],
  ['pharmacist', 'Pharmacist', 'health', 'Pill'],
  ['lab_technician', 'Lab Technician', 'health', 'Microscope'],
  ['physiotherapist', 'Physiotherapist', 'health', 'Accessibility'],
  ['dentist', 'Dentist', 'health', 'Stethoscope'],
  ['caregiver', 'Caregiver / Attendant', 'health', 'HandHeart'],
  ['ward_assistant', 'Hospital Ward Assistant', 'health', 'Bed'],
  ['veterinarian', 'Veterinarian', 'health', 'PawPrint'],

  ['teacher', 'Teacher', 'education', 'GraduationCap', 32],
  ['tutor', 'Home Tutor', 'education', 'BookOpen'],
  ['professor', 'Professor / Lecturer', 'education', 'School'],
  ['trainer', 'Corporate Trainer', 'education', 'Users'],
  ['fitness_trainer', 'Fitness Trainer', 'education', 'Dumbbell'],
  ['yoga_instructor', 'Yoga Instructor', 'education', 'Leaf'],
  ['driving_instructor', 'Driving Instructor', 'education', 'Car'],
  ['language_tutor', 'Language Tutor / Translator', 'education', 'Languages'],
  ['music_teacher', 'Music Teacher', 'education', 'Music'],

  ['designer', 'Designer', 'creative', 'Palette', 290],
  ['creative', 'Creative Artist', 'creative', 'Clapperboard', 320],
  ['photographer', 'Photographer', 'creative', 'Camera'],
  ['videographer', 'Videographer / Editor', 'creative', 'Video'],
  ['musician', 'Musician', 'creative', 'Guitar'],
  ['writer', 'Writer / Content Creator', 'creative', 'PenTool'],
  ['artist', 'Painter / Artist', 'creative', 'Paintbrush'],
  ['makeup_artist', 'Makeup Artist', 'creative', 'Sparkles'],
  ['event_planner', 'Event Planner', 'creative', 'Flag'],
  ['printing', 'Printing & Signage', 'creative', 'Printer'],

  ['finance', 'Finance & Accounting', 'business', 'Landmark', 152],
  ['marketing', 'Marketing', 'business', 'Megaphone', 18],
  ['entrepreneur', 'Founder / Entrepreneur', 'business', 'Rocket', 265],
  ['accountant', 'Accountant', 'business', 'Calculator'],
  ['banker', 'Banker', 'business', 'Building2'],
  ['hr', 'HR Professional', 'business', 'Handshake'],
  ['consultant', 'Business Consultant', 'business', 'Briefcase'],
  ['insurance_agent', 'Insurance Agent', 'business', 'Receipt'],
  ['real_estate', 'Real Estate Agent', 'business', 'KeyRound'],
  ['office_admin', 'Office Administrator', 'business', 'Building'],
  ['customer_support', 'Customer Support', 'business', 'Headset'],

  ['lawyer', 'Lawyer', 'legal', 'Scale', 210],
  ['notary', 'Notary / Document Writer', 'legal', 'Scroll'],
  ['government', 'Government Employee', 'legal', 'Landmark'],
  ['social_worker', 'Social Worker / NGO', 'legal', 'HandHeart'],

  ['engineer', 'Engineer', 'engineering', 'HardHat', 45],
  ['civil_engineer', 'Civil Engineer', 'engineering', 'Ruler'],
  ['mechanical_engineer', 'Mechanical Engineer', 'engineering', 'Cog'],
  ['electrical_engineer', 'Electrical Engineer', 'engineering', 'Zap'],
  ['electronics_engineer', 'Electronics Engineer', 'engineering', 'Cpu'],
  ['architect', 'Architect', 'engineering', 'Building2'],
  ['surveyor', 'Land Surveyor', 'engineering', 'Signpost'],

  ['electrician', 'Electrician', 'trades', 'Zap'],
  ['plumber', 'Plumber', 'trades', 'Droplets'],
  ['carpenter', 'Carpenter', 'trades', 'Hammer'],
  ['painter', 'House Painter', 'trades', 'PaintRoller'],
  ['welder', 'Welder', 'trades', 'Flame'],
  ['mechanic', 'Auto Mechanic', 'trades', 'Wrench'],
  ['ac_technician', 'AC & Refrigeration Technician', 'trades', 'Fan'],
  ['appliance_repair', 'Appliance Repair Technician', 'trades', 'WashingMachine'],
  ['tailor', 'Tailor', 'trades', 'Scissors'],
  ['cobbler', 'Cobbler', 'trades', 'Footprints'],
  ['locksmith', 'Locksmith', 'trades', 'KeyRound'],
  ['tile_fitter', 'Tile & Marble Fitter', 'trades', 'Shapes'],
  ['cable_technician', 'Cable & Internet Technician', 'trades', 'Cable'],
  ['solar_installer', 'Solar Panel Installer', 'trades', 'Lightbulb'],
  ['jeweller', 'Goldsmith / Jeweller', 'trades', 'Gem'],

  ['daily_labour', 'Daily Wage Labourer', 'construction', 'Shovel'],
  ['mason', 'Mason', 'construction', 'BrickWall'],
  ['construction_worker', 'Construction Worker', 'construction', 'Construction'],
  ['helper', 'Helper / Loader', 'construction', 'Package'],
  ['site_supervisor', 'Site Supervisor', 'construction', 'HardHat'],
  ['excavation_worker', 'Excavation Worker', 'construction', 'Pickaxe'],
  ['movers', 'Packers & Movers', 'construction', 'Boxes'],

  ['driver', 'Driver', 'transport', 'Car'],
  ['taxi_driver', 'Taxi / Cab Driver', 'transport', 'CarTaxiFront'],
  ['auto_driver', 'Auto-rickshaw Driver', 'transport', 'CarTaxiFront'],
  ['truck_driver', 'Truck Driver', 'transport', 'Truck'],
  ['bus_driver', 'Bus Driver', 'transport', 'Bus'],
  ['delivery', 'Delivery Partner', 'transport', 'Bike'],
  ['courier', 'Courier', 'transport', 'Package'],
  ['ambulance_driver', 'Ambulance Driver', 'transport', 'Ambulance'],
  ['logistics', 'Logistics Coordinator', 'transport', 'Container'],
  ['pilot', 'Pilot', 'transport', 'Plane'],
  ['sailor', 'Sailor / Ship Crew', 'transport', 'Anchor'],

  ['machine_operator', 'Machine Operator', 'industrial', 'Cog'],
  ['forklift_operator', 'Forklift Operator', 'industrial', 'Forklift'],
  ['crane_operator', 'Crane Operator', 'industrial', 'Container'],
  ['jcb_operator', 'JCB / Excavator Operator', 'industrial', 'Tractor'],
  ['cnc_operator', 'CNC Operator', 'industrial', 'Cpu'],
  ['fitter', 'Fitter / Machinist', 'industrial', 'Wrench'],
  ['factory_worker', 'Factory Worker', 'industrial', 'Factory'],
  ['warehouse_worker', 'Warehouse Worker', 'industrial', 'Warehouse'],
  ['packer', 'Packing Staff', 'industrial', 'Boxes'],
  ['quality_inspector', 'Quality Inspector', 'industrial', 'Eye'],
  ['generator_operator', 'Generator Operator', 'industrial', 'Plug'],
  ['fuel_attendant', 'Petrol Pump Attendant', 'industrial', 'Fuel'],

  ['housekeeper', 'Housekeeper / Maid', 'home', 'Sparkles'],
  ['cook', 'Home Cook', 'home', 'Soup'],
  ['nanny', 'Nanny / Babysitter', 'home', 'Baby'],
  ['elder_care', 'Elder Care', 'home', 'HandHeart'],
  ['gardener', 'Gardener', 'home', 'Flower2'],
  ['laundry', 'Laundry / Ironing', 'home', 'Shirt'],
  ['barber', 'Barber', 'home', 'Scissors'],
  ['beautician', 'Beautician', 'home', 'Brush'],
  ['cleaner', 'Cleaning Services', 'home', 'Bubbles'],
  ['pest_control', 'Pest Control', 'home', 'Shield'],
  ['pet_care', 'Pet Groomer / Walker', 'home', 'PawPrint'],
  ['massage_therapist', 'Massage Therapist', 'home', 'Hand'],

  ['chef', 'Chef', 'hospitality', 'ChefHat'],
  ['waiter', 'Waiter / Server', 'hospitality', 'UtensilsCrossed'],
  ['barista', 'Barista', 'hospitality', 'Coffee'],
  ['baker', 'Baker', 'hospitality', 'Croissant'],
  ['bartender', 'Bartender', 'hospitality', 'Wine'],
  ['hotel_staff', 'Hotel Staff', 'hospitality', 'Hotel'],
  ['caterer', 'Caterer', 'hospitality', 'Soup'],
  ['kitchen_helper', 'Kitchen Helper', 'hospitality', 'UtensilsCrossed'],
  ['tour_guide', 'Tour Guide', 'hospitality', 'Mountain'],

  ['farmer', 'Farmer', 'agriculture', 'Wheat'],
  ['farm_worker', 'Farm Worker', 'agriculture', 'Sprout'],
  ['tractor_driver', 'Tractor Driver', 'agriculture', 'Tractor'],
  ['dairy_farmer', 'Dairy Farmer', 'agriculture', 'Leaf'],
  ['fisherman', 'Fisherman', 'agriculture', 'Fish'],
  ['florist', 'Florist', 'agriculture', 'Flower2'],

  ['salesperson', 'Salesperson', 'retail', 'Tag'],
  ['shopkeeper', 'Shopkeeper', 'retail', 'Store'],
  ['cashier', 'Cashier', 'retail', 'Receipt'],
  ['field_sales', 'Field Sales Executive', 'retail', 'Briefcase'],
  ['street_vendor', 'Street Vendor', 'retail', 'ShoppingCart'],
  ['telecaller', 'Telecaller', 'retail', 'Headset'],

  ['security_guard', 'Security Guard', 'security', 'ShieldCheck'],
  ['watchman', 'Watchman', 'security', 'Eye'],
  ['police', 'Police', 'security', 'Siren'],
  ['firefighter', 'Firefighter', 'security', 'Flame'],
  ['armed_forces', 'Armed Forces', 'security', 'Flag'],

  ['student', 'Student', 'other', 'BookOpen', 190],
  ['freelancer', 'Freelancer', 'other', 'Laptop'],
  ['homemaker', 'Homemaker', 'other', 'House'],
  ['retired', 'Retired', 'other', 'Armchair'],
  ['volunteer', 'Volunteer', 'other', 'HandHeart'],
  ['other', 'Other', 'other', 'Briefcase', 220],
];

export async function up({ context: qi }) {
  await qi.createTable('professions', {
    key: { type: DataTypes.STRING(48), primaryKey: true, allowNull: false },
    label: { type: DataTypes.STRING(60), allowNull: false },
    category: { type: DataTypes.STRING(24), allowNull: false },
    icon: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'Briefcase' },
    hue: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 220 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdById: userRef(true, 'SET NULL'),
    ...timestamps(),
  });
  await qi.addIndex('professions', ['category']);
  await qi.addIndex('professions', ['label']);

  const now = new Date();
  await qi.bulkInsert(
    'professions',
    CATALOG.map(([key, label, category, icon, hue]) => ({
      key,
      label,
      category,
      icon,
      hue: hue ?? CATEGORY_HUES[category],
      active: true,
      createdById: null,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await qi.createTable('profession_requests', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId: userRef(),
    label: { type: DataTypes.STRING(60), allowNull: false },
    category: { type: DataTypes.STRING(24), allowNull: false },
    note: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    professionKey: { type: DataTypes.STRING(48), allowNull: true },
    reviewedById: userRef(true, 'SET NULL'),
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewNote: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    ...timestamps(),
  });
  await qi.addIndex('profession_requests', ['status', 'createdAt']);
  await qi.addIndex('profession_requests', ['userId']);

  await qi.createTable('listings', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    sellerId: userRef(),
    title: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    category: { type: DataTypes.STRING(24), allowNull: false },
    condition: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'good' },
    price: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
    negotiable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    city: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    latitude: { type: DataTypes.DOUBLE, allowNull: true },
    longitude: { type: DataTypes.DOUBLE, allowNull: true },
    images: { type: DataTypes.JSON, allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    viewCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    soldAt: { type: DataTypes.DATE, allowNull: true },
    ...timestamps(),
  });
  await qi.addIndex('listings', ['status', 'createdAt']);
  await qi.addIndex('listings', ['sellerId', 'status']);
  await qi.addIndex('listings', ['category', 'status']);
  await qi.addIndex('listings', ['latitude', 'longitude']);

  await qi.addColumn('users', 'role', { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'member' });
  await qi.addColumn('users', 'rateAmount', { type: DataTypes.INTEGER, allowNull: true });
  await qi.addColumn('users', 'rateUnit', { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'hour' });
  await qi.addColumn('users', 'currency', { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' });
  await qi.addColumn('users', 'availableForWork', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
}

export async function down({ context: qi }) {
  for (const column of ['availableForWork', 'currency', 'rateUnit', 'rateAmount', 'role']) {
    await qi.removeColumn('users', column);
  }
  for (const table of ['listings', 'profession_requests', 'professions']) {
    await qi.dropTable(table);
  }
}
