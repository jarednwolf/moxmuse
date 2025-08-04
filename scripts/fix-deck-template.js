const fs = require('fs');
const path = require('path');

// Fix deck-template.ts
const deckTemplatePath = path.join(__dirname, '../packages/api/src/services/deck-template.ts');
let deckTemplateContent = fs.readFileSync(deckTemplatePath, 'utf8');

// Fix performanceMonitor.track -> trackOperation
deckTemplateContent = deckTemplateContent.replace(/performanceMonitor\.track\(/g, 'performanceMonitor.trackOperation(');

// Fix intelligentCache.invalidateByTags -> invalidateTag (multiple calls)
deckTemplateContent = deckTemplateContent.replace(/await intelligentCache\.invalidateByTags\(\[(.*?)\]\)/g, (match, tags) => {
  const tagList = tags.split(',').map(tag => tag.trim());
  return tagList.map(tag => `await intelligentCache.invalidateTag(${tag})`).join(';\n        ');
});

// Fix intelligentCache.getOrSet -> use get/set pattern
deckTemplateContent = deckTemplateContent.replace(
  /return intelligentCache\.getOrSet\(\s*cacheKey,\s*async \(\) => \{([\s\S]*?)\},\s*\{ ttl: (\d+), tags: \[(.*?)\] \}\s*\)/g,
  (match, asyncBody, ttl, tags) => {
    return `const cached = await intelligentCache.get(cacheKey);
      if (cached) return cached;
      
      const result = await (async () => {${asyncBody}})();
      
      await intelligentCache.set(cacheKey, result, { ttl: ${ttl} });
      return result`;
  }
);

// Fix error logging - remove object wrapper
deckTemplateContent = deckTemplateContent.replace(/logger\.error\('(.*?)', \{ error(.*?)\}\)/g, 'logger.error(\'$1\', error as Error$2)');

// Fix implicit any types
deckTemplateContent = deckTemplateContent.replace(/\.filter\(cardId => /g, '.filter((cardId: string) => ');

fs.writeFileSync(deckTemplatePath, deckTemplateContent);

console.log('✅ Fixed deck-template.ts');
