import { TwitterSentimentResult } from '@/types/analyze';

function mapSymbolToQuery(symbol: string): string {
  const mapping: Record<string, string> = {
    BTCUSDT: 'bitcoin OR btc price trend',
    ETHUSDT: 'ethereum OR eth price trend',
    SOLUSDT: 'solana OR sol crypto trend',
  };
  return mapping[symbol] || `${symbol} crypto trend`;
}

function classifySentiment(text: string): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
  const lowerText = text.toLowerCase();

  const positiveKeywords = [
    'bullish',
    'pump',
    'moon',
    'buy',
    'long',
    'breakout',
    'surge',
    'rally',
    'higher',
    'up',
    'gain',
    'profit',
    'bull',
    'green',
    'ath',
    'strong',
    '🚀',
    '📈',
    '💎',
    '🔥',
    '💪',
    '🟢',
  ];

  const negativeKeywords = [
    'bearish',
    'dump',
    'crash',
    'sell',
    'short',
    'breakdown',
    'drop',
    'fall',
    'lower',
    'down',
    'loss',
    'bear',
    'red',
    'weak',
    'fear',
    'scam',
    '📉',
    '🔴',
    '💀',
    '⚠️',
  ];

  let positiveScore = 0;
  let negativeScore = 0;

  for (const keyword of positiveKeywords) {
    if (lowerText.includes(keyword)) positiveScore++;
  }

  for (const keyword of negativeKeywords) {
    if (lowerText.includes(keyword)) negativeScore++;
  }

  if (positiveScore > negativeScore) return 'POSITIVE';
  if (negativeScore > positiveScore) return 'NEGATIVE';
  return 'NEUTRAL';
}

export async function getTwitterSentiment(symbol: string): Promise<TwitterSentimentResult | null> {
  const query = mapSymbolToQuery(symbol);

  const rapidApiKey = process.env.RAPIDAPI_KEY;

  if (!rapidApiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://twitter241.p.rapidapi.com/search?type=Top&count=20&query=${encodeURIComponent(query)}`,
      {
        headers: {
          'x-rapidapi-host': 'twitter241.p.rapidapi.com',
          'x-rapidapi-key': rapidApiKey,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const tweets: TwitterSentimentResult['tweets'] = [];

    const entries = data?.result?.timeline?.instructions?.[0]?.entries || [];

    for (const entry of entries) {
      const tweetResult = entry?.content?.itemContent?.tweet_results?.result;
      if (!tweetResult) continue;

      const legacy = tweetResult.legacy;
      const userLegacy = tweetResult.core?.user_results?.result?.legacy;

      if (!legacy || !userLegacy) continue;

      const text = legacy.full_text || '';
      const sentiment = classifySentiment(text);

      tweets.push({
        id: legacy.id_str || entry.entryId,
        text: text.slice(0, 280),
        author: userLegacy.name || 'Unknown',
        createdAt: legacy.created_at || new Date().toISOString(),
        sentiment,
      });
    }

    const positive = tweets.filter((t) => t.sentiment === 'POSITIVE').length;
    const negative = tweets.filter((t) => t.sentiment === 'NEGATIVE').length;
    const neutral = tweets.filter((t) => t.sentiment === 'NEUTRAL').length;
    const total = tweets.length;

    let overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidencePercent = 50;

    if (total > 0) {
      const positiveRatio = positive / total;
      const negativeRatio = negative / total;

      if (positiveRatio > 0.5) {
        overallSentiment = 'BULLISH';
        confidencePercent = Math.round(positiveRatio * 100);
      } else if (negativeRatio > 0.5) {
        overallSentiment = 'BEARISH';
        confidencePercent = Math.round(negativeRatio * 100);
      } else {
        confidencePercent = Math.round(Math.max(positiveRatio, negativeRatio) * 100);
      }
    }

    return {
      query,
      totalCount: total,
      positive,
      negative,
      neutral,
      overallSentiment,
      confidencePercent,
      tweets: tweets.slice(0, 10),
    };
  } catch {
    return null;
  }
}
