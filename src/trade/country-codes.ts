import {
  chileAduanaCountryIsoByCode,
  normalizeChileAduanaCountryCode,
} from "@/trade/chile-aduana-country-iso";

export { chileAduanaCountryIsoByCode };

const supportedFlagCodes = new Set([
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB",
  "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY",
  "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CP", "CR", "CU", "CV", "CW",
  "CX", "CY", "CZ", "DE", "DG", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "EU",
  "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP",
  "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "IC", "ID", "IE", "IL", "IM",
  "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR",
  "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME",
  "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY",
  "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PC", "PE", "PF",
  "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA",
  "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX",
  "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "XK", "YE",
  "YT", "ZA", "ZM", "ZW",
]);

const countryIsoAliases = new Map<string, string>([
  ["afghanistan", "AF"],
  ["alemania", "DE"],
  ["alemania f.r.", "DE"],
  ["alemania r.d.", "DE"],
  ["argentina", "AR"],
  ["australia", "AU"],
  ["belarus", "BY"],
  ["belgica", "BE"],
  ["brasil", "BR"],
  ["canada", "CA"],
  ["chile", "CL"],
  ["china", "CN"],
  ["colombia", "CO"],
  ["corea del sur", "KR"],
  ["emiratos arabes unidos", "AE"],
  ["ecuador", "EC"],
  ["espana", "ES"],
  ["estados unidos", "US"],
  ["estados unidos de america", "US"],
  ["francia", "FR"],
  ["holanda", "NL"],
  ["hong kong region administrativa especial de china", "HK"],
  ["india", "IN"],
  ["irlanda", "IE"],
  ["italia", "IT"],
  ["japon", "JP"],
  ["mexico", "MX"],
  ["paises bajos", "NL"],
  ["paraguay", "PY"],
  ["peru", "PE"],
  ["polonia", "PL"],
  ["reino unido", "GB"],
  ["taiwan", "TW"],
  ["taiwan formosa", "TW"],
  ["taiwan (formosa)", "TW"],
  ["u.s.a.", "US"],
  ["usa", "US"],
  ["uruguay", "UY"],
  ["vietnam", "VN"],
]);

function normalizeCountryLookupValue(value: string) {
  return value
    .trim()
    .replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s+/u, "")
    .replace(/^codigo\s+\d+\s*/i, "")
    .replace(/^\d+\s*[·-]\s*/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayNameIsoLookup() {
  const lookup = new Map<string, string>();
  const locales = ["es", "en"];

  for (const locale of locales) {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });

    for (const code of supportedFlagCodes) {
      const label = displayNames.of(code);

      if (label) {
        lookup.set(normalizeCountryLookupValue(label), code);
      }
    }
  }

  for (const [label, code] of countryIsoAliases) {
    lookup.set(label, code);
  }

  return lookup;
}

const countryIsoByDisplayName = displayNameIsoLookup();
const spanishRegionNames = new Intl.DisplayNames(["es"], { type: "region" });

export function normalizeCountryFlagCode(
  countryCode?: string | null,
  countryName?: string | null,
) {
  const trimmedCode = countryCode?.trim();

  if (trimmedCode && /^[a-z]{2}$/i.test(trimmedCode)) {
    const upperCode = trimmedCode.toUpperCase();
    return supportedFlagCodes.has(upperCode) ? upperCode.toLowerCase() : null;
  }

  if (trimmedCode) {
    const normalizedAduanaCode = normalizeChileAduanaCountryCode(trimmedCode);

    if (normalizedAduanaCode) {
      const isoFromAduanaCode = chileAduanaCountryIsoByCode.get(normalizedAduanaCode);

      return isoFromAduanaCode && supportedFlagCodes.has(isoFromAduanaCode)
        ? isoFromAduanaCode.toLowerCase()
        : null;
    }
  }

  const nameLookup = countryName ? normalizeCountryLookupValue(countryName) : "";
  const isoFromName = nameLookup ? countryIsoByDisplayName.get(nameLookup) : undefined;

  if (isoFromName && supportedFlagCodes.has(isoFromName)) {
    return isoFromName.toLowerCase();
  }

  return null;
}

export function countryNameForFlagCode(countryCode?: string | null) {
  const flagCode = normalizeCountryFlagCode(countryCode);

  if (!flagCode) {
    return null;
  }

  const label = spanishRegionNames.of(flagCode.toUpperCase());
  return label && label !== flagCode.toUpperCase() ? label : null;
}
