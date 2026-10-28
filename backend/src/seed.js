import bcrypt from 'bcryptjs';
import {
  initDb,
  sequelize,
  User,
  Connection,
  Message,
  Experience,
  Notification,
  Listing,
  ProfessionRequest,
} from './models/index.js';

const PASSWORD = 'password123';

// Deterministic PRNG so every seed produces the same data.
let state = 42;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const sample = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n);

const CITIES = [
  { city: 'Bengaluru', lat: 12.9716, lng: 77.5946, weight: 14 },
  { city: 'Mysuru', lat: 12.2958, lng: 76.6394, weight: 3 },
  { city: 'Chennai', lat: 13.0827, lng: 80.2707, weight: 4 },
  { city: 'Hyderabad', lat: 17.385, lng: 78.4867, weight: 4 },
  { city: 'Mumbai', lat: 19.076, lng: 72.8777, weight: 4 },
  { city: 'Delhi', lat: 28.6139, lng: 77.209, weight: 3 },
  { city: 'Pune', lat: 18.5204, lng: 73.8567, weight: 3 },
];

const ROLES = {
  software: {
    titles: ['Senior Software Engineer', 'Full-stack Developer', 'Frontend Engineer', 'DevOps Engineer', 'Mobile Developer'],
    skills: ['Node.js', 'Vue', 'React', 'TypeScript', 'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'Go', 'Flutter'],
  },
  doctor: {
    titles: ['Cardiologist', 'General Physician', 'Pediatrician', 'Orthopedic Surgeon', 'Dermatologist'],
    skills: ['Patient Care', 'Diagnostics', 'Surgery', 'Telemedicine', 'Clinical Research', 'Emergency Medicine'],
  },
  healthcare: {
    titles: ['Registered Nurse', 'Physiotherapist', 'Pharmacist', 'Lab Technician'],
    skills: ['Patient Care', 'Rehabilitation', 'Pharmacology', 'ICU', 'First Aid'],
  },
  teacher: {
    titles: ['Mathematics Teacher', 'Physics Lecturer', 'English Professor', 'Primary School Teacher'],
    skills: ['Curriculum Design', 'Mentoring', 'EdTech', 'Public Speaking', 'Assessment'],
  },
  designer: {
    titles: ['Product Designer', 'UX Researcher', 'UI Designer', 'Brand Designer'],
    skills: ['Figma', 'Design Systems', 'Prototyping', 'User Research', 'Illustration', 'Motion'],
  },
  engineer: {
    titles: ['Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Structural Engineer'],
    skills: ['AutoCAD', 'SolidWorks', 'Project Management', 'MATLAB', 'Site Supervision'],
  },
  lawyer: {
    titles: ['Corporate Lawyer', 'Legal Advisor', 'Criminal Defense Attorney'],
    skills: ['Contracts', 'Litigation', 'Compliance', 'IP Law', 'Negotiation'],
  },
  finance: {
    titles: ['Chartered Accountant', 'Financial Analyst', 'Investment Banker'],
    skills: ['Excel', 'Financial Modeling', 'Taxation', 'Audit', 'Valuation'],
  },
  marketing: {
    titles: ['Growth Marketer', 'Content Strategist', 'SEO Specialist', 'Brand Manager'],
    skills: ['SEO', 'Content', 'Analytics', 'Social Media', 'Copywriting', 'Ads'],
  },
  entrepreneur: {
    titles: ['Founder & CEO', 'Co-founder', 'Startup Advisor'],
    skills: ['Fundraising', 'Leadership', 'Strategy', 'Product', 'Sales'],
  },
  student: {
    titles: ['Computer Science Student', 'MBBS Student', 'Design Student', 'MBA Candidate'],
    skills: ['Python', 'Research', 'Teamwork', 'Java', 'Presentation'],
  },
  creative: {
    titles: ['Photographer', 'Video Editor', 'Music Producer', 'Writer'],
    skills: ['Photography', 'Premiere Pro', 'Storytelling', 'Lightroom', 'Writing'],
  },
};

/** Typical rates so Discover can show and filter by price. [min, max, unit] */
const RATES = {
  software: [800, 2500, 'hour'],
  doctor: [500, 1500, 'job'],
  healthcare: [300, 700, 'hour'],
  teacher: [400, 900, 'hour'],
  designer: [700, 2000, 'hour'],
  engineer: [600, 1800, 'hour'],
  lawyer: [2000, 6000, 'job'],
  finance: [800, 2500, 'hour'],
  marketing: [600, 1800, 'hour'],
  creative: [1500, 6000, 'job'],
};

/** Everyday and blue-collar work, so the catalog isn't only office jobs. */
const WORKERS = [
  ['Ramesh Gowda', 'electrician', 'Licensed Electrician', ['Wiring', 'MCB & DB boards', 'Inverter setup', 'Fan & light fitting'], [250, 400, 'hour']],
  ['Suresh Kumar', 'plumber', 'Plumber', ['Leak repair', 'Bathroom fitting', 'Water tank cleaning', 'Pipeline'], [250, 400, 'hour']],
  ['Manjunath B', 'driver', 'Personal Driver', ['Manual & automatic', 'Outstation trips', 'Night driving'], [800, 1200, 'day']],
  ['Imran Pasha', 'taxi_driver', 'Cab Driver (Sedan)', ['Airport drops', 'City tours', 'Kannada, Hindi, English'], [1500, 2500, 'day']],
  ['Lakshmamma', 'daily_labour', 'Daily Wage Worker', ['Loading', 'Site cleaning', 'Shifting help'], [600, 800, 'day']],
  ['Basavaraj H', 'mason', 'Mason', ['Brick work', 'Plastering', 'Tiling'], [900, 1200, 'day']],
  ['Joseph D’Souza', 'carpenter', 'Carpenter', ['Modular furniture', 'Door repair', 'Polishing'], [300, 500, 'hour']],
  ['Venkatesh R', 'forklift_operator', 'Forklift Operator', ['Reach truck', 'Warehouse safety', 'Inventory'], [700, 1000, 'day']],
  ['Shivakumar N', 'jcb_operator', 'JCB Operator', ['Excavation', 'Trenching', 'Site levelling'], [1200, 1800, 'hour']],
  ['Prakash Naik', 'machine_operator', 'CNC Machine Operator', ['CNC lathe', 'Fanuc', 'Quality checks'], [700, 1000, 'day']],
  ['Saroja Devi', 'housekeeper', 'Housekeeper', ['Cleaning', 'Laundry', 'Cooking help'], [8000, 12000, 'month']],
  ['Anitha M', 'cook', 'Home Cook (South & North Indian)', ['Veg & non-veg', 'Meal prep', 'Tiffin'], [9000, 15000, 'month']],
  ['Raju Thapa', 'security_guard', 'Security Guard', ['Night shift', 'CCTV monitoring', 'Visitor management'], [14000, 18000, 'month']],
  ['Arif Khan', 'delivery', 'Delivery Partner (Bike)', ['Same-day delivery', 'Own bike', 'Google Maps'], [80, 150, 'hour']],
  ['Gopal Shetty', 'painter', 'House Painter', ['Interior & exterior', 'Texture', 'Waterproofing'], [700, 1000, 'day']],
  ['Mohammed Salim', 'mechanic', 'Two-wheeler & Car Mechanic', ['Engine repair', 'Servicing', 'Breakdown help'], [300, 600, 'job']],
  ['Fatima Begum', 'tailor', 'Tailor', ['Blouse stitching', 'Alterations', 'Kids wear'], [150, 800, 'job']],
  ['Harjeet Singh', 'truck_driver', 'Truck Driver (HMV licence)', ['Long haul', 'Container trucks', 'Interstate'], [1200, 1600, 'day']],
  ['Kempaiah', 'gardener', 'Gardener', ['Lawn care', 'Terrace garden', 'Pruning'], [500, 700, 'day']],
  ['Santosh Patil', 'welder', 'Welder', ['Arc welding', 'Gates & grills', 'Fabrication'], [800, 1100, 'day']],
  ['Dinesh Yadav', 'ac_technician', 'AC Technician', ['Split & window AC', 'Gas refill', 'Installation'], [400, 700, 'job']],
  ['Kavitha S', 'beautician', 'Beautician (Home visits)', ['Bridal makeup', 'Facials', 'Mehendi'], [500, 3000, 'job']],
  ['Revathi K', 'tutor', 'Home Tutor (Maths & Science)', ['CBSE', 'ICSE', 'Class 6-10'], [300, 600, 'hour']],
  ['Shalini Rao', 'nurse', 'Home Care Nurse', ['Elder care', 'Post-surgery care', 'Injections'], [800, 1500, 'day']],
];

const LISTINGS = [
  ['vehicles', 'Maruti Swift VXi 2018, single owner', 420000, 'good', 'Petrol, 48,000 km, full service history at Maruti. New tyres last year, insurance valid till March.'],
  ['vehicles', 'Hyundai Creta SX 2020 diesel', 1150000, 'like_new', 'Top variant, sunroof, 31,000 km. Still under extended warranty.'],
  ['bikes', 'Royal Enfield Classic 350 (2021)', 135000, 'good', 'Gunmetal grey, 18,000 km, all papers clear. Crash guard and saddle stays included.'],
  ['bikes', 'Hero Sprint 26T geared cycle', 4500, 'good', '21 gears, front suspension. Ideal for college or office commute.'],
  ['bikes', 'Honda Activa 6G', 62000, 'like_new', 'Only 6,000 km, bought in 2023. Selling because I am relocating.'],
  ['mobiles', 'iPhone 13 128GB, blue', 38000, 'good', 'Battery health 86%. Box, cable and bill available. No scratches on screen.'],
  ['mobiles', 'Samsung Galaxy S23 FE', 31000, 'like_new', '8/256, mint condition with case and tempered glass.'],
  ['electronics', 'MacBook Air M1, 8GB/256GB', 55000, 'good', 'Space grey, 180 battery cycles. Perfect for students and developers.'],
  ['electronics', 'Sony WH-1000XM4 headphones', 14500, 'like_new', 'Noise cancelling, used for 6 months, with case.'],
  ['electronics', 'Dell 27" 4K monitor (S2721QS)', 18000, 'good', 'USB-C not included. Comes with HDMI cable and stand.'],
  ['furniture', '3-seater fabric sofa, grey', 12000, 'good', 'From Urban Ladder, 2 years old. Pet-free and smoke-free home.'],
  ['furniture', 'Solid wood study table with chair', 3500, 'fair', 'Some marks on the top, very sturdy. Pick-up only.'],
  ['furniture', '4-door wardrobe with mirror', 9000, 'good', 'Engineered wood, 6 ft tall. Can be dismantled for transport.'],
  ['furniture', 'Queen size bed with storage', 15000, 'like_new', 'Hydraulic storage, mattress not included.'],
  ['appliances', 'LG 260L double door fridge', 14000, 'good', 'Frost free, 4-star. Works perfectly, selling due to upgrade.'],
  ['appliances', 'IFB 6kg front-load washing machine', 11000, 'good', 'Regularly serviced. Inlet pipe and stand included.'],
  ['appliances', 'Prestige induction cooktop', 1500, 'like_new', 'Used a handful of times. Original box.'],
  ['books', 'UPSC prelims complete book set (Laxmikanth, Spectrum...)', 2000, 'good', '14 books, light highlighting in a few. Great for first attempt.'],
  ['books', 'Harry Potter box set (7 books)', 1800, 'like_new', 'Bloomsbury paperback edition, read once.'],
  ['books', 'Engineering 1st year books (VTU)', 900, 'fair', 'Maths, physics, C programming and mechanics textbooks.'],
  ['books', 'NEET preparation books + modules', 2500, 'good', 'Allen modules for physics, chemistry and biology.'],
  ['fashion', 'Wedding sherwani (size 40), ivory', 6500, 'like_new', 'Worn once for 4 hours. Includes stole and mojaris.'],
  ['fashion', 'Woodland leather boots, size 9', 2200, 'good', 'Genuine leather, resoled recently.'],
  ['tools', 'Bosch GSB 500W impact drill kit', 2800, 'good', 'With 13 drill bits and carry case.'],
  ['tools', 'Aluminium folding ladder, 6 steps', 2400, 'good', 'Lightweight and stable, used at home only.'],
  ['sports', 'SG cricket kit (full, senior)', 5500, 'good', 'Bat, pads, gloves, helmet and kit bag.'],
  ['sports', 'Decathlon treadmill T540', 22000, 'good', 'Foldable, 3HP motor, 12 programs.'],
  ['music', 'Yamaha F310 acoustic guitar', 6000, 'good', 'With gig bag, capo and extra strings.'],
  ['kids', 'Baby stroller (LuvLap Galaxy)', 3800, 'good', 'Reclining seat, canopy, basket. Cleaned and sanitised.'],
  ['pets', 'Large aquarium (3 ft) with filter and lights', 4500, 'good', 'Includes stand, pump and decorations. Fish not included.'],
  ['property', '2BHK flat for rent near Indiranagar metro', 32000, 'good', 'Semi-furnished, 2 bathrooms, covered parking. Family preferred. Price is monthly rent.'],
  ['other', 'Moving sale: kitchen utensils & decor', 1500, 'fair', 'Pressure cooker, pans, plates, curtains and plants. Take everything.'],
];

const NAMES = [
  'Aarav Sharma', 'Ananya Iyer', 'Rohan Mehta', 'Priya Nair', 'Vikram Reddy', 'Sneha Kulkarni', 'Arjun Rao',
  'Kavya Menon', 'Aditya Joshi', 'Isha Patel', 'Karthik Subramanian', 'Meera Pillai', 'Siddharth Gupta',
  'Diya Banerjee', 'Rahul Verma', 'Neha Singh', 'Varun Hegde', 'Pooja Desai', 'Nikhil Chatterjee', 'Riya Kapoor',
  'Manish Agarwal', 'Tanvi Shetty', 'Harsh Malhotra', 'Aditi Bhatt', 'Kunal Saxena', 'Shreya Ghosh',
  'Abhishek Pandey', 'Lakshmi Krishnan', 'Yash Thakur', 'Nandini Rao', 'Gaurav Mishra', 'Divya Srinivasan',
  'Ishaan Khanna', 'Sanya Arora', 'Pranav Kamath', 'Zara Khan',
];

function weightedCity() {
  const total = CITIES.reduce((s, c) => s + c.weight, 0);
  let r = rand() * total;
  for (const c of CITIES) {
    if ((r -= c.weight) <= 0) return c;
  }
  return CITIES[0];
}

/** Scatter a point up to `km` away from a city centre. */
function jitter({ lat, lng }, km) {
  const r = (km * Math.sqrt(rand())) / 111.32;
  const theta = rand() * 2 * Math.PI;
  return {
    latitude: lat + r * Math.cos(theta),
    longitude: lng + (r * Math.sin(theta)) / Math.cos((lat * Math.PI) / 180),
  };
}

const COMPANIES = {
  software: ['Infosys', 'Flipkart', 'Razorpay', 'Swiggy', 'Zoho'],
  doctor: ['Apollo Hospitals', 'Manipal Hospital', 'Fortis Healthcare', 'AIIMS'],
  healthcare: ['Narayana Health', 'Aster CMI', 'Max Healthcare'],
  teacher: ['Delhi Public School', 'Kendriya Vidyalaya', 'Christ University'],
  designer: ['CRED', 'Zomato', 'Ola', 'Freelance'],
  engineer: ['L&T', 'Tata Projects', 'Bosch India'],
  lawyer: ['Cyril Amarchand Mangaldas', 'AZB & Partners', 'Khaitan & Co'],
  finance: ['Deloitte', 'HDFC Bank', 'KPMG India'],
  marketing: ['Nykaa', 'Mamaearth', 'boAt'],
  entrepreneur: ['Own startup', 'Y Combinator', 'Antler India'],
  student: ['Campus internship', 'Research lab'],
  creative: ['Freelance', 'Dharma Productions', 'Studio Kites'],
};
const SCHOOLS = ['IIT Madras', 'BITS Pilani', 'NIT Trichy', 'Christ University', 'Manipal University', 'Anna University'];

const ym = (yearsAgo, month = 6) => `${new Date().getFullYear() - yearsAgo}-${String(month).padStart(2, '0')}`;

function experiencesFor(user, { worker = false } = {}) {
  const years = Math.max(1, user.experienceYears);
  const companies = COMPANIES[user.profession] || ['Self-employed', 'Local contractor', 'Freelance'];
  if (worker) {
    return [
      {
        kind: 'work',
        title: user.roleTitle,
        organization: pick(companies),
        location: user.city,
        startDate: ym(years, 1 + Math.floor(rand() * 12)),
        current: true,
        description: `${years}+ years of hands-on experience. Available across ${user.city}.`,
        userId: user.id,
      },
    ];
  }
  const rows = [
    {
      kind: 'work',
      title: user.roleTitle,
      organization: pick(companies),
      location: user.city,
      startDate: ym(Math.min(years, 3), 1 + Math.floor(rand() * 12)),
      current: true,
      description: `Working as ${user.roleTitle.toLowerCase()} with a focus on quality and collaboration.`,
    },
  ];
  if (years > 3) {
    rows.push({
      kind: 'work',
      title: user.roleTitle.replace(/^Senior /, ''),
      organization: pick(companies),
      location: user.city,
      startDate: ym(years, 1 + Math.floor(rand() * 12)),
      endDate: ym(Math.min(years, 3), 1),
      current: false,
    });
  }
  rows.push({
    kind: 'education',
    title: user.profession === 'doctor' ? 'MBBS' : user.profession === 'student' ? 'Bachelor of Technology' : 'Bachelor’s degree',
    organization: pick(SCHOOLS),
    startDate: ym(years + 4, 7),
    endDate: user.profession === 'student' ? null : ym(years, 5),
    current: user.profession === 'student',
  });
  return rows.map((r) => ({ ...r, userId: user.id }));
}

async function seed() {
  await sequelize.getQueryInterface().dropAllTables();
  await initDb();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const professions = Object.keys(ROLES);
  const rateFor = ([min, max, unit]) => ({
    rateAmount: Math.round((min + rand() * (max - min)) / 10) * 10 || min,
    rateUnit: unit,
  });

  const admin = await User.create({
    name: 'Admin',
    email: 'admin@profilehub.dev',
    passwordHash,
    role: 'admin',
    profession: 'other',
    roleTitle: 'Community Admin',
    headline: 'Keeping ProfileHUB tidy',
    bio: 'Admin account: review profession requests and manage the profession list from the Admin panel.',
    city: 'Bengaluru',
    discoverable: false,
  });

  const demo = await User.create({
    name: 'Demo User',
    email: 'demo@profilehub.dev',
    passwordHash,
    profession: 'software',
    roleTitle: 'Full-stack Developer',
    headline: 'Building delightful products with Vue & Node.js',
    bio: 'This is the demo account. Explore people nearby, send connection requests and chat in real time.',
    skills: ['Vue', 'Node.js', 'Sequelize', 'Socket.IO', 'PostgreSQL'],
    experienceYears: 5,
    city: 'Bengaluru',
    rateAmount: 1500,
    rateUnit: 'hour',
    availableForWork: true,
    ...jitter(CITIES[0], 3),
    shareLocation: true,
    locationUpdatedAt: new Date(),
  });

  const users = [demo];
  for (const [i, name] of NAMES.entries()) {
    const profession = professions[i % professions.length];
    const role = ROLES[profession];
    const place = weightedCity();
    const sharesLocation = rand() > 0.15;
    const title = pick(role.titles);
    const created = await User.create({
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@profilehub.dev`,
      passwordHash,
      profession,
      roleTitle: title,
      headline: `${title} · ${place.city}`,
      bio: `Hi, I'm ${name.split(' ')[0]}. I work as a ${title.toLowerCase()} and love meeting people in the community.`,
      skills: sample(role.skills, 3 + Math.floor(rand() * 3)),
      experienceYears: Math.floor(rand() * 15),
      city: place.city,
      ...(sharesLocation ? { ...jitter(place, 25), shareLocation: true, locationUpdatedAt: new Date() } : {}),
      ...(RATES[profession] && rand() > 0.35 ? rateFor(RATES[profession]) : {}),
      availableForWork: rand() > 0.6,
      showOnlineStatus: rand() > 0.1,
      lastSeenAt: new Date(Date.now() - Math.floor(rand() * 3 * 24 * 3600 * 1000)),
      createdAt: new Date(Date.now() - Math.floor(rand() * 90 * 24 * 3600 * 1000)),
    });
    users.push(created);
  }

  const workers = [];
  for (const [name, profession, title, skills, rate] of WORKERS) {
    const place = rand() > 0.3 ? CITIES[0] : weightedCity();
    const created = await User.create({
      name,
      email: `${name.toLowerCase().normalize('NFKD').replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@profilehub.dev`,
      passwordHash,
      profession,
      roleTitle: title,
      headline: `${title} · ${place.city}`,
      bio: `Namaste! I'm ${name.split(' ')[0]}, a ${title.toLowerCase()} with years of experience. Message me for bookings and quotes.`,
      skills,
      experienceYears: 2 + Math.floor(rand() * 18),
      city: place.city,
      ...jitter(place, 15),
      shareLocation: true,
      locationUpdatedAt: new Date(),
      ...rateFor(rate),
      availableForWork: rand() > 0.2,
      showOnlineStatus: true,
      lastSeenAt: new Date(Date.now() - Math.floor(rand() * 2 * 24 * 3600 * 1000)),
      createdAt: new Date(Date.now() - Math.floor(rand() * 60 * 24 * 3600 * 1000)),
    });
    workers.push(created);
  }
  users.push(...workers);

  // Random accepted connections between seeded members.
  const pairs = new Set();
  const key = (a, b) => [a, b].sort().join(':');
  const others = users.slice(1);
  for (const u of others) {
    for (const v of sample(others, 2 + Math.floor(rand() * 5))) {
      if (u.id === v.id || pairs.has(key(u.id, v.id))) continue;
      pairs.add(key(u.id, v.id));
      await Connection.create({ requesterId: u.id, addresseeId: v.id, status: 'accepted', respondedAt: new Date() });
    }
  }

  // Give the demo account a starting network, incoming invitations and a conversation.
  const [friendA, friendB, friendC, inv1, inv2, inv3] = others;
  for (const f of [friendA, friendB, friendC]) {
    if (pairs.has(key(demo.id, f.id))) continue;
    pairs.add(key(demo.id, f.id));
    await Connection.create({ requesterId: f.id, addresseeId: demo.id, status: 'accepted', respondedAt: new Date() });
  }
  for (const f of [inv1, inv2, inv3]) {
    if (pairs.has(key(demo.id, f.id))) continue;
    pairs.add(key(demo.id, f.id));
    const row = await Connection.create({ requesterId: f.id, addresseeId: demo.id, status: 'pending' });
    await Notification.create({ userId: demo.id, actorId: f.id, type: 'connection_request', entityId: row.id });
  }

  const workerIds = new Set(workers.map((w) => w.id));
  for (const u of users) await Experience.bulkCreate(experiencesFor(u, { worker: workerIds.has(u.id) }));

  // Marketplace: spread listings across members (the demo account sells two things).
  const sellers = [demo, ...others];
  for (const [i, [category, title, price, condition, description]] of LISTINGS.entries()) {
    const seller = i < 2 ? demo : sellers[(i * 7) % sellers.length];
    const sold = i % 11 === 10;
    await Listing.create({
      sellerId: seller.id,
      title,
      description,
      category,
      condition,
      price,
      negotiable: rand() > 0.4,
      city: seller.city,
      ...(seller.hasLocation ? { latitude: seller.latitude, longitude: seller.longitude } : {}),
      images: [],
      status: sold ? 'sold' : 'active',
      soldAt: sold ? new Date() : null,
      viewCount: Math.floor(rand() * 120),
      createdAt: new Date(Date.now() - Math.floor(rand() * 20 * 24 * 3600 * 1000)),
    });
  }

  // A few profession requests waiting for the admin, including one asked for twice.
  const requests = [
    [others[4], 'Drone Pilot', 'transport', 'I fly drones for weddings, surveys and real estate shoots.'],
    [others[9], 'Drone Pilot', 'transport', ''],
    [others[12], 'Tattoo Artist', 'creative', 'Professional tattoo artist with my own studio.'],
    [workers[3], 'Sign Language Interpreter', 'education', 'Indian Sign Language, available for events.'],
  ];
  for (const [user, label, category, note] of requests) {
    const row = await ProfessionRequest.create({ userId: user.id, label, category, note });
    await Notification.create({ userId: admin.id, actorId: user.id, type: 'profession_request', entityId: row.id });
  }

  const now = Date.now();
  const script = [
    [friendA, demo, 'Hey! Saw your profile, are you working with Vue 3 these days?'],
    [demo, friendA, 'Yes! Composition API + Pinia. Loving it so far.'],
    [friendA, demo, 'Nice. Want to grab coffee this week and talk about it?'],
  ];
  for (const [i, [from, to, body]] of script.entries()) {
    await Message.create({
      senderId: from.id,
      receiverId: to.id,
      body,
      createdAt: new Date(now - (script.length - i) * 4 * 60 * 1000),
      readAt: i < script.length - 1 ? new Date() : null,
    });
  }

  console.log(`Seeded ${users.length + 1} users, ${pairs.size} connections and ${LISTINGS.length} listings.`);
  console.log(`Sign in with demo@profilehub.dev / ${PASSWORD} (every seeded account uses the same password).`);
  console.log(`Admin panel: admin@profilehub.dev / ${PASSWORD}`);
  await sequelize.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
