# Setting Up OpenAI API Key for MoxMuse

## 🔑 Getting Your API Key

1. **Sign up for OpenAI**
   - Go to https://platform.openai.com/signup
   - Create an account or sign in

2. **Generate API Key**
   - Navigate to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Give it a name like "MoxMuse"
   - Copy the key immediately (you won't see it again!)

3. **Add Credits**
   - Go to https://platform.openai.com/account/billing
   - Add payment method and credits
   - $5-10 should be plenty for testing

## 🔧 Adding Key to MoxMuse

1. Open your `.env.local` file in the project root
2. Find the line: `OPENAI_API_KEY=""`
3. Add your key between the quotes:
   ```
   OPENAI_API_KEY="sk-proj-..."
   ```

## 💰 Cost Estimates

- GPT-4 Turbo: ~$0.01 per 1K input tokens, $0.03 per 1K output tokens
- Average recommendation request: ~$0.02-0.05
- Monthly cost for moderate use: $5-20

## 🧪 Testing Your Setup

Once you've added your API key:

1. Restart the dev server: `pnpm dev`
2. Go to http://localhost:3000/tutor
3. Try asking: "Recommend 3 budget draw spells for my mono-blue commander deck"

If it works, you'll see card recommendations!

## ⚠️ Security Notes

- **Never commit your API key to git**
- The `.env.local` file is already in `.gitignore`
- Consider using environment variables in production
- Set usage limits in OpenAI dashboard to prevent surprises

## 🚀 Next Steps

After setting up your API key, the TolarianTutor will be fully functional! You can:
- Get personalized card recommendations
- Filter by budget, power level, and owned cards
- Generate affiliate links for cards you don't own

For production deployment, consider using services like Vercel that support environment variables. 