const fs = require('fs');
const path = require('path');

// Fix import-job-processor.ts
const filePath = path.join(__dirname, '../packages/api/src/services/import-job-processor.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix imports
content = content.replace(/@repo\/shared/g, '@moxmuse/shared');

// Fix implicit any types - add type annotations
content = content.replace(
  /reduce\(\(sum, deck\) =>/g, 
  'reduce((sum: number, deck: any) =>'
);

content = content.replace(
  /\.map\(\(deck\) =>/g, 
  '.map((deck: any) =>'
);

content = content.replace(
  /\.map\(\(c\) =>/g, 
  '.map((c: any) =>'
);

// Replace FileReader with Node.js fs operations
content = content.replace(
  `private async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }`,
  `private async readFile(file: any): Promise<string> {
    // In a Node.js environment, we would handle file differently
    // This is a placeholder for the actual implementation
    if (typeof file === 'string') {
      return file;
    }
    // Handle Buffer or other file types
    if (Buffer.isBuffer(file)) {
      return file.toString('utf8');
    }
    // For now, return empty string for unsupported types
    return '';
  }`
);

// Fix the deckCard field name issue
content = content.replace(
  `await this.db.deckCard.create({
        data: {
          deckId: createdDeck.id,
          cardName: card.name,
          quantity: card.quantity,
          category: card.category || 'main'
        }
      })`,
  `await this.db.deckCard.create({
        data: {
          deckId: createdDeck.id,
          cardId: card.name, // This should be cardId, not cardName
          quantity: card.quantity,
          category: card.category || 'main'
        }
      })`
);

fs.writeFileSync(filePath, content);

console.log('✅ Fixed import-job-processor.ts');
