#!/usr/bin/env node

/**
 * Email Function Deployment Script (CommonJS version)
 * 
 * This script helps deploy the email Edge Function and configure environment variables
 * for email notifications in the Analy-Ticket system.
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${description} completed successfully`);
  } catch (error) {
    console.error(`❌ Error during ${description.toLowerCase()}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('📧 Analy-Ticket Email Function Deployment');
  console.log('=====================================\n');
  
  console.log('This script will help you:');
  console.log('1. Deploy the send-email Edge Function to Supabase');
  console.log('2. Set up environment variables for SMTP');
  console.log('3. Test the email functionality\n');

  const proceed = await question('Do you want to continue? (y/N): ');
  if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
    console.log('Deployment cancelled.');
    rl.close();
    return;
  }

  try {
    // Step 1: Deploy the Edge Function
    console.log('\n📦 Step 1: Deploying Edge Function');
    console.log('-----------------------------------');
    
    runCommand(
      'npx supabase functions deploy send-email --no-verify-jwt',
      'Deploying send-email function'
    );

    // Step 2: Set up SMTP password
    console.log('\n🔐 Step 2: Configure SMTP Settings');
    console.log('----------------------------------');
    
    console.log('\nTo send emails, you need to configure your Outlook App Password.');
    console.log('If you haven\'t created one yet:');
    console.log('1. Go to https://account.microsoft.com/security');
    console.log('2. Click "App passwords"');
    console.log('3. Create a new app password for "Supabase Email Service"');
    console.log('4. Copy the generated password\n');

    const smtpPassword = await question('Enter your Outlook App Password: ');
    if (smtpPassword.trim()) {
      runCommand(
        `npx supabase secrets set SMTP_PASSWORD="${smtpPassword.trim()}"`,
        'Setting SMTP password'
      );
    } else {
      console.log('⚠️ SMTP password not set. You can set it later with:');
      console.log('npx supabase secrets set SMTP_PASSWORD="your-password"');
    }

    // Step 3: Verify deployment
    console.log('\n✅ Step 3: Verification');
    console.log('----------------------');
    
    runCommand(
      'npx supabase functions list',
      'Listing deployed functions'
    );

    console.log('\n🎉 Email Function Deployment Complete!');
    console.log('=====================================');
    
    console.log('\nNext steps:');
    console.log('1. Configure SMTP in Supabase Dashboard:');
    console.log('   - Go to Authentication > Settings > SMTP Settings');
    console.log('   - Enable "Enable custom SMTP"');
    console.log('   - Host: smtp-mail.outlook.com');
    console.log('   - Port: 587');
    console.log('   - User: felipe.henrique@analytichem.com');
    console.log('   - Pass: [Your App Password]');
    console.log('   - Sender: AnalytiChem - Sistema de Chamados');
    
    console.log('\n2. Test email functionality:');
    console.log('   - Create a new user in the admin panel');
    console.log('   - Check your email for the welcome message');
    console.log('   - Monitor console logs for success/error messages');

    console.log('\n3. Monitor function logs:');
    console.log('   - View logs in Supabase Dashboard > Functions > send-email > Logs');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure you have Supabase CLI installed');
    console.log('2. Ensure you\'re logged in: npx supabase login');
    console.log('3. Check your project is linked: npx supabase status');
    console.log('4. Try running commands manually from the "supabase" directory');
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
} 