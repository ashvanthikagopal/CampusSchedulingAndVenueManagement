// Auto-generated comprehensive accounts directory for CIT Campus Scheduling Platform
// Contains all 62 official accounts across 4 roles from cit_public.json dataset

export interface AccountItem {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'department_coordinator' | 'faculty' | 'club';
  department?: string;
  faculty_id?: string;
  club_name?: string;
  identifier: string;
  password: string;
  rule_password: string;
}

export type RoleCategoryKey = 'admin' | 'coordinator' | 'faculty' | 'club';

export const ROLE_RULES: Record<RoleCategoryKey, {
  key: RoleCategoryKey;
  label: string;
  badge: string;
  color: string;
  bg: string;
  border: string;
  identFormat: string;
  passFormat: string;
  description: string;
}> = {
  admin: {
    key: 'admin',
    label: "Admin (Dean's Office)",
    badge: 'Admin',
    color: '#6f8fb8',
    bg: 'rgba(111, 143, 184, 0.12)',
    border: 'rgba(111, 143, 184, 0.3)',
    identFormat: "admin@cit.edu or 'admin'",
    passFormat: 'Admin@123',
    description: 'Generates timetable, approves disruptions, manages global venue allocation rules.'
  },
  coordinator: {
    key: 'coordinator',
    label: 'Department Coordinator',
    badge: 'Coordinator',
    color: '#5fa8a0',
    bg: 'rgba(95, 168, 160, 0.12)',
    border: 'rgba(95, 168, 160, 0.3)',
    identFormat: 'Dept code (e.g. CSE, ECE, ME) or coord_<dept>@cit.edu',
    passFormat: 'Coord@123 or Coord@<DEPT>123 (e.g. Coord@CSE123)',
    description: 'Requests department session moves, books department events and manages lab allocations.'
  },
  faculty: {
    key: 'faculty',
    label: 'Faculty Member',
    badge: 'Faculty',
    color: '#c9a96b',
    bg: 'rgba(201, 169, 107, 0.12)',
    border: 'rgba(201, 169, 107, 0.3)',
    identFormat: 'Faculty ID (F01–F40) or faculty_<id>@cit.edu',
    passFormat: 'Faculty@123 or <ID>@123 (e.g. F06@123)',
    description: 'Views teaching timetable, marks unavailability, and requests class reschedules.'
  },
  club: {
    key: 'club',
    label: 'Club Representative',
    badge: 'Club Rep',
    color: '#c27d5e',
    bg: 'rgba(194, 125, 94, 0.12)',
    border: 'rgba(194, 125, 94, 0.3)',
    identFormat: 'Club Name or Slug (e.g. dance, coding) or club_<slug>@cit.edu',
    passFormat: 'Club@123 or Club@<Slug>123 (e.g. Club@Dance123)',
    description: 'Submits fest & weekend venue bookings, views allocation decisions and reasons.'
  }
};

export const ACCOUNTS_DATA: {
  admin: AccountItem[];
  coordinator: AccountItem[];
  faculty: AccountItem[];
  club: AccountItem[];
} = {
  "admin": [
    {
      "id": "usr_admin",
      "name": "Dean's Office",
      "email": "admin@cit.edu",
      "department": "Administration",
      "role": "admin",
      "password": "Admin@123",
      "rule_password": "Admin@123",
      "identifier": "admin"
    },
    {
      "id": "usr_admin2",
      "name": "Spectra Core Team",
      "email": "admin2@cit.edu",
      "department": "Administration",
      "role": "admin",
      "password": "Admin@123",
      "rule_password": "Admin@123",
      "identifier": "admin2"
    }
  ],
  "coordinator": [
    {
      "id": "usr_coord_ce",
      "name": "CE Department Coordinator",
      "email": "coord_ce@cit.edu",
      "department": "CE",
      "role": "department_coordinator",
      "password": "Coord@123",
      "rule_password": "Coord@CE123",
      "identifier": "CE"
    },
    {
      "id": "usr_coord_cse",
      "name": "CSE Department Coordinator",
      "email": "coord_cse@cit.edu",
      "department": "CSE",
      "role": "department_coordinator",
      "password": "Coord@123",
      "rule_password": "Coord@CSE123",
      "identifier": "CSE"
    },
    {
      "id": "usr_coord_tnp",
      "name": "Training & Placement Cell",
      "email": "coord_tnp@cit.edu",
      "department": "CSE",
      "role": "department_coordinator",
      "password": "Coord@123",
      "rule_password": "Coord@CSE123",
      "identifier": "CSE"
    },
    {
      "id": "usr_coord_ece",
      "name": "ECE Department Coordinator",
      "email": "coord_ece@cit.edu",
      "department": "ECE",
      "role": "department_coordinator",
      "password": "Coord@123",
      "rule_password": "Coord@ECE123",
      "identifier": "ECE"
    },
    {
      "id": "usr_coord_ee",
      "name": "EE Department Coordinator",
      "email": "coord_ee@cit.edu",
      "department": "EE",
      "role": "department_coordinator",
      "password": "Coord@123",
      "rule_password": "Coord@EE123",
      "identifier": "EE"
    },
    {
      "id": "usr_coord_hss",
      "name": "HSS Department Coordinator",
      "email": "coord_hss@cit.edu",
      "department": "HSS",
      "role": "department_coordinator",
      "password": "Coord@123",
      "rule_password": "Coord@HSS123",
      "identifier": "HSS"
    },
    {
      "id": "usr_coord_ma",
      "name": "MA Department Coordinator",
      "email": "coord_ma@cit.edu",
      "department": "MA",
      "role": "department_coordinator",
      "password": "Coord@123",
      "rule_password": "Coord@MA123",
      "identifier": "MA"
    },
    {
      "id": "usr_coord_me",
      "name": "ME Department Coordinator",
      "email": "coord_me@cit.edu",
      "department": "ME",
      "role": "department_coordinator",
      "password": "Coord@123",
      "rule_password": "Coord@ME123",
      "identifier": "ME"
    },
    {
      "id": "usr_coord_ph",
      "name": "PH Department Coordinator",
      "email": "coord_ph@cit.edu",
      "department": "PH",
      "role": "department_coordinator",
      "password": "Coord@123",
      "rule_password": "Coord@PH123",
      "identifier": "PH"
    }
  ],
  "faculty": [
    {
      "id": "usr_fac_f01",
      "name": "Dr. Ananya Mishra",
      "email": "faculty_f01@cit.edu",
      "faculty_id": "F01",
      "department": "CSE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F01@123",
      "identifier": "F01"
    },
    {
      "id": "usr_fac_f02",
      "name": "Dr. Rohit Sahoo",
      "email": "faculty_f02@cit.edu",
      "faculty_id": "F02",
      "department": "CSE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F02@123",
      "identifier": "F02"
    },
    {
      "id": "usr_fac_f03",
      "name": "Dr. Kavya Iyer",
      "email": "faculty_f03@cit.edu",
      "faculty_id": "F03",
      "department": "CSE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F03@123",
      "identifier": "F03"
    },
    {
      "id": "usr_fac_f04",
      "name": "Dr. Sandeep Patnaik",
      "email": "faculty_f04@cit.edu",
      "faculty_id": "F04",
      "department": "CSE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F04@123",
      "identifier": "F04"
    },
    {
      "id": "usr_fac_f05",
      "name": "Dr. Meera Nair",
      "email": "faculty_f05@cit.edu",
      "faculty_id": "F05",
      "department": "CSE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F05@123",
      "identifier": "F05"
    },
    {
      "id": "usr_fac_f06",
      "name": "Dr. Arjun Mehta",
      "email": "faculty_f06@cit.edu",
      "faculty_id": "F06",
      "department": "CSE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F06@123",
      "identifier": "F06"
    },
    {
      "id": "usr_fac_f07",
      "name": "Dr. Pooja Das",
      "email": "faculty_f07@cit.edu",
      "faculty_id": "F07",
      "department": "CSE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F07@123",
      "identifier": "F07"
    },
    {
      "id": "usr_fac_f08",
      "name": "Prof. Vikram Rao (Visiting)",
      "email": "faculty_f08@cit.edu",
      "faculty_id": "F08",
      "department": "CSE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F08@123",
      "identifier": "F08"
    },
    {
      "id": "usr_fac_f09",
      "name": "Dr. Ishita Banerjee",
      "email": "faculty_f09@cit.edu",
      "faculty_id": "F09",
      "department": "ECE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F09@123",
      "identifier": "F09"
    },
    {
      "id": "usr_fac_f10",
      "name": "Dr. Suresh Pradhan",
      "email": "faculty_f10@cit.edu",
      "faculty_id": "F10",
      "department": "ECE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F10@123",
      "identifier": "F10"
    },
    {
      "id": "usr_fac_f11",
      "name": "Dr. Neha Kulkarni",
      "email": "faculty_f11@cit.edu",
      "faculty_id": "F11",
      "department": "ECE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F11@123",
      "identifier": "F11"
    },
    {
      "id": "usr_fac_f12",
      "name": "Dr. Amit Behera",
      "email": "faculty_f12@cit.edu",
      "faculty_id": "F12",
      "department": "ECE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F12@123",
      "identifier": "F12"
    },
    {
      "id": "usr_fac_f13",
      "name": "Dr. Ritu Sharma",
      "email": "faculty_f13@cit.edu",
      "faculty_id": "F13",
      "department": "ECE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F13@123",
      "identifier": "F13"
    },
    {
      "id": "usr_fac_f14",
      "name": "Dr. Kunal Joshi",
      "email": "faculty_f14@cit.edu",
      "faculty_id": "F14",
      "department": "EE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F14@123",
      "identifier": "F14"
    },
    {
      "id": "usr_fac_f15",
      "name": "Dr. Sneha Mohanty",
      "email": "faculty_f15@cit.edu",
      "faculty_id": "F15",
      "department": "EE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F15@123",
      "identifier": "F15"
    },
    {
      "id": "usr_fac_f16",
      "name": "Dr. Rakesh Panda",
      "email": "faculty_f16@cit.edu",
      "faculty_id": "F16",
      "department": "EE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F16@123",
      "identifier": "F16"
    },
    {
      "id": "usr_fac_f17",
      "name": "Dr. Divya Menon",
      "email": "faculty_f17@cit.edu",
      "faculty_id": "F17",
      "department": "EE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F17@123",
      "identifier": "F17"
    },
    {
      "id": "usr_fac_f18",
      "name": "Dr. Manoj Tripathy",
      "email": "faculty_f18@cit.edu",
      "faculty_id": "F18",
      "department": "EE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F18@123",
      "identifier": "F18"
    },
    {
      "id": "usr_fac_f19",
      "name": "Dr. Shalini Gupta",
      "email": "faculty_f19@cit.edu",
      "faculty_id": "F19",
      "department": "MA",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F19@123",
      "identifier": "F19"
    },
    {
      "id": "usr_fac_f20",
      "name": "Dr. Prakash Nayak",
      "email": "faculty_f20@cit.edu",
      "faculty_id": "F20",
      "department": "MA",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F20@123",
      "identifier": "F20"
    },
    {
      "id": "usr_fac_f21",
      "name": "Dr. Lakshmi Reddy",
      "email": "faculty_f21@cit.edu",
      "faculty_id": "F21",
      "department": "PH",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F21@123",
      "identifier": "F21"
    },
    {
      "id": "usr_fac_f22",
      "name": "Dr. Harish Dash",
      "email": "faculty_f22@cit.edu",
      "faculty_id": "F22",
      "department": "PH",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F22@123",
      "identifier": "F22"
    },
    {
      "id": "usr_fac_f23",
      "name": "Dr. Farah Khan",
      "email": "faculty_f23@cit.edu",
      "faculty_id": "F23",
      "department": "PH",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F23@123",
      "identifier": "F23"
    },
    {
      "id": "usr_fac_f24",
      "name": "Dr. Gaurav Jena",
      "email": "faculty_f24@cit.edu",
      "faculty_id": "F24",
      "department": "PH",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F24@123",
      "identifier": "F24"
    },
    {
      "id": "usr_fac_f25",
      "name": "Dr. Tanvi Desai",
      "email": "faculty_f25@cit.edu",
      "faculty_id": "F25",
      "department": "ME",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F25@123",
      "identifier": "F25"
    },
    {
      "id": "usr_fac_f26",
      "name": "Dr. Abhishek Rout",
      "email": "faculty_f26@cit.edu",
      "faculty_id": "F26",
      "department": "ME",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F26@123",
      "identifier": "F26"
    },
    {
      "id": "usr_fac_f27",
      "name": "Dr. Sunita Bose",
      "email": "faculty_f27@cit.edu",
      "faculty_id": "F27",
      "department": "ME",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F27@123",
      "identifier": "F27"
    },
    {
      "id": "usr_fac_f28",
      "name": "Dr. Nikhil Swain",
      "email": "faculty_f28@cit.edu",
      "faculty_id": "F28",
      "department": "ME",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F28@123",
      "identifier": "F28"
    },
    {
      "id": "usr_fac_f29",
      "name": "Dr. Priya Raman",
      "email": "faculty_f29@cit.edu",
      "faculty_id": "F29",
      "department": "ME",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F29@123",
      "identifier": "F29"
    },
    {
      "id": "usr_fac_f30",
      "name": "Dr. Debashish Sethi",
      "email": "faculty_f30@cit.edu",
      "faculty_id": "F30",
      "department": "ME",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F30@123",
      "identifier": "F30"
    },
    {
      "id": "usr_fac_f31",
      "name": "Dr. Anjali Verma",
      "email": "faculty_f31@cit.edu",
      "faculty_id": "F31",
      "department": "CE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F31@123",
      "identifier": "F31"
    },
    {
      "id": "usr_fac_f32",
      "name": "Dr. Sameer Khuntia",
      "email": "faculty_f32@cit.edu",
      "faculty_id": "F32",
      "department": "CE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F32@123",
      "identifier": "F32"
    },
    {
      "id": "usr_fac_f33",
      "name": "Dr. Rekha Pillai",
      "email": "faculty_f33@cit.edu",
      "faculty_id": "F33",
      "department": "CE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F33@123",
      "identifier": "F33"
    },
    {
      "id": "usr_fac_f34",
      "name": "Dr. Varun Acharya",
      "email": "faculty_f34@cit.edu",
      "faculty_id": "F34",
      "department": "CE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F34@123",
      "identifier": "F34"
    },
    {
      "id": "usr_fac_f35",
      "name": "Dr. Bhavna Saxena",
      "email": "faculty_f35@cit.edu",
      "faculty_id": "F35",
      "department": "CE",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F35@123",
      "identifier": "F35"
    },
    {
      "id": "usr_fac_f36",
      "name": "Dr. Ashok Mahapatra",
      "email": "faculty_f36@cit.edu",
      "faculty_id": "F36",
      "department": "HSS",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F36@123",
      "identifier": "F36"
    },
    {
      "id": "usr_fac_f37",
      "name": "Prof. Shreya Kapoor (Dean)",
      "email": "faculty_f37@cit.edu",
      "faculty_id": "F37",
      "department": "ADMIN",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F37@123",
      "identifier": "F37"
    },
    {
      "id": "usr_fac_f38",
      "name": "Dr. Imran Qureshi",
      "email": "faculty_f38@cit.edu",
      "faculty_id": "F38",
      "department": "HSS",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F38@123",
      "identifier": "F38"
    },
    {
      "id": "usr_fac_f39",
      "name": "Dr. Radhika Hegde",
      "email": "faculty_f39@cit.edu",
      "faculty_id": "F39",
      "department": "HSS",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F39@123",
      "identifier": "F39"
    },
    {
      "id": "usr_fac_f40",
      "name": "Dr. Om Prakash Sahu",
      "email": "faculty_f40@cit.edu",
      "faculty_id": "F40",
      "department": "HSS",
      "role": "faculty",
      "password": "Faculty@123",
      "rule_password": "F40@123",
      "identifier": "F40"
    }
  ],
  "club": [
    {
      "id": "usr_club_astronomy",
      "name": "Astronomy Club",
      "email": "club_astronomy@cit.edu",
      "club_name": "Astronomy Club",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Astronomy123",
      "identifier": "astronomy"
    },
    {
      "id": "usr_club_coding",
      "name": "Coding Club",
      "email": "club_coding@cit.edu",
      "club_name": "Coding Club",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Coding123",
      "identifier": "coding"
    },
    {
      "id": "usr_club_dance",
      "name": "Dance Club",
      "email": "club_dance@cit.edu",
      "club_name": "Dance Club",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Dance123",
      "identifier": "dance"
    },
    {
      "id": "usr_club_dramatics",
      "name": "Dramatics Society",
      "email": "club_dramatics@cit.edu",
      "club_name": "Dramatics Society",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Dramatics123",
      "identifier": "dramatics"
    },
    {
      "id": "usr_club_ecell",
      "name": "E-Cell",
      "email": "club_ecell@cit.edu",
      "club_name": "E-Cell",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Ecell123",
      "identifier": "ecell"
    },
    {
      "id": "usr_club_gaming",
      "name": "Gaming Society",
      "email": "club_gaming@cit.edu",
      "club_name": "Gaming Society",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Gaming123",
      "identifier": "gaming"
    },
    {
      "id": "usr_club_literary",
      "name": "Literary Society",
      "email": "club_literary@cit.edu",
      "club_name": "Literary Society",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Literary123",
      "identifier": "literary"
    },
    {
      "id": "usr_club_music",
      "name": "Music Club",
      "email": "club_music@cit.edu",
      "club_name": "Music Club",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Music123",
      "identifier": "music"
    },
    {
      "id": "usr_club_photography",
      "name": "Photography Club",
      "email": "club_photography@cit.edu",
      "club_name": "Photography Club",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Photography123",
      "identifier": "photography"
    },
    {
      "id": "usr_club_quiz",
      "name": "Quiz Club",
      "email": "club_quiz@cit.edu",
      "club_name": "Quiz Club",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Quiz123",
      "identifier": "quiz"
    },
    {
      "id": "usr_club_robotics",
      "name": "Robotics Club",
      "email": "club_robotics@cit.edu",
      "club_name": "Robotics Club",
      "role": "club",
      "password": "Club@123",
      "rule_password": "Club@Robotics123",
      "identifier": "robotics"
    }
  ]
};

export const ALL_ACCOUNTS: AccountItem[] = [
  ...ACCOUNTS_DATA.admin,
  ...ACCOUNTS_DATA.coordinator,
  ...ACCOUNTS_DATA.faculty,
  ...ACCOUNTS_DATA.club
];

export function findMatchingAccount(query: string): AccountItem | undefined {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  return ALL_ACCOUNTS.find(a => 
    a.identifier.toLowerCase() === q ||
    a.email.toLowerCase() === q ||
    (a.faculty_id && a.faculty_id.toLowerCase() === q) ||
    (a.department && a.department.toLowerCase() === q) ||
    (a.club_name && a.club_name.toLowerCase() === q) ||
    a.name.toLowerCase() === q
  );
}

