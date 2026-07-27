import { MenuItem, ExtraFee } from '../types';

export interface MenuConfig {
  /** Map of category keys to display names */
  categoryLabels: Record<string, string>;
  /** Map of category keys to list of Bulgarian keywords/headers */
  categoryKeywords: Record<string, string[]>;
  fees: {
    defaultBox: number;
    defaultBbqContainer: number;
  };
  settings: {
    applyBoxFee: {
      sides: boolean;
      bbq: boolean;
      salads: boolean;
      mainsWithGarnish: boolean;
    };
    sideDishTriggerKeyword: string;
  };
  rules: {
    id: string;
    match: (item: MenuItem) => boolean;
    apply: (item: MenuItem, config: MenuConfig, sectionConfig?: any) => void;
  }[];
}

export const MENU_CONFIG: MenuConfig = {
  categoryLabels: {
    soups: "Soups",
    mains: "Main Dishes",
    salads: "Salads",
    bread: "Bread",
    sides: "Side Dishes",
    bbq: "BBQ",
    other: "Other",
    desserts: "Desserts",
  },
  categoryKeywords: {
    soups: ["супи"],
    mains: ["основно ястие", "основни ястия"],
    salads: ["салати"],
    bread: ["хляб"],
    sides: ["гарнитури"],
    bbq: ["скара"],
    other: ["други"],
    desserts: ["десерти"],
  },
  fees: {
    defaultBox: 0,
    defaultBbqContainer: 0,
  },
  settings: {
    applyBoxFee: {
      sides: true,
      bbq: true,
      salads: true,
      mainsWithGarnish: false,
    },
    sideDishTriggerKeyword: "с гарнитура",
  },
  rules: [
    {
      id: 'box_fee_logic',
      match: (item) => (item.category === 'Side Dishes' || item.category === 'Salads'),
      apply: (item, config, sectionConfig) => {
        item.tags.push('autobox');
      }
    },
    {
      id: 'bbq_logic',
      match: (item) => item.category === 'BBQ',
      apply: (item, config, sectionConfig) => {
        item.tags.push('bbq');
      }
    },
    {
      id: 'main_with_side_logic',
      match: (item) => (item.category === 'Main Dishes' || item.category === 'BBQ') && item.hasIncludedSide,
      apply: (item, config, sectionConfig) => {
        // No fee addition here
      }
    }
  ]
};
