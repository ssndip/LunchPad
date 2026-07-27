export interface RegexRule {
  pattern: string;
  flags?: string;
}

export interface PreprocessingRule {
  id: string;
  type: 'replace' | 'remove' | 'trim' | 'normalize_whitespace';
  search?: string;
  replace?: string;
  pattern?: string; // Regex pattern for 'replace' or 'remove'
}

export interface IgnoredLineRule {
  id: string;
  pattern: string; // Regex pattern
  description?: string;
}

export interface SectionDetectionRule {
  id: string;
  categoryName: string;
  pattern: string; // Regex to detect the start of this section
  applyBoxFeeByDefault?: boolean; // New requirement: toggle packaging fee per category
  defaultPrice?: number;
  defaultWeight?: string;
}

export interface EntityExtractionRules {
  pricePattern: string;
  weightPattern: string;
  boxFeePattern: string;
  datePattern: string;
  itemPrefixPattern: string;
  boxKeywordPattern: string;
  bgnNoisePattern?: string; // Pattern to strip BGN info
}

export interface EnrichmentRule {
  id: string;
  condition: {
    category?: string[];
    nameContains?: string;
  };
  action: {
    addTag?: string;
    setBoxFee?: number;
    hasIncludedSide?: boolean;
  };
}

export interface ParserConfig {
  version: number;
  language: 'bg' | 'en';
  preprocessing: PreprocessingRule[];
  ignoreRules: IgnoredLineRule[];
  sectionDetection: SectionDetectionRule[];
  entityExtraction: EntityExtractionRules;
  enrichmentRules: EnrichmentRule[];
  fallbackCategory: string;
}

export interface ParserProfile {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'published';
  isActive: boolean;
}

export interface ParserVersion {
  id: string;
  profileId: string;
  versionNumber: number;
  configJson: string; // Serialized ParserConfig
  changeNote: string;
  createdAt: string;
}

export interface ParserFixture {
  id: string;
  name: string;
  rawInput: string;
  expectedOutputJson?: string;
}
