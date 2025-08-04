-- Row Level Security Implementation for MoxMuse

-- Enable RLS on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CollectionCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Recommendation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClickEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CollectionSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneratedDeck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneratedDeckCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckAnalysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsultationSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnhancedDeck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnhancedDeckCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserLearningData" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIAnalysisCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuggestionFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckFolder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckFolderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedCardSearch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExportJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PublicDeck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserFollow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommentLike" ENABLE ROW LEVEL SECURITY;

-- Create authentication helper function
CREATE OR REPLACE FUNCTION auth.uid() RETURNS text AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    (current_setting('request.jwt.claims', true)::json->>'user_metadata'->>'sub')::text
  )
$$ LANGUAGE SQL STABLE;

-- User policies
CREATE POLICY "Users can view their own profile" ON "User"
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON "User"
  FOR UPDATE USING (id = auth.uid());

-- Account policies
CREATE POLICY "Users can view their own accounts" ON "Account"
  FOR SELECT USING ("userId" = auth.uid());

-- Session policies
CREATE POLICY "Users can view their own sessions" ON "Session"
  FOR SELECT USING ("userId" = auth.uid());

-- CollectionCard policies
CREATE POLICY "Users can view their own collection cards" ON "CollectionCard"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own collection cards" ON "CollectionCard"
  FOR ALL USING ("userId" = auth.uid());

-- Deck policies
CREATE POLICY "Users can view their own decks" ON "Deck"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can view public decks" ON "Deck"
  FOR SELECT USING ("isPublic" = true);

CREATE POLICY "Users can manage their own decks" ON "Deck"
  FOR ALL USING ("userId" = auth.uid());

-- DeckCard policies
CREATE POLICY "Users can view cards in their own decks" ON "DeckCard"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Deck"
      WHERE "Deck".id = "DeckCard"."deckId"
      AND "Deck"."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can view cards in public decks" ON "DeckCard"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Deck"
      WHERE "Deck".id = "DeckCard"."deckId"
      AND "Deck"."isPublic" = true
    )
  );

CREATE POLICY "Users can manage cards in their own decks" ON "DeckCard"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Deck"
      WHERE "Deck".id = "DeckCard"."deckId"
      AND "Deck"."userId" = auth.uid()
    )
  );

-- Recommendation policies
CREATE POLICY "Users can view their own recommendations" ON "Recommendation"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own recommendations" ON "Recommendation"
  FOR ALL USING ("userId" = auth.uid());

-- ClickEvent policies
CREATE POLICY "Users can create their own click events" ON "ClickEvent"
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY "Users can view their own click events" ON "ClickEvent"
  FOR SELECT USING ("userId" = auth.uid());

-- SyncJob policies
CREATE POLICY "Users can view their own sync jobs" ON "SyncJob"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own sync jobs" ON "SyncJob"
  FOR ALL USING ("userId" = auth.uid());

-- CollectionSource policies
CREATE POLICY "Users can view their own collection sources" ON "CollectionSource"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own collection sources" ON "CollectionSource"
  FOR ALL USING ("userId" = auth.uid());

-- GeneratedDeck policies
CREATE POLICY "Users can view their own generated decks" ON "GeneratedDeck"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own generated decks" ON "GeneratedDeck"
  FOR ALL USING ("userId" = auth.uid());

-- GeneratedDeckCard policies
CREATE POLICY "Users can view cards in their generated decks" ON "GeneratedDeckCard"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "GeneratedDeck"
      WHERE "GeneratedDeck".id = "GeneratedDeckCard"."deckId"
      AND "GeneratedDeck"."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can manage cards in their generated decks" ON "GeneratedDeckCard"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "GeneratedDeck"
      WHERE "GeneratedDeck".id = "GeneratedDeckCard"."deckId"
      AND "GeneratedDeck"."userId" = auth.uid()
    )
  );

-- ConsultationSession policies
CREATE POLICY "Users can view their own consultation sessions" ON "ConsultationSession"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own consultation sessions" ON "ConsultationSession"
  FOR ALL USING ("userId" = auth.uid());

-- PriceAlert policies
CREATE POLICY "Users can view their own price alerts" ON "PriceAlert"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own price alerts" ON "PriceAlert"
  FOR ALL USING ("userId" = auth.uid());

-- Notification policies
CREATE POLICY "Users can view their own notifications" ON "Notification"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own notifications" ON "Notification"
  FOR ALL USING ("userId" = auth.uid());

-- EnhancedDeck policies
CREATE POLICY "Users can view their own enhanced decks" ON "EnhancedDeck"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own enhanced decks" ON "EnhancedDeck"
  FOR ALL USING ("userId" = auth.uid());

-- EnhancedDeckCard policies
CREATE POLICY "Users can view cards in their enhanced decks" ON "EnhancedDeckCard"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "EnhancedDeck"
      WHERE "EnhancedDeck".id = "EnhancedDeckCard"."deckId"
      AND "EnhancedDeck"."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can manage cards in their enhanced decks" ON "EnhancedDeckCard"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "EnhancedDeck"
      WHERE "EnhancedDeck".id = "EnhancedDeckCard"."deckId"
      AND "EnhancedDeck"."userId" = auth.uid()
    )
  );

-- UserLearningData policies
CREATE POLICY "Users can view their own learning data" ON "UserLearningData"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own learning data" ON "UserLearningData"
  FOR ALL USING ("userId" = auth.uid());

-- AIAnalysisCache policies
CREATE POLICY "Users can view analysis for their decks" ON "AIAnalysisCache"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "EnhancedDeck"
      WHERE "EnhancedDeck".id = "AIAnalysisCache"."deckId"
      AND "EnhancedDeck"."userId" = auth.uid()
    )
  );

-- SuggestionFeedback policies
CREATE POLICY "Users can view their own suggestion feedback" ON "SuggestionFeedback"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can create their own suggestion feedback" ON "SuggestionFeedback"
  FOR INSERT WITH CHECK ("userId" = auth.uid());

-- DeckFolder policies
CREATE POLICY "Users can view their own deck folders" ON "DeckFolder"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own deck folders" ON "DeckFolder"
  FOR ALL USING ("userId" = auth.uid());

-- DeckTemplate policies
CREATE POLICY "Users can view their own deck templates" ON "DeckTemplate"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can view public deck templates" ON "DeckTemplate"
  FOR SELECT USING ("isPublic" = true);

CREATE POLICY "Users can manage their own deck templates" ON "DeckTemplate"
  FOR ALL USING ("userId" = auth.uid());

-- DeckFolderItem policies
CREATE POLICY "Users can view items in their deck folders" ON "DeckFolderItem"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "DeckFolder"
      WHERE "DeckFolder".id = "DeckFolderItem"."folderId"
      AND "DeckFolder"."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can manage items in their deck folders" ON "DeckFolderItem"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "DeckFolder"
      WHERE "DeckFolder".id = "DeckFolderItem"."folderId"
      AND "DeckFolder"."userId" = auth.uid()
    )
  );

-- SavedCardSearch policies
CREATE POLICY "Users can view their own saved searches" ON "SavedCardSearch"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can view public saved searches" ON "SavedCardSearch"
  FOR SELECT USING ("isPublic" = true);

CREATE POLICY "Users can manage their own saved searches" ON "SavedCardSearch"
  FOR ALL USING ("userId" = auth.uid());

-- ImportJob policies
CREATE POLICY "Users can view their own import jobs" ON "ImportJob"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own import jobs" ON "ImportJob"
  FOR ALL USING ("userId" = auth.uid());

-- ExportJob policies
CREATE POLICY "Users can view their own export jobs" ON "ExportJob"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own export jobs" ON "ExportJob"
  FOR ALL USING ("userId" = auth.uid());

-- PublicDeck policies (already public by nature)
CREATE POLICY "Anyone can view public decks" ON "PublicDeck"
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own public decks" ON "PublicDeck"
  FOR ALL USING ("userId" = auth.uid());

-- DeckComment policies
CREATE POLICY "Anyone can view comments on public decks" ON "DeckComment"
  FOR SELECT USING ("isDeleted" = false);

CREATE POLICY "Users can create comments" ON "DeckComment"
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY "Users can manage their own comments" ON "DeckComment"
  FOR UPDATE USING ("userId" = auth.uid());

-- UserProfile policies
CREATE POLICY "Anyone can view public profiles" ON "UserProfile"
  FOR SELECT USING ("isPublic" = true);

CREATE POLICY "Users can view their own profile" ON "UserProfile"
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can manage their own profile" ON "UserProfile"
  FOR ALL USING ("userId" = auth.uid());

-- UserFollow policies
CREATE POLICY "Anyone can view follows" ON "UserFollow"
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON "UserFollow"
  FOR ALL USING ("followerId" = auth.uid());

-- DeckLike policies
CREATE POLICY "Anyone can view deck likes" ON "DeckLike"
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own likes" ON "DeckLike"
  FOR ALL USING ("userId" = auth.uid());

-- CommentLike policies
CREATE POLICY "Anyone can view comment likes" ON "CommentLike"
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own comment likes" ON "CommentLike"
  FOR ALL USING ("userId" = auth.uid());

-- Grant necessary permissions to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions to anon users for public data
GRANT SELECT ON "Deck" TO anon;
GRANT SELECT ON "DeckCard" TO anon;
GRANT SELECT ON "PublicDeck" TO anon;
GRANT SELECT ON "DeckComment" TO anon;
GRANT SELECT ON "UserProfile" TO anon;
GRANT SELECT ON "DeckTemplate" TO anon;
GRANT SELECT ON "SavedCardSearch" TO anon;
