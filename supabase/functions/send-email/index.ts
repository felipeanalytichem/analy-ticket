import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📧 Email function called')
    
    // Parse request body
    const { to, subject, html, text }: EmailRequest = await req.json()

    // Validate required fields
    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    console.log(`📧 Resend API key found: ${resendApiKey ? 'Yes' : 'No'}`)
    
    if (resendApiKey) {
      console.log(`📧 API key format: ${resendApiKey.substring(0, 5)}...${resendApiKey.substring(resendApiKey.length - 4)}`)
    }

    // Try Resend API
    if (resendApiKey && resendApiKey.startsWith('re_') && resendApiKey.length > 20) {
      try {
        console.log('📤 Calling Resend API...')
        
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'ACS Ticket System <onboarding@resend.dev>',
            to: [to],
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, '').trim()
          }),
        })

        console.log(`📧 Resend response: ${resendResponse.status} ${resendResponse.statusText}`)
        
        const responseText = await resendResponse.text()
        console.log(`📧 Resend body: ${responseText}`)

        if (resendResponse.ok) {
          const result = JSON.parse(responseText)
          console.log(`✅ Email sent successfully! ID: ${result.id}`)
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Email sent successfully via Resend API',
              to: to,
              subject: subject,
              messageId: result.id,
              service: 'Resend API'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          console.error('❌ Resend API error:', responseText)
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Resend API failed',
              details: responseText
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } catch (error) {
        console.error('❌ Resend API call failed:', error)
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to call Resend API',
            details: error.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      console.error('❌ Invalid or missing Resend API key')
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or missing Resend API key',
          configured: !!resendApiKey,
          keyFormat: resendApiKey ? 'Check key format' : 'Not configured'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Function error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Function execution failed',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Send email using Outlook/Office 365 via Email API Service
 * Since Edge Functions don't support native SMTP, we use an email service
 */
async function sendOutlookEmail(
  config: { host: string; port: number; username: string; password: string; fromEmail: string },
  email: { to: string; subject: string; html: string; text: string }
): Promise<{ success: boolean; error?: string; messageId?: string; details?: string }> {
  
  try {
    console.log('📨 Configuring Outlook email send:', {
      host: config.host,
      port: config.port,
      username: config.username,
      fromEmail: config.fromEmail
    });

    // Method 1: Try using EmailJS (free service that supports Outlook SMTP)
    try {
      console.log('📧 Attempting via EmailJS service...');
      
      const emailJSResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: 'outlook',
          template_id: 'template_custom',
          user_id: 'your_emailjs_user_id', // This would need to be configured
          template_params: {
            to_email: email.to,
            from_email: config.fromEmail,
            subject: email.subject,
            message_html: email.html,
            message_text: email.text
          }
        }),
      });

      if (emailJSResponse.ok) {
        console.log('✅ Email sent via EmailJS');
        return { 
          success: true, 
          messageId: 'emailjs-' + Date.now(),
          details: 'Sent via EmailJS service'
        };
      } else {
        console.log('EmailJS failed, trying alternative...');
      }
    } catch (emailJSError) {
      console.log('EmailJS not available, trying alternative...');
    }

    // Method 2: Use a simple mail service (like Formspree or similar)
    try {
      console.log('📧 Using alternative email service...');
      
      // Create a simple email payload
      const emailData = new FormData();
      emailData.append('to', email.to);
      emailData.append('subject', email.subject);
      emailData.append('html', email.html);
      emailData.append('text', email.text);
      emailData.append('from', config.fromEmail);
      
      // For now, we'll simulate the send since we need a proper SMTP service
      console.log('📧 Email prepared for Outlook SMTP delivery');
      console.log(`   From: ${config.fromEmail}`);
      console.log(`   To: ${email.to}`);
      console.log(`   Subject: ${email.subject}`);
      console.log(`   Via: ${config.host}:${config.port}`);
      
      // Since Deno Edge Functions don't support native SMTP libraries,
      // return honest failure instead of fake success
      console.log('❌ SMTP not available in Edge Functions environment');
      console.log('💡 Use email service APIs (like Resend) for reliable delivery');
      
      return { 
        success: false, 
        error: 'SMTP not available in Edge Functions environment. Use Resend API for reliable email delivery.',
        details: 'Edge Functions require email service APIs, not native SMTP libraries'
      };
      
    } catch (alternativeError) {
      console.error('Alternative email method failed:', alternativeError);
      return { 
        success: false, 
        error: 'All email delivery methods failed' 
      };
    }

  } catch (error) {
    console.error('❌ Outlook email error:', error);
    return { 
      success: false, 
      error: error.message || 'Outlook email configuration failed' 
    };
  }
}

/**
 * Generate plain text version from HTML
 */
function generateTextFromHtml(html: string): string {
  // Simple HTML to text conversion
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
} 