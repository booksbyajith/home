export interface District {
  id: string;
  si: string;
  en: string;
  ta: string;
}

export const DISTRICTS: readonly District[] = [
  { id: 'colombo', si: 'කොළඹ', en: 'Colombo', ta: 'கொழும்பு' },
  { id: 'gampaha', si: 'ගම්පහ', en: 'Gampaha', ta: 'கம்பஹா' },
  { id: 'kalutara', si: 'කළුතර', en: 'Kalutara', ta: 'களுத்துறை' },
  { id: 'kandy', si: 'මහනුවර', en: 'Kandy', ta: 'கண்டி' },
  { id: 'matale', si: 'මාතලේ', en: 'Matale', ta: 'மாத்தளை' },
  { id: 'nuwara-eliya', si: 'නුවරඑළිය', en: 'Nuwara Eliya', ta: 'நுவரெலியா' },
  { id: 'galle', si: 'ගාල්ල', en: 'Galle', ta: 'காலி' },
  { id: 'matara', si: 'මාතර', en: 'Matara', ta: 'மாத்தறை' },
  { id: 'hambantota', si: 'හම්බන්තොට', en: 'Hambantota', ta: 'அம்பாந்தோட்டை' },
  { id: 'jaffna', si: 'යාපනය', en: 'Jaffna', ta: 'யாழ்ப்பாணம்' },
  { id: 'kilinochchi', si: 'කිලිනොච්චි', en: 'Kilinochchi', ta: 'கிளிநொச்சி' },
  { id: 'mannar', si: 'මන්නාරම', en: 'Mannar', ta: 'மன்னார்' },
  { id: 'vavuniya', si: 'වවුනියාව', en: 'Vavuniya', ta: 'வவுனியா' },
  { id: 'mullaitivu', si: 'මුලතිව්', en: 'Mullaitivu', ta: 'முல்லைத்தீவு' },
  { id: 'batticaloa', si: 'මඩකලපුව', en: 'Batticaloa', ta: 'மட்டக்களப்பு' },
  { id: 'ampara', si: 'අම්පාර', en: 'Ampara', ta: 'அம்பாறை' },
  { id: 'trincomalee', si: 'ත්‍රිකුණාමලය', en: 'Trincomalee', ta: 'திருகோணமலை' },
  { id: 'kurunegala', si: 'කුරුණෑගල', en: 'Kurunegala', ta: 'குருநாகல்' },
  { id: 'puttalam', si: 'පුත්තලම', en: 'Puttalam', ta: 'புத்தளம்' },
  { id: 'anuradhapura', si: 'අනුරාධපුරය', en: 'Anuradhapura', ta: 'அநுராதபுரம்' },
  { id: 'polonnaruwa', si: 'පොළොන්නරුව', en: 'Polonnaruwa', ta: 'பொலன்னறுவை' },
  { id: 'badulla', si: 'බදුල්ල', en: 'Badulla', ta: 'பதுளை' },
  { id: 'monaragala', si: 'මොණරාගල', en: 'Monaragala', ta: 'மொனராகலை' },
  { id: 'ratnapura', si: 'රත්නපුර', en: 'Ratnapura', ta: 'இரத்தினபுரி' },
  { id: 'kegalle', si: 'කෑගල්ල', en: 'Kegalle', ta: 'கேகாலை' },
];

export const DISTRICT_IDS = DISTRICTS.map((d) => d.id);

export function isDistrictId(id: string): boolean {
  return DISTRICT_IDS.includes(id);
}

export function districtName(id: string, lang: 'si' | 'en' | 'ta'): string {
  return DISTRICTS.find((d) => d.id === id)?.[lang] ?? id;
}
