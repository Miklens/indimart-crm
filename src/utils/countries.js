export const COUNTRIES = [
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳', currency: 'INR', symbol: '₹' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸', currency: 'USD', symbol: '$' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪', currency: 'AED', symbol: 'AED' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧', currency: 'GBP', symbol: '£' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦', currency: 'CAD', symbol: '$' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺', currency: 'AUD', symbol: '$' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦', currency: 'SAR', symbol: 'SAR' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬', currency: 'SGD', symbol: '$' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩', currency: 'BDT', symbol: '৳' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰', currency: 'LKR', symbol: 'Rs' },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: '🇳🇵', currency: 'NPR', symbol: 'Rs' },
  { code: 'OM', name: 'Oman', dial: '+968', flag: '🇴🇲', currency: 'OMR', symbol: 'OMR' },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦', currency: 'QAR', symbol: 'QAR' },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼', currency: 'KWD', symbol: 'KWD' },
  { code: 'BH', name: 'Bahrain', dial: '+973', flag: '🇧🇭', currency: 'BHD', symbol: 'BHD' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾', currency: 'MYR', symbol: 'RM' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪', currency: 'KES', symbol: 'KSh' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦', currency: 'ZAR', symbol: 'R' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬', currency: 'NGN', symbol: '₦' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪', currency: 'EUR', symbol: '€' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', currency: 'EUR', symbol: '€' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹', currency: 'EUR', symbol: '€' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸', currency: 'EUR', symbol: '€' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱', currency: 'EUR', symbol: '€' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭', currency: 'CHF', symbol: 'CHF' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵', currency: 'JPY', symbol: '¥' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳', currency: 'CNY', symbol: '¥' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳', currency: 'VND', symbol: '₫' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩', currency: 'IDR', symbol: 'Rp' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭', currency: 'PHP', symbol: '₱' },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭', currency: 'THB', symbol: '฿' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬', currency: 'EGP', symbol: 'EGP' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷', currency: 'TRY', symbol: '₺' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷', currency: 'BRL', symbol: 'R$' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽', currency: 'MXN', symbol: '$' },
  { code: 'MU', name: 'Mauritius', dial: '+230', flag: '🇲🇺', currency: 'MUR', symbol: 'Rs' },
  { code: 'TZ', name: 'Tanzania', dial: '+255', flag: '🇹🇿', currency: 'TZS', symbol: 'TSh' },
  { code: 'UG', name: 'Uganda', dial: '+256', flag: '🇺🇬', currency: 'UGX', symbol: 'USh' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭', currency: 'GHS', symbol: 'GH₵' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺', currency: 'RUB', symbol: '₽' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿', currency: 'NZD', symbol: '$' },
];

export const COUNTRY_MAP = COUNTRIES.reduce((acc, c) => {
  acc[c.code] = c;
  acc[c.name.toLowerCase()] = c;
  return acc;
}, {});

/**
 * Detect country from location text (City, State, Country) or phone number
 */
export function detectCountry(locationStr = '', phoneStr = '') {
  const loc = String(locationStr || '').toLowerCase();
  const phone = String(phoneStr || '').trim();

  // Check phone country codes first if phone has international prefix
  if (phone.startsWith('+')) {
    for (const c of COUNTRIES) {
      if (phone.startsWith(c.dial)) return c;
    }
  }

  // Check location keywords
  const aliases = {
    'uae': 'AE',
    'dubai': 'AE',
    'abu dhabi': 'AE',
    'sharjah': 'AE',
    'united arab emirates': 'AE',
    'usa': 'US',
    'united states': 'US',
    'america': 'US',
    'uk': 'GB',
    'united kingdom': 'GB',
    'london': 'GB',
    'england': 'GB',
    'canada': 'CA',
    'australia': 'AU',
    'saudi arabia': 'SA',
    'riyadh': 'SA',
    'jeddah': 'SA',
    'dammam': 'SA',
    'singapore': 'SG',
    'bangladesh': 'BD',
    'dhaka': 'BD',
    'chittagong': 'BD',
    'sri lanka': 'LK',
    'colombo': 'LK',
    'nepal': 'NP',
    'kathmandu': 'NP',
    'oman': 'OM',
    'muscat': 'OM',
    'qatar': 'QA',
    'doha': 'QA',
    'kuwait': 'KW',
    'bahrain': 'BH',
    'malaysia': 'MY',
    'kuala lumpur': 'MY',
    'kenya': 'KE',
    'nairobi': 'KE',
    'mombasa': 'KE',
    'south africa': 'ZA',
    'johannesburg': 'ZA',
    'cape town': 'ZA',
    'durban': 'ZA',
    'nigeria': 'NG',
    'lagos': 'NG',
    'germany': 'DE',
    'france': 'FR',
    'italy': 'IT',
    'spain': 'ES',
    'japan': 'JP',
    'china': 'CN',
    'vietnam': 'VN',
    'indonesia': 'ID',
    'philippines': 'PH',
    'thailand': 'TH',
    'bangkok': 'TH',
    'egypt': 'EG',
    'cairo': 'EG',
    'turkey': 'TR',
    'istanbul': 'TR',
    'brazil': 'BR',
    'mauritius': 'MU',
    'tanzania': 'TZ',
    'uganda': 'UG',
    'ghana': 'GH',
    'russia': 'RU',
    'new zealand': 'NZ',
  };

  for (const [key, code] of Object.entries(aliases)) {
    if (loc.includes(key)) {
      return COUNTRY_MAP[code] || COUNTRIES[0];
    }
  }

  // Fallback to India as primary
  return COUNTRIES[0];
}

/**
 * Format international or domestic WhatsApp URL
 */
export function getWhatsAppLink(contact, message = '') {
  if (!contact) return '';
  const raw = String(contact).trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  let fullNumber = digits;
  if (raw.startsWith('+')) {
    fullNumber = digits;
  } else if (raw.startsWith('00')) {
    fullNumber = digits.replace(/^00/, '');
  } else if (digits.length === 10) {
    fullNumber = '91' + digits; // Default Indian number
  } else if (digits.length === 12 && digits.startsWith('91')) {
    fullNumber = digits;
  }

  const encodedMsg = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${fullNumber}${encodedMsg}`;
}

/**
 * Smart location parser separating City, State, and Country
 */
export function parseLocation(rawCity = '', rawState = '', rawCountry = '') {
  const ctry = rawCountry ? (COUNTRY_MAP[rawCountry.toLowerCase()] || COUNTRY_MAP[rawCountry] || null) : null;
  const detected = ctry || detectCountry(`${rawCity} ${rawState}`);

  let cleanCity = (rawCity || '').trim();
  if (cleanCity.includes(',')) {
    const parts = cleanCity.split(',').map(p => p.trim()).filter(Boolean);
    const filtered = parts.filter(p => {
      const l = p.toLowerCase();
      return l !== 'india' && !/^\d{6}$/.test(l) && !l.startsWith('india -') && !/^\d+$/.test(l) && l !== detected.name.toLowerCase();
    });
    cleanCity = filtered[0] || parts[0] || 'Direct';
  }

  return {
    city: cleanCity || 'Direct',
    state: rawState || '',
    country: detected.name,
    countryCode: detected.code,
    flag: detected.flag,
    isInternational: detected.code !== 'IN',
  };
}
