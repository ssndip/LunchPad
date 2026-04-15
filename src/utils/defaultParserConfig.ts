import { ParserConfig } from '../types/parserConfig';

export const DEFAULT_PARSER_CONFIG: ParserConfig = {
  version: 1,
  language: 'bg',
  preprocessing: [
    { id: 'trim', type: 'trim' },
    { id: 'norm_ws', type: 'normalize_whitespace' },
    { id: 'bgn_noise', type: 'remove', pattern: '[\\d]+[,.][\\d]+\\s*(?:лв|лева|лв\\.)' }
  ],
  ignoreRules: [
    { id: 'empty', pattern: '^\\s*$' }
  ],
  sectionDetection: [
    { id: 'soups', categoryName: 'Soups', pattern: 'супи', applyBoxFeeByDefault: false },
    { id: 'mains', categoryName: 'Main Dishes', pattern: 'основни ястия|основно ястие', applyBoxFeeByDefault: false },
    { id: 'salads', categoryName: 'Salads', pattern: 'салати', applyBoxFeeByDefault: true },
    { id: 'bread', categoryName: 'Bread', pattern: 'хляб', applyBoxFeeByDefault: false },
    { id: 'desserts', categoryName: 'Desserts', pattern: 'десерти', applyBoxFeeByDefault: false },
    { id: 'sides', categoryName: 'Side Dishes', pattern: 'гарнитури', applyBoxFeeByDefault: true },
    { id: 'bbq', categoryName: 'BBQ', pattern: 'скара', applyBoxFeeByDefault: true }
  ],
  entityExtraction: {
    datePattern: '(\\d{1,2}[.\\-/]\\d{1,2}[.\\-/]\\d{2,4})',
    weightPattern: '(\\d+\\s*(?:гр|g|gr|мл|ml))',
    pricePattern: '([\\d]+[,.][\\d]+|[\\d]+)\\s*(?:€|\\$)',
    boxFeePattern: '([\\d]+[,.][\\d]+|[\\d]+)\\s*(?:€|\\$)?\\s*кутийка',
    itemPrefixPattern: '^[-•*]\\s*',
    boxKeywordPattern: 'кутийка',
    bgnNoisePattern: '[\\d]+[,.][\\d]+\\s*(?:лв|лева|лв\\.)'
  },
  enrichmentRules: [
    { 
      id: 'autobox_sides', 
      condition: { category: ['Side Dishes', 'Salads'] }, 
      action: { addTag: 'autobox' } 
    },
    { 
      id: 'bbq_tag', 
      condition: { category: ['BBQ'] }, 
      action: { addTag: 'bbq' } 
    }
  ],
  fallbackCategory: 'Other'
};
