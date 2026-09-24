/**
 * Countries the address book, checkout and shipping regions understand — PURE, importable
 * from client and server. Names are hardcoded (not Intl.DisplayNames) so the server render
 * and the browser always agree.
 *
 * US territories (PR, VI, GU, AS, MP) are entered as United States + their two-letter state
 * code, so they ship domestically; they are not separate entries here.
 *
 * RESTRICTED destinations are refused everywhere (address book, checkout, region pricing):
 * comprehensively sanctioned countries plus Russia and Belarus, where US export rules bar
 * luxury goods. Keep this list in sync with the Terms (sanctioned destinations are off).
 */

export const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AD: 'Andorra', AO: 'Angola', AI: 'Anguilla',
  AG: 'Antigua and Barbuda', AR: 'Argentina', AM: 'Armenia', AW: 'Aruba', AU: 'Australia',
  AT: 'Austria', AZ: 'Azerbaijan', BS: 'Bahamas', BH: 'Bahrain', BD: 'Bangladesh', BB: 'Barbados',
  BE: 'Belgium', BZ: 'Belize', BJ: 'Benin', BM: 'Bermuda', BT: 'Bhutan', BO: 'Bolivia',
  BA: 'Bosnia and Herzegovina', BW: 'Botswana', BR: 'Brazil', VG: 'British Virgin Islands',
  BN: 'Brunei', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi', KH: 'Cambodia', CM: 'Cameroon',
  CA: 'Canada', CV: 'Cape Verde', KY: 'Cayman Islands', CF: 'Central African Republic', TD: 'Chad',
  CL: 'Chile', CN: 'China', CO: 'Colombia', KM: 'Comoros', CG: 'Congo', CD: 'Congo (DRC)',
  CK: 'Cook Islands', CR: 'Costa Rica', CI: 'Côte d’Ivoire', HR: 'Croatia', CW: 'Curaçao',
  CY: 'Cyprus', CZ: 'Czechia', DK: 'Denmark', DJ: 'Djibouti', DM: 'Dominica',
  DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt', SV: 'El Salvador', GQ: 'Equatorial Guinea',
  ER: 'Eritrea', EE: 'Estonia', SZ: 'Eswatini', ET: 'Ethiopia', FK: 'Falkland Islands',
  FO: 'Faroe Islands', FJ: 'Fiji', FI: 'Finland', FR: 'France', GF: 'French Guiana',
  PF: 'French Polynesia', GA: 'Gabon', GM: 'Gambia', GE: 'Georgia', DE: 'Germany', GH: 'Ghana',
  GI: 'Gibraltar', GR: 'Greece', GL: 'Greenland', GD: 'Grenada', GP: 'Guadeloupe', GT: 'Guatemala',
  GG: 'Guernsey', GN: 'Guinea', GW: 'Guinea-Bissau', GY: 'Guyana', HT: 'Haiti', HN: 'Honduras',
  HK: 'Hong Kong', HU: 'Hungary', IS: 'Iceland', IN: 'India', ID: 'Indonesia', IQ: 'Iraq',
  IE: 'Ireland', IM: 'Isle of Man', IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan',
  JE: 'Jersey', JO: 'Jordan', KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati', XK: 'Kosovo',
  KW: 'Kuwait', KG: 'Kyrgyzstan', LA: 'Laos', LV: 'Latvia', LB: 'Lebanon', LS: 'Lesotho',
  LR: 'Liberia', LY: 'Libya', LI: 'Liechtenstein', LT: 'Lithuania', LU: 'Luxembourg', MO: 'Macao',
  MG: 'Madagascar', MW: 'Malawi', MY: 'Malaysia', MV: 'Maldives', ML: 'Mali', MT: 'Malta',
  MH: 'Marshall Islands', MQ: 'Martinique', MR: 'Mauritania', MU: 'Mauritius', YT: 'Mayotte',
  MX: 'Mexico', FM: 'Micronesia', MD: 'Moldova', MC: 'Monaco', MN: 'Mongolia', ME: 'Montenegro',
  MS: 'Montserrat', MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru',
  NP: 'Nepal', NL: 'Netherlands', NC: 'New Caledonia', NZ: 'New Zealand', NI: 'Nicaragua',
  NE: 'Niger', NG: 'Nigeria', MK: 'North Macedonia', NO: 'Norway', OM: 'Oman', PK: 'Pakistan',
  PW: 'Palau', PS: 'Palestine', PA: 'Panama', PG: 'Papua New Guinea', PY: 'Paraguay', PE: 'Peru',
  PH: 'Philippines', PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RE: 'Réunion', RO: 'Romania',
  RW: 'Rwanda', BL: 'Saint Barthélemy', KN: 'Saint Kitts and Nevis', LC: 'Saint Lucia',
  MF: 'Saint Martin', PM: 'Saint Pierre and Miquelon', VC: 'Saint Vincent and the Grenadines',
  WS: 'Samoa', SM: 'San Marino', ST: 'São Tomé and Príncipe', SA: 'Saudi Arabia', SN: 'Senegal',
  RS: 'Serbia', SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapore', SX: 'Sint Maarten',
  SK: 'Slovakia', SI: 'Slovenia', SB: 'Solomon Islands', SO: 'Somalia', ZA: 'South Africa',
  KR: 'South Korea', SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka', SD: 'Sudan', SR: 'Suriname',
  SE: 'Sweden', CH: 'Switzerland', TW: 'Taiwan', TJ: 'Tajikistan', TZ: 'Tanzania', TH: 'Thailand',
  TL: 'Timor-Leste', TG: 'Togo', TO: 'Tonga', TT: 'Trinidad and Tobago', TN: 'Tunisia',
  TR: 'Turkey', TM: 'Turkmenistan', TC: 'Turks and Caicos Islands', TV: 'Tuvalu', UG: 'Uganda',
  UA: 'Ukraine', AE: 'United Arab Emirates', GB: 'United Kingdom', US: 'United States',
  UY: 'Uruguay', UZ: 'Uzbekistan', VU: 'Vanuatu', VA: 'Vatican City', VE: 'Venezuela',
  VN: 'Vietnam', WF: 'Wallis and Futuna', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
}

/** Destinations we never ship to or from (see file header). */
export const RESTRICTED_COUNTRIES: ReadonlySet<string> = new Set(['CU', 'IR', 'KP', 'SY', 'RU', 'BY'])

export const DEFAULT_COUNTRY = 'US'

/** Picker order: United States first, then A→Z by name. */
export const COUNTRY_OPTIONS: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'US', name: COUNTRY_NAMES.US },
  ...Object.entries(COUNTRY_NAMES)
    .filter(([code]) => code !== 'US')
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en')),
]

/** Upper-cased ISO code when it is one we support, else null. */
export function normalizeCountry(raw: unknown): string | null {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  return code && Object.prototype.hasOwnProperty.call(COUNTRY_NAMES, code) ? code : null
}

export function isRestrictedCountry(code: string | null | undefined): boolean {
  return !!code && RESTRICTED_COUNTRIES.has(code.toUpperCase())
}

export function countryName(code: string | null | undefined): string {
  const c = (code || DEFAULT_COUNTRY).toUpperCase()
  return COUNTRY_NAMES[c] ?? c
}

export function isUS(code: string | null | undefined): boolean {
  return (code || DEFAULT_COUNTRY).toUpperCase() === 'US'
}
