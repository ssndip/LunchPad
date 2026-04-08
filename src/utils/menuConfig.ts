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
    sides: "Side Dishes",
    bbq: "BBQ",
    other: "Other",
    desserts: "Desserts",
  },
  categoryKeywords: {
    soups: ["супи"],
    mains: ["основни ястия"],
    sides: ["гарнитури"],
    bbq: ["скара"],
    other: ["други"],
    desserts: ["десерти"],
  },
  fees: {
    defaultBox: 0.10,
    defaultBbqContainer: 0.10,
  },
  settings: {
    applyBoxFee: {
      sides: true,
      bbq: true,
      mainsWithGarnish: false,
    },
    sideDishTriggerKeyword: "с гарнитура",
  },
  rules: [
    {
      id: 'side_dish_logic',
      match: (item) => item.category === 'Side Dishes',
      apply: (item, config, sectionConfig) => {
        item.tags.push('standalone_side');
        // Use extracted section box fee if available, else global default
        const feeAmount = sectionConfig?.boxFee ?? config.fees.defaultBox;
        if (config.settings.applyBoxFee.sides) {
          item.extraFees.push({ type: 'Box', amount: feeAmount });
          item.price = Number((item.price + feeAmount).toFixed(2));
        }
      }
    },
    {
      id: 'bbq_logic',
      match: (item) => item.category === 'BBQ',
      apply: (item, config, sectionConfig) => {
        item.tags.push('bbq');
        const feeAmount = sectionConfig?.boxFee ?? config.fees.defaultBbqContainer;
        if (config.settings.applyBoxFee.bbq) {
          item.extraFees.push({ type: 'BBQ Container', amount: feeAmount });
          item.price = Number((item.price + feeAmount).toFixed(2));
        }
      }
    },
    {
      id: 'main_with_side_logic',
      match: (item) => (item.category === 'Main Dishes' || item.category === 'BBQ') && item.hasIncludedSide,
      apply: (item, config, sectionConfig) => {
        const feeAmount = sectionConfig?.boxFee ?? config.fees.defaultBox;
        if (config.settings.applyBoxFee.mainsWithGarnish) {
          item.extraFees.push({ type: 'Box', amount: feeAmount });
          item.price = Number((item.price + feeAmount).toFixed(2));
        }
      }
    }
  ]
};
