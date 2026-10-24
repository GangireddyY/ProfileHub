import bcrypt from 'bcryptjs';
import { initDb, sequelize, User, Connection, Message } from './models/index.js';

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

async function seed() {
  await initDb({ force: true });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const professions = Object.keys(ROLES);

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
      showOnlineStatus: rand() > 0.1,
      lastSeenAt: new Date(Date.now() - Math.floor(rand() * 3 * 24 * 3600 * 1000)),
      createdAt: new Date(Date.now() - Math.floor(rand() * 90 * 24 * 3600 * 1000)),
    });
    users.push(created);
  }

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
    await Connection.create({ requesterId: f.id, addresseeId: demo.id, status: 'pending' });
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

  console.log(`Seeded ${users.length} users and ${pairs.size} connections.`);
  console.log(`Sign in with demo@profilehub.dev / ${PASSWORD} (every seeded account uses the same password).`);
  await sequelize.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
