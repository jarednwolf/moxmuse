import { generateAffiliateUrl, type AffiliatePartner } from '@moxmuse/shared'

export const affiliateService = {
  async generateLink(
    cardId: string,
    cardName: string,
    userId: string
  ): Promise<string> {
    // Determine best affiliate partner based on availability and rates
    const partner = await this.selectBestPartner(cardName)
    
    if (!partner) {
      throw new Error('No affiliate partner available')
    }

    const affiliateId = this.getAffiliateId(partner)
    const productId = await this.getProductId(partner, cardName)

    return generateAffiliateUrl(partner, productId, affiliateId)
  },

  async selectBestPartner(cardName: string): Promise<AffiliatePartner | null> {
    // In production, this would check real-time availability and rates
    // For now, use a simple priority order
    const partners: AffiliatePartner[] = ['tcgplayer', 'cardkingdom', 'channelfireball']
    
    for (const partner of partners) {
      if (this.getAffiliateId(partner)) {
        // Check if partner has the card in stock
        const hasCard = await this.checkAvailability(partner, cardName)
        if (hasCard) return partner
      }
    }

    return null
  },

  getAffiliateId(partner: AffiliatePartner): string {
    const ids = {
      tcgplayer: process.env.TCGPLAYER_AFFILIATE_ID,
      cardkingdom: process.env.CARDKINGDOM_AFFILIATE_ID,
      channelfireball: process.env.CHANNELFIREBALL_AFFILIATE_ID,
    }

    return ids[partner] || ''
  },

  async getProductId(partner: AffiliatePartner, cardName: string): Promise<string> {
    // In production, this would query partner APIs to get product IDs
    // For now, return a placeholder
    switch (partner) {
      case 'tcgplayer':
        // TCGPlayer uses numeric product IDs
        return '123456' // Placeholder
      case 'cardkingdom':
        // Card Kingdom uses URL-safe card names
        return cardName.toLowerCase().replace(/[^a-z0-9]/g, '-')
      case 'channelfireball':
        // Channel Fireball uses similar to Card Kingdom
        return cardName.toLowerCase().replace(/[^a-z0-9]/g, '-')
      default:
        return cardName
    }
  },

  async checkAvailability(partner: AffiliatePartner, cardName: string): Promise<boolean> {
    // In production, this would check partner inventory APIs
    // For now, assume all cards are available
    return true
  },

  async trackConversion(
    userId: string,
    cardId: string,
    partner: AffiliatePartner,
    purchaseAmount?: number
  ): Promise<void> {
    // This would integrate with partner conversion tracking APIs
    console.log('Tracking conversion:', { userId, cardId, partner, purchaseAmount })
  },
} 