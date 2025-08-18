#!/usr/bin/env node

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration for required icons
const ICON_CONFIGS = [
  {
    name: 'apple-touch-icon.png',
    size: 180,
    description: 'Apple Touch Icon'
  },
  {
    name: 'icon-192x192.png', 
    size: 192,
    description: 'PWA Icon 192x192'
  },
  {
    name: 'icon-512x512.png',
    size: 512, 
    description: 'PWA Icon 512x512'
  }
];

const SOURCE_SVG = path.join(__dirname, '../public/icons/icon-base.svg');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

/**
 * Validates that the source SVG exists
 */
async function validateSourceSVG() {
  try {
    await fs.access(SOURCE_SVG);
    console.log('✓ Source SVG found:', SOURCE_SVG);
    return true;
  } catch (error) {
    console.error('✗ Source SVG not found:', SOURCE_SVG);
    return false;
  }
}

/**
 * Ensures the output directory exists
 */
async function ensureOutputDirectory() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log('✓ Output directory ready:', OUTPUT_DIR);
    return true;
  } catch (error) {
    console.error('✗ Failed to create output directory:', error.message);
    return false;
  }
}

/**
 * Generates a PNG icon from SVG at the specified size
 */
async function generateIcon(config) {
  const outputPath = path.join(OUTPUT_DIR, config.name);
  
  try {
    console.log(`Generating ${config.description} (${config.size}x${config.size})...`);
    
    await sharp(SOURCE_SVG)
      .resize(config.size, config.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({
        quality: 100,
        compressionLevel: 6
      })
      .toFile(outputPath);
    
    // Verify the generated file
    const stats = await fs.stat(outputPath);
    console.log(`✓ Generated ${config.name} (${Math.round(stats.size / 1024)}KB)`);
    
    return true;
  } catch (error) {
    console.error(`✗ Failed to generate ${config.name}:`, error.message);
    return false;
  }
}

/**
 * Validates that a generated icon exists and has reasonable size
 */
async function validateGeneratedIcon(config) {
  const iconPath = path.join(OUTPUT_DIR, config.name);
  
  try {
    const stats = await fs.stat(iconPath);
    
    if (stats.size < 100) {
      console.warn(`⚠ Warning: ${config.name} seems too small (${stats.size} bytes)`);
      return false;
    }
    
    // Verify it's a valid PNG by reading metadata
    const metadata = await sharp(iconPath).metadata();
    
    if (metadata.width !== config.size || metadata.height !== config.size) {
      console.error(`✗ ${config.name} has incorrect dimensions: ${metadata.width}x${metadata.height}, expected ${config.size}x${config.size}`);
      return false;
    }
    
    console.log(`✓ Validated ${config.name}: ${metadata.width}x${metadata.height}, ${Math.round(stats.size / 1024)}KB`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to validate ${config.name}:`, error.message);
    return false;
  }
}

/**
 * Main icon generation function
 */
async function generateMissingIcons() {
  console.log('🎨 Starting icon generation process...\n');
  
  // Validate prerequisites
  if (!(await validateSourceSVG())) {
    process.exit(1);
  }
  
  if (!(await ensureOutputDirectory())) {
    process.exit(1);
  }
  
  let successCount = 0;
  let totalCount = ICON_CONFIGS.length;
  
  // Generate each required icon
  for (const config of ICON_CONFIGS) {
    const iconPath = path.join(OUTPUT_DIR, config.name);
    
    // Check if icon already exists
    try {
      await fs.access(iconPath);
      console.log(`ℹ ${config.name} already exists, regenerating...`);
    } catch {
      // Icon doesn't exist, which is expected
    }
    
    if (await generateIcon(config)) {
      if (await validateGeneratedIcon(config)) {
        successCount++;
      }
    }
    
    console.log(''); // Add spacing between icons
  }
  
  // Summary
  console.log('📊 Generation Summary:');
  console.log(`✓ Successfully generated: ${successCount}/${totalCount} icons`);
  
  if (successCount === totalCount) {
    console.log('🎉 All manifest icons generated successfully!');
    return true;
  } else {
    console.log('⚠ Some icons failed to generate. Check the errors above.');
    return false;
  }
}

/**
 * Validates all manifest icons exist
 */
async function validateAllManifestIcons() {
  console.log('\n🔍 Validating all manifest icons...');
  
  let allValid = true;
  
  for (const config of ICON_CONFIGS) {
    if (!(await validateGeneratedIcon(config))) {
      allValid = false;
    }
  }
  
  if (allValid) {
    console.log('✅ All manifest icons are valid and accessible!');
  } else {
    console.log('❌ Some manifest icons are missing or invalid.');
  }
  
  return allValid;
}

// Run the script if called directly
console.log('Script starting...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);
console.log('Comparison:', import.meta.url === `file://${process.argv[1]}`);

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const success = await generateMissingIcons();
    
    if (success) {
      await validateAllManifestIcons();
      console.log('\n🚀 Icon generation completed successfully!');
      process.exit(0);
    } else {
      console.log('\n💥 Icon generation failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Unexpected error during icon generation:', error);
    process.exit(1);
  }
}

// Export functions for testing
export {
  generateMissingIcons,
  validateAllManifestIcons,
  ICON_CONFIGS
};