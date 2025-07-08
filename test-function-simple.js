// Simple test for the Supabase Edge Function
const fetch = require('node-fetch');

async function testEmailFunction() {
    console.log('🧪 Testing Supabase Edge Function...\n');
    
    const url = 'https://plbmgjqitlxedsmdqpld.supabase.co/functions/v1/send-email';
    const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U';
    
    const emailData = {
        to: 'felipe.henrique@analytichem.com',
        subject: 'Test Email from Analy-Ticket Function',
        html: `
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>🎉 Email Function Test</h2>
                    <p>This is a test email from the Analy-Ticket Edge Function.</p>
                    <p><strong>If you receive this email, the function is working correctly!</strong></p>
                    <hr>
                    <p><small>Sent at: ${new Date().toISOString()}</small></p>
                </body>
            </html>
        `,
        text: 'Test email from Analy-Ticket Edge Function. If you receive this, the function is working!'
    };
    
    try {
        console.log('📡 Sending request to:', url);
        console.log('📧 Sending to:', emailData.to);
        console.log('📝 Subject:', emailData.subject);
        console.log('');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(emailData)
        });
        
        console.log('📊 Response Status:', response.status);
        console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));
        
        const result = await response.text();
        console.log('📊 Response Body:', result);
        
        if (response.ok) {
            console.log('\n✅ SUCCESS! Email function is working.');
            console.log('Check your email inbox (and spam folder).');
        } else {
            console.log('\n❌ ERROR: Function call failed.');
            
            // Try to parse as JSON for better error info
            try {
                const jsonResult = JSON.parse(result);
                if (jsonResult.code === 'BOOT_ERROR') {
                    console.log('\n🔍 DIAGNOSIS: Function failed to start.');
                    console.log('   Most likely causes:');
                    console.log('   • SMTP password not set or incorrect');
                    console.log('   • App Password not created in Microsoft account');
                    console.log('   • Network connectivity issues');
                }
            } catch (e) {
                // Response wasn't JSON
            }
        }
        
    } catch (error) {
        console.log('\n❌ NETWORK ERROR:', error.message);
        console.log('\n🔍 POSSIBLE CAUSES:');
        console.log('   • Internet connectivity issues');
        console.log('   • Supabase service unavailable');
        console.log('   • Incorrect Edge Function URL');
        console.log('   • Corporate firewall blocking request');
    }
}

// Run the test
testEmailFunction().catch(console.error); 