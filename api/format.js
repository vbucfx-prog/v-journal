export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'No prompt provided' }), { status: 400, headers: corsHeaders });
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: 'You are a trading journal formatter. The user trades NQ/ES futures using ICT/SMC concepts: SMT (Smart Money Technique), HVB (High Volume Bar), AMD (Accumulation/Manipulation/Distribution), POI (Point of Interest), Fibonacci, OHLC, orderflow, HTF (higher timeframe), LTF (lower timeframe), and similar concepts. Format their raw notes into clean structured journal entries. Preserve their exact terminology. Be concise and direct.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: 'Upstream error', detail: err }), { status: 502, headers: corsHeaders });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return new Response(JSON.stringify({ text }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
