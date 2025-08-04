-- Enable Row Level Security for all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Card" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CardInDeck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Collection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CollectedCard" ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users can view own profile" ON "User"
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON "User"
  FOR UPDATE USING (auth.uid()::text = id);

-- Deck policies
CREATE POLICY "Users can view own decks" ON "Deck"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can create decks" ON "Deck"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update own decks" ON "Deck"
  FOR UPDATE USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete own decks" ON "Deck"
  FOR DELETE USING (auth.uid()::text = "userId");

CREATE POLICY "Public decks are viewable" ON "Deck"
  FOR SELECT USING ("isPublic" = true);

-- Collection policies
CREATE POLICY "Users can view own collection" ON "Collection"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can manage own collection" ON "Collection"
  FOR ALL USING (auth.uid()::text = "userId");

-- Card policies (cards are public data)
CREATE POLICY "Cards are viewable by all" ON "Card"
  FOR SELECT USING (true);

-- CardInDeck policies (inherit from deck permissions)
CREATE POLICY "Users can view cards in accessible decks" ON "CardInDeck"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Deck" 
      WHERE "Deck".id = "CardInDeck"."deckId" 
      AND ("Deck"."userId" = auth.uid()::text OR "Deck"."isPublic" = true)
    )
  );

CREATE POLICY "Users can manage cards in own decks" ON "CardInDeck"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Deck" 
      WHERE "Deck".id = "CardInDeck"."deckId" 
      AND "Deck"."userId" = auth.uid()::text
    )
  );
