import { MENU_CONFIG } from './src/utils/menuConfig';

function mapCategoryNameToKey(categoryName: string, config: any): string {
  const lineLower = categoryName.toLowerCase();
  for (const [key, keywords] of Object.entries(config.categoryKeywords) as any) {
    if (keywords.some((k: string) => lineLower.includes(k.toLowerCase()))) {
      return key;
    }
  }
  return 'other'; // default to other if no matching keyword
}

console.log(mapCategoryNameToKey('Гарнитури ', MENU_CONFIG));
