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

  // Weekly Monday €160 Rent Check:
  // If text mentions rent/kira/huur OR amount is exactly -160 (or within €155-€165 with housing text)
  const isExact160 = Math.abs(Math.abs(tx.amount) - 160) < 0.01;
  const isClose160 = Math.abs(Math.abs(tx.amount) - 160) <= 5.0;

  if (isRentText || (isExact160 && tx.amount < 0)) {
    return {
      categoryId: 'cat_housing',
      isRentMatch: isExact160 || (isClose160 && isRentText),
    };
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return {
        categoryId: rule.categoryId,
        isRentMatch: false,
      };
    }
  }

  return {
    categoryId: 'cat_other',
    isRentMatch: false,
  };
}
