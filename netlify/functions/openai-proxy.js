/**
 * OpenAI API Proxy
 * Securely calls OpenAI API without exposing keys to client
 */

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle OPTIONS preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Validate API key is configured
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('{{')) {
            throw new Error('OpenAI API key not configured');
        }

        const { prompt, maxTokens = 200 } = JSON.parse(event.body);

        if (!prompt) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Prompt is required' })
            };
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            // Call OpenAI API
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that extracts themes from transcripts. Return only a JSON array of 3-5 short theme labels.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: maxTokens,
                    temperature: 0.7
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const error = await response.json();
                console.error('OpenAI API error:', error);
                throw new Error('OpenAI API request failed');
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content || '[]';

            // Try to parse as JSON array
            let themes;
            try {
                themes = JSON.parse(content);
            } catch (e) {
                // If not valid JSON, try to extract themes from text
                themes = content
                    .split('\n')
                    .filter(line => line.trim())
                    .slice(0, 5);
            }

            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    themes,
                    usage: data.usage
                })
            };
        } catch (fetchError) {
            clearTimeout(timeout);
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timeout - OpenAI API took too long to respond');
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('Error in OpenAI proxy:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to generate themes',
                message: error.message
            })
        };
    }
};
