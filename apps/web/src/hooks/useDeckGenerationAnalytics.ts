import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { useEffect, useRef } from 'react';

interface DeckGenerationAnalyticsProps {
  commander: string;
  deckId?: string;
}

export function useDeckGenerationAnalytics({ commander, deckId }: DeckGenerationAnalyticsProps) {
  const { trackDeckGeneration, trackEvent } = useAnalytics();
  const startTimeRef = useRef<number>(Date.now());
  
  // Track generation start
  useEffect(() => {
    startTimeRef.current = Date.now();
    trackEvent('deck_generation_started', {
      commander,
      timestamp: new Date().toISOString(),
    });
  }, [commander]);
  
  // Track generation complete
  const trackComplete = (success: boolean) => {
    const duration = Date.now() - startTimeRef.current;
    trackDeckGeneration(commander, success, duration);
    
    if (success && deckId) {
      trackEvent('deck_created', {
        deck_id: deckId,
        commander,
        generation_time_ms: duration,
      });
    }
  };
  
  // Track retry
  const trackRetry = (attempt: number) => {
    trackEvent('deck_generation_retry', {
      commander,
      attempt,
      previous_duration_ms: Date.now() - startTimeRef.current,
    });
    startTimeRef.current = Date.now(); // Reset timer for retry
  };
  
  // Track card selection
  const trackCardSelection = (cardName: string, category: string) => {
    trackEvent('deck_card_selected', {
      commander,
      card_name: cardName,
      category,
    });
  };
  
  return {
    trackComplete,
    trackRetry,
    trackCardSelection,
  };
}
