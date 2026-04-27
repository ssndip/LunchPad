const RegexConfig = {
  DATE: /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/,
};
console.log('Price test:', RegexConfig.DATE.test('*Кебапче -0.85'));
console.log('Date test:', RegexConfig.DATE.test('Меню за 27.04.26'));
