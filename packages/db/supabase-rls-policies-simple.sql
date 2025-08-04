-- Row Level Security Implementation for MoxMuse (Simplified)

-- Enable RLS on core tables first
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneratedDeck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneratedDeckCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsultationSession" ENABLE ROW LEVEL SECURITY;

-- Basic User policies
CREATE POLICY "Users can view their own profile" ON "User"
  FOR SELECT USING (id = auth.uid()::text);

CREATE POLICY "Users can update their own profile" ON "User"
  FOR UPDATE USING (id = auth.uid()::text);

-- Deck policies
CREATE POLICY "Users can view their own decks" ON "Deck"
  FOR SELECT USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can view public decks" ON "Deck"
  FOR SELECT USING ("isPublic" = true);

CREATE POLICY "Users can create their own decks" ON "Deck"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update their own decks" ON "Deck"
  FOR UPDATE USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete their own decks" ON "Deck"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- DeckCard policies
CREATE POLICY "Users can view cards in accessible decks" ON "DeckCard"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Deck"
      WHERE "Deck".id = "DeckCard"."deckId"
      AND ("Deck"."userId" = auth.uid()::text OR "Deck"."isPublic" = true)
    )
  );

CREATE POLICY "Users can manage cards in their own decks" ON "DeckCard"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Deck"
      WHERE "Deck".id = "DeckCard"."deckId"
      AND "Deck"."userId" = auth.uid()::text
    )
  );

-- GeneratedDeck policies
CREATE POLICY "Users can view their own generated decks" ON "GeneratedDeck"
  FOR SELECT USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can create their own generated decks" ON "GeneratedDeck"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update their own generated decks" ON "GeneratedDeck"
  FOR UPDATE USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete their own generated decks" ON "GeneratedDeck"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- GeneratedDeckCard policies
CREATE POLICY "Users can view cards in their generated decks" ON "GeneratedDeckCard"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GeneratedDeck"
      WHERE "GeneratedDeck".id = "GeneratedDeckCard"."deckId"
      AND "GeneratedDeck"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can manage cards in their generated decks" ON "GeneratedDeckCard"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "GeneratedDeck"
      WHERE "GeneratedDeck".id = "GeneratedDeckCard"."deckId"
      AND "GeneratedDeck"."userId" = auth.uid()::text
    )
  );

-- ConsultationSession policies
CREATE POLICY "Users can view their own consultation sessions" ON "ConsultationSession"
  FOR SELECT USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can create their own consultation sessions" ON "ConsultationSession"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update their own consultation sessions" ON "ConsultationSession"
  FOR UPDATE USING ("userId" = auth.uid()::text);

-- Grant basic permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
