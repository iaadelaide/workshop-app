/**
 * Whisper API Proxy
 * Securely calls OpenAI Whisper API for audio transcription
 */

const FormData = require('form-data');
const fetch = require('node-fetch');

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

        // Parse multipart form data
        const contentType = event.headers['content-type'];

        if (!contentType || !contentType.includes('multipart/form-data')) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' })
            };
        }

        // Get audio file from request
        const body = Buffer.from(event.body, 'base64');

        // Create form data for Whisper API
        const formData = new FormData();
        formData.append('file', body, {
            filename: 'audio.webm',
            contentType: 'audio/webm'
        });
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');

        // Call Whisper API with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout for audio

        try {
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    ...formData.getHeaders()
                },
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const error = await response.json();
                console.error('Whisper API error:', error);
                throw new Error('Whisper API request failed');
            }

            const data = await response.json();

            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transcript: data.text,
                    duration: data.duration
                })
            };
        } catch (fetchError) {
            clearTimeout(timeout);
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timeout - audio transcription took too long');
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('Error in Whisper proxy:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to transcribe audio',
                message: error.message
            })
        };
    }
};
