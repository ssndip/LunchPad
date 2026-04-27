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
    { id: 'soups', categoryName: 'Soups', pattern: 'супа|супи', applyBoxFeeByDefault: false },
    { id: 'mains', categoryName: 'Main Dishes', pattern: 'основни ястия|основно ястие', applyBoxFeeByDefault: false },
    { id: 'salads', categoryName: 'Salads', pattern: 'салата|салати', applyBoxFeeByDefault: true },
    { id: 'bread', categoryName: 'Bread', pattern: 'хляб', applyBoxFeeByDefault: false },
    { id: 'desserts', categoryName: 'Desserts', pattern: 'десерт|десерти', applyBoxFeeByDefault: false },
    { id: 'sides', categoryName: 'Side Dishes', pattern: 'гарнитур|гарнитури', applyBoxFeeByDefault: true },
    { id: 'bbq', categoryName: 'BBQ', pattern: 'скара', applyBoxFeeByDefault: true }
  ],
  entityExtraction: {
    datePattern: '(\\d{1,2}[.\\-/]\\d{1,2}[.\\-/]\\d{2,4})',
    weightPattern: '((?:\\d+[.,])?\\d+\\s*(?:гр|g|gr|мл|ml))',
    pricePattern: '(?:[-–—\\s]+)?([\\d]+[,.][\\d]+|[\\d]+)\\s*(?:€|\\$|лв|лева|е|е\\.|евро)?\\s*[:.]?\\s*$',
    boxFeePattern: '(?:кутийка\\s*[:\\-–—\\s]*([\\d]+[,.][\\d]+|[\\d]+)\\s*(?:€|\\$|лв|е|е\\.)?|([\\d]+[,.][\\d]+|[\\d]+)\\s*(?:€|\\$|лв|е|е\\.)?\\s*кутийка)',
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
