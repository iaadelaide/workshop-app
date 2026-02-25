#!/usr/bin/env node

/**
 * Build Script for Netlify Deployment
 * Replaces Firebase configuration placeholders with environment variables
 */

const fs = require('fs');
const path = require('path');

console.log('🔨 Starting build process...');

// Check required environment variables
const requiredVars = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_DATABASE_URL',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these in your Netlify environment variables.');
    process.exit(1);
}

// Read config file
const configPath = path.join(__dirname, 'js', 'config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace placeholders with actual environment variables
const replacements = {
    '{{FIREBASE_API_KEY}}': process.env.FIREBASE_API_KEY,
    '{{FIREBASE_AUTH_DOMAIN}}': process.env.FIREBASE_AUTH_DOMAIN,
    '{{FIREBASE_DATABASE_URL}}': process.env.FIREBASE_DATABASE_URL,
    '{{FIREBASE_PROJECT_ID}}': process.env.FIREBASE_PROJECT_ID,
    '{{FIREBASE_STORAGE_BUCKET}}': process.env.FIREBASE_STORAGE_BUCKET,
    '{{FIREBASE_MESSAGING_SENDER_ID}}': process.env.FIREBASE_MESSAGING_SENDER_ID,
    '{{FIREBASE_APP_ID}}': process.env.FIREBASE_APP_ID
};

let replacementCount = 0;
for (const [placeholder, value] of Object.entries(replacements)) {
    if (configContent.includes(placeholder)) {
        configContent = configContent.replace(new RegExp(placeholder, 'g'), value);
        replacementCount++;
        console.log(`✅ Replaced ${placeholder.replace(/[{}]/g, '')}`);
    }
}

// Verify all placeholders were replaced
const remainingPlaceholders = configContent.match(/\{\{[A-Z_]+\}\}/g);
if (remainingPlaceholders) {
    console.error('❌ Unresolved placeholders found:');
    remainingPlaceholders.forEach(p => console.error(`   - ${p}`));
    process.exit(1);
}

// Write updated config file
fs.writeFileSync(configPath, configContent, 'utf8');

console.log(`\n✅ Build complete! Replaced ${replacementCount} configuration values.`);
console.log('📦 Application is ready for deployment.\n');
