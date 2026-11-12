export interface District {
  id: string;
  si: string;
  en: string;
}

export const DISTRICTS: readonly District[] = [
  { id: 'colombo', si: 'කොළඹ', en: 'Colombo' },
  { id: 'gampaha', si: 'ගම්පහ', en: 'Gampaha' },
  { id: 'kalutara', si: 'කළුතර', en: 'Kalutara' },
  { id: 'kandy', si: 'මහනුවර', en: 'Kandy' },
  { id: 'matale', si: 'මාතලේ', en: 'Matale' },
  { id: 'nuwara-eliya', si: 'නුවරඑළිය', en: 'Nuwara Eliya' },
  { id: 'galle', si: 'ගාල්ල', en: 'Galle' },
  { id: 'matara', si: 'මාතර', en: 'Matara' },
  { id: 'hambantota', si: 'හම්බන්තොට', en: 'Hambantota' },
  { id: 'jaffna', si: 'යාපනය', en: 'Jaffna' },
  { id: 'kilinochchi', si: 'කිලිනොච්චි', en: 'Kilinochchi' },
  { id: 'mannar', si: 'මන්නාරම', en: 'Mannar' },
  { id: 'vavuniya', si: 'වවුනියාව', en: 'Vavuniya' },
  { id: 'mullaitivu', si: 'මුලතිව්', en: 'Mullaitivu' },
  { id: 'batticaloa', si: 'මඩකලපුව', en: 'Batticaloa' },
  { id: 'ampara', si: 'අම්පාර', en: 'Ampara' },
  { id: 'trincomalee', si: 'ත්‍රිකුණාමලය', en: 'Trincomalee' },
  { id: 'kurunegala', si: 'කුරුණෑගල', en: 'Kurunegala' },
  { id: 'puttalam', si: 'පුත්තලම', en: 'Puttalam' },
  { id: 'anuradhapura', si: 'අනුරාධපුරය', en: 'Anuradhapura' },
  { id: 'polonnaruwa', si: 'පොළොන්නරුව', en: 'Polonnaruwa' },
  { id: 'badulla', si: 'බදුල්ල', en: 'Badulla' },
  { id: 'monaragala', si: 'මොණරාගල', en: 'Monaragala' },
  { id: 'ratnapura', si: 'රත්නපුර', en: 'Ratnapura' },
  { id: 'kegalle', si: 'කෑගල්ල', en: 'Kegalle' },
];

export const DISTRICT_IDS = DISTRICTS.map((d) => d.id);

export function isDistrictId(id: string): boolean {
  return DISTRICT_IDS.includes(id);
}

export function districtName(id: string, lang: 'si' | 'en'): string {
  return DISTRICTS.find((d) => d.id === id)?.[lang] ?? id;
}
