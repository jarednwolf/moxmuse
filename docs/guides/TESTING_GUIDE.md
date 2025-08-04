# MoxMuse Testing Guide

## 🧪 Testing TolarianTutor AI Recommendations

### Prerequisites
- ✅ Development server running (`pnpm dev`)
- ✅ PostgreSQL running
- ✅ Redis running  
- ✅ OpenAI API key configured
- ✅ Demo user created

### Test Flow

1. **Access the Application**
   - Navigate to http://localhost:3000
   - Verify the homepage loads with animated background

2. **Authentication**
   - Click "TolarianTutor" or go to /tutor
   - Sign in with:
     - Email: `demo@moxmuse.com`
     - Password: `demo123`

3. **Test AI Recommendations**

   **Basic Card Recommendations:**
   ```
   "What are some good card draw spells for a blue commander deck?"
   ```
   Expected: GPT-4 should recommend cards like Rhystic Study, Mystic Remora, etc.

   **Budget Constraints:**
   ```
   "I need removal spells for a budget white deck under $5 per card"
   ```
   Expected: Should filter recommendations by price

   **Specific Strategies:**
   ```
   "Suggest win conditions for a Golgari graveyard deck"
   ```
   Expected: Should recommend cards that synergize with graveyard strategies

   **Collection Awareness (Future):**
   ```
   "What lands should I add to my deck that I don't already own?"
   ```
   Expected: Currently will recommend all relevant lands (collection sync pending)

### What to Verify

1. **AI Understanding**: Does the AI correctly interpret your deck-building question?
2. **Card Relevance**: Are the recommended cards appropriate for the request?
3. **Affiliate Links**: Do cards show TCGPlayer links (currently using demo ID)?
4. **UI/UX**: Is the chat interface smooth and responsive?
5. **Error Handling**: Does the app gracefully handle API errors?

### Troubleshooting

**If recommendations fail:**
1. Check console for errors (F12 in browser)
2. Verify OpenAI API key is correctly set in `.env.local`
3. Check server logs in terminal
4. Ensure Redis is caching Scryfall data

**Common Issues:**
- "Unauthorized" → Sign in again
- "API Error" → Check OpenAI key and rate limits
- "No cards found" → Scryfall API might be down

### Next Steps After Testing

Once TolarianTutor is working:
1. Configure real TCGPlayer affiliate ID
2. Test Card Kingdom affiliate links
3. Implement Moxfield OAuth for collection sync
4. Build deck management UI
5. Create collection browser (LotusList)

## 📊 Performance Benchmarks

- AI response time: Should be < 3 seconds
- Card search: Should be < 1 second (cached)
- Affiliate link generation: Instant

## 🎯 Success Criteria

✓ AI understands MTG terminology
✓ Recommendations are contextually relevant
✓ Affiliate links generate correctly
✓ UI provides smooth chat experience
✓ Errors are handled gracefully 