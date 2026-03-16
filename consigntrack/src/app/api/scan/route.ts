import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image, knownSkus } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Build the known SKUs context for Claude
    const skuList = knownSkus?.length
      ? `Here are the known SKU codes in our system:\n${knownSkus.map((s: { sku_code: string; name: string }) => `- ${s.sku_code}: ${s.name}`).join('\n')}`
      : 'No known SKU list provided.';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.mediaType || 'image/jpeg',
                data: image.data,
              },
            },
            {
              type: 'text',
              text: `You are an inventory scanning assistant. Analyze this image and identify all product SKU codes, barcodes, or product identifiers visible.

${skuList}

For each product/item you can identify:
1. Extract the SKU code, barcode number, or product identifier
2. Try to match it to the known SKU list if provided
3. Count how many units of each item are visible if possible

Return your response as a JSON array with this exact format:
[
  {
    "sku_code": "the SKU code or barcode you identified",
    "matched_sku": "the matching known SKU code if found, or null",
    "quantity": 1,
    "confidence": "high" | "medium" | "low",
    "notes": "any relevant notes about the identification"
  }
]

If you cannot identify any SKUs or barcodes, return an empty array [].
Only return the JSON array, no other text.`,
            },
          ],
        },
      ],
    });

    // Extract the text response
    const textBlock = response.content.find((block) => block.type === 'text');
    const responseText = textBlock ? textBlock.text : '[]';

    // Parse the JSON from the response
    let results;
    try {
      // Try to extract JSON from the response (Claude might wrap it in markdown)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      results = [];
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
