/**
 * Smart Dutch Merchant & Banking Transaction Categorizer
 * Maps counterparty names and remittance descriptions to PayTrack's expense categories.
 */

export interface CategorizedResult {
  categoryId: string;
  isRentMatch: boolean;
}

const CATEGORY_RULES: Array<{
  categoryId: string;
  keywords: string[];
}> = [
  {
    categoryId: 'cat_food',
    keywords: [
      'albert heijn',
      'ah to go',
      'jumbo',
      'lidl',
      'aldi',
      'dirk',
      'plus ',
      'picnic',
      'supermarkt',
      'bakker',
      'slager',
      'spar ',
      'coop ',
      'mcdonald',
      'kfc',
      'burger king',
      'domino',
      'thuisbezorgd',
      'uber eats',
      'deliveroo',
      'subway',
    ],
  },
  {
    categoryId: 'cat_transp',
    keywords: [
      'ns reizigers',
      'ns groep',
      'ov-chipkaart',
      'gvb',
      'ret ',
      'connexxion',
      'arriva',
      'ebs ',
      'qbuzz',
      'uber ',
      'bolt ',
      'shell',
      'esso',
      'bp ',
      'totalenergies',
      'tango',
      'tinq',
      'avanza',
      'tankstation',
    ],
  },
  {
    categoryId: 'cat_health',
    keywords: [
      'kruidvat',
      'etos',
      'apotheek',
      'hollandzorg',
      'cz ',
      'vgz',
      'menzis',
      'zilveren kruis',
      'tandarts',
      'huisarts',
      'fysiotherapie',
      'ziekenhuis',
    ],
  },
  {
    categoryId: 'cat_shopping',
    keywords: [
      'bol.com',
      'amazon',
      'mediamarkt',
      'coolblue',
      'action',
      'hema',
      'ikea',
      'zalando',
      'h&m',
      'zara',
      'primark',
      'decathlon',
      'tk maxx',
      'de bijenkorf',
    ],
  },
  {
    categoryId: 'cat_bills',
    keywords: [
      'gemeente',
      'belastingdienst',
      'kpn',
      'vodafone',
      'odido',
      'ziggo',
      'vattenfall',
      'eneco',
      'essent',
      'greenchoice',
      'waternet',
      'dunea',
      'evides',
      'overheid',
    ],
  },
  {
    categoryId: 'cat_sub',
    keywords: [
      'netflix',
      'spotify',
      'disney',
      'youtube',
      'apple.com/bill',
      'google *',
      'playstation',
      'xbox',
      'patreon',
      'chatgpt',
      'openai',
      'prime video',
    ],
  },
  {
    categoryId: 'cat_ent',
    keywords: [
      'pathe',
      'kinepolis',
      'vue ',
      'cinema',
      'bioscoop',
      'cafe',
      'bar ',
      'restaurant',
      'theater',
      'festival',
    ],
  },
  {
    categoryId: 'cat_travel',
    keywords: [
      'klm',
      'ryanair',
      'easyjet',
      'transavia',
      'booking.com',
      'airbnb',
      'hotels.com',
      'schiphol',
      'eurostar',
    ],
  },
];

const RENT_KEYWORDS = ['rent', 'kira', 'huur', 'housing', 'woning', 'kamer', 'verhuur', 'huisvesting'];

export function categorizeTransaction(tx: {
  amount: number;
  bookingDate?: string;
  creditorName?: string | null;
  debtorName?: string | null;
  remittanceInformation?: string | null;
}): CategorizedResult {
  const text = [
    tx.creditorName || '',
    tx.debtorName || '',
    tx.remittanceInformation || '',
  ]
    .join(' ')
    .toLowerCase();

  const isRentText = RENT_KEYWORDS.some((kw) => text.includes(kw));

  // Check if text matches another known non-housing category rule (e.g. MediaMarkt, Albert Heijn, Zara)
  let matchedOtherCategory: string | null = null;
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      matchedOtherCategory = rule.categoryId;
      break;
    }
  }

  // Exact €160 payment check (outflow)
  const isExact160 = Math.abs(Math.abs(tx.amount) - 160) < 0.01 && tx.amount < 0;
  const isClose160 = Math.abs(Math.abs(tx.amount) - 160) <= 5.0 && tx.amount < 0;

  // Check day of week if bookingDate is provided (Monday is 1 in JS Date)
  let isMonday = false;
  if (tx.bookingDate) {
    const parts = tx.bookingDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      isMonday = d.getDay() === 1;
    }
  }

  // REFINED RENT MATCHING:
  // 1. If explicit rent keywords are present:
  if (isRentText) {
    return {
      categoryId: 'cat_housing',
      isRentMatch: isExact160 || isClose160,
    };
  }

  // 2. If it's €160, but matches a known retail/dining/transport merchant (e.g. MediaMarkt €160):
  // Never mistakenly classify it as rent!
  if (matchedOtherCategory) {
    return {
      categoryId: matchedOtherCategory,
      isRentMatch: false,
    };
  }

  // 3. If exact €160 on a Monday and no conflicting merchant was matched:
  // e.g. weekly agency rent transfer
  if (isExact160 && isMonday) {
    return {
      categoryId: 'cat_housing',
      isRentMatch: true,
    };
  }

  // 4. Default fallback:
  return {
    categoryId: 'cat_other',
    isRentMatch: false,
  };
}
