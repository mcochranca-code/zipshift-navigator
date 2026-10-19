export type EmergencyResource = {
  id: string;
  name: string;
  category: "Hotline" | "Medical support" | "Hospital / ER";
  phone: string;
  address: string | null;
  city: string | null;
  countyResource: boolean;
  website: string | null;
  hours: string;
  description: string;
};

// Transcribed from CommunityProviderResourceList_Eng.pdf, NOA Referral List 2026-08 BHRS UM.
export const emergencyResources: EmergencyResource[] = [
  { id: "acs-9883766246", name: "Access, Crisis, and Support (ACS)", category: "Hotline", phone: "888-376-6246", address: "1904 Richland Drive", city: "Ceres, CA 95307", countyResource: true, website: null, hours: "24 hours", description: "Mental health and substance-use crisis response, peer support, and referrals for Stanislaus County residents." },
  { id: "adult-protective-services", name: "Adult Protective Services", category: "Hotline", phone: "800-336-4316 option 4", address: null, city: null, countyResource: true, website: null, hours: "Call for current availability", description: "Protective-services reporting and assistance hotline." },
  { id: "988-lifeline", name: "988 Suicide & Crisis Lifeline", category: "Hotline", phone: "988", address: null, city: null, countyResource: false, website: "https://988lifeline.org", hours: "24 hours", description: "Call, text, or chat with trained crisis counselors for mental-health distress." },
  { id: "california-youth-crisis-line", name: "California Youth Crisis Line", category: "Hotline", phone: "800-843-5200", address: null, city: null, countyResource: false, website: "https://calyouth.org", hours: "24 hours", description: "Confidential crisis support for youth ages 12–24 and adults supporting youth." },
  { id: "child-protective-services", name: "Child Protective Services", category: "Hotline", phone: "800-558-3665 option 1", address: null, city: null, countyResource: true, website: null, hours: "Call for current availability", description: "Child-protection reporting and assistance hotline." },
  { id: "national-runaway-safe-line", name: "National Runaway Safe Line", category: "Hotline", phone: "800-786-2929", address: null, city: null, countyResource: false, website: "https://www.1800runaway.org", hours: "24 hours", description: "Call, chat, email, or text support for runaway, homeless, and at-risk youth." },
  { id: "ombudsman", name: "Ombudsman", category: "Hotline", phone: "209-529-3784", address: null, city: null, countyResource: false, website: null, hours: "Call for current availability", description: "Investigates abuse reports for people living in board-and-care or skilled-nursing facilities." },
  { id: "doctors-medical-center", name: "Doctors Medical Center", category: "Hospital / ER", phone: "209-578-1211", address: "1441 Florida Avenue", city: "Modesto, CA 95350", countyResource: false, website: "https://www.dmc-modesto.com", hours: "Open 24 hours", description: "Acute-care hospital with emergency services." },
  { id: "memorial-medical-center", name: "Memorial Medical Center", category: "Hospital / ER", phone: "209-526-4500", address: "1700 Coffee Road", city: "Modesto, CA 95355", countyResource: false, website: "https://www.sutterhealth.org", hours: "Open 24 hours", description: "Acute-care hospital with emergency services." },
  { id: "oak-valley-hospital", name: "Oak Valley Hospital", category: "Hospital / ER", phone: "209-847-3011", address: "350 S Oak Avenue", city: "Oakdale, CA 95361", countyResource: false, website: null, hours: "Open 24 hours", description: "Acute-care hospital with emergency services." },
  { id: "emanuel-medical-center", name: "Emanuel Medical Center", category: "Hospital / ER", phone: "209-667-4200", address: "825 Delbon Avenue", city: "Turlock, CA 95382", countyResource: false, website: null, hours: "Open 24 hours", description: "Hospital and ER care with emergency services." },
];
