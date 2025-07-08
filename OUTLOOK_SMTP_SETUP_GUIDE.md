# 📧 Outlook SMTP Setup Guide - Complete Configuration

## 🎯 **You're Right to Use Outlook!**

I've **updated the email function to prioritize Outlook SMTP** over other services. This guide will help you configure your existing Outlook account for email delivery.

---

## ✅ **What's Already Configured**
- ✅ `SMTP_PASSWORD` - You already have this set
- ✅ `SMTP_HOST` - Set to `smtp-mail.outlook.com`  
- ✅ `FROM_EMAIL` - Set to `suporte@analytichem.com`
- ⚠️ **Missing**: `SMTP_USERNAME` (your Outlook email address)

---

## 🔧 **Step 1: Get Your App Password (Most Important)**

**⚠️ Critical**: You **cannot** use your regular Outlook password for SMTP. You need an **App Password**.

### **For Office 365 Business Accounts (Recommended):**

1. **Go to Office Admin**: https://admin.microsoft.com/
2. **Admin Centers** → **Exchange**
3. **Mail flow** → **Connectors** 
4. **Create authenticated SMTP** for your domain
5. **Get the SMTP credentials** provided

### **For Personal Outlook.com Accounts:**

1. **Go to Security**: https://account.microsoft.com/security
2. **Sign-in options** → **App passwords**
3. **Create new app password**
4. **Name it**: `ACS-Ticket-System`
5. **Copy the generated password** (16 characters, like: `abcd efgh ijkl mnop`)

### **For Azure AD / Office 365:**

1. **Go to Azure Portal**: https://portal.azure.com/
2. **Azure Active Directory** → **Users**
3. **Select your user** → **Authentication methods**
4. **App passwords** → **Create**
5. **Copy the generated password**

---

## 🔧 **Step 2: Configure Your Email Address**

**Replace with your actual Outlook email:**

```bash
npx supabase secrets set SMTP_USERNAME=your-actual-email@analytichem.com --project-ref plbmgjqitlxedsmdqpld
```

**Examples:**
- If using `felipe@analytichem.com`: 
  ```bash
  npx supabase secrets set SMTP_USERNAME=felipe@analytichem.com --project-ref plbmgjqitlxedsmdqpld
  ```
- If using `suporte@analytichem.com`:
  ```bash
  npx supabase secrets set SMTP_USERNAME=suporte@analytichem.com --project-ref plbmgjqitlxedsmdqpld
  ```

---

## 🔧 **Step 3: Update Your App Password (If Needed)**

**If your current SMTP_PASSWORD is a placeholder or old:**

```bash
npx supabase secrets set SMTP_PASSWORD=your-16-char-app-password --project-ref plbmgjqitlxedsmdqpld
```

**Example:**
```bash
npx supabase secrets set SMTP_PASSWORD=abcd efgh ijkl mnop --project-ref plbmgjqitlxedsmdqpld
```

---

## 🧪 **Step 4: Test Email Delivery**

1. **Go to your app**: https://acsticket-nolllpxx3-felipeanalytichems-projects.vercel.app
2. **Admin Dashboard** → **User Management**
3. **Create new user** with a real email address
4. **Check your email inbox**

**Expected Result**:
- ✅ Email delivered to real inbox
- ✅ Console shows: `"✅ Email sent successfully via Outlook SMTP"`
- ✅ Service shows: `"Outlook SMTP"`

---

## 📋 **Current Configuration Summary**

After setup, your configuration will be:

| Setting | Value | Status |
|---------|-------|--------|
| **SMTP_HOST** | `smtp-mail.outlook.com` | ✅ Configured |
| **SMTP_PORT** | `587` | ✅ Configured |
| **SMTP_USERNAME** | `your-email@analytichem.com` | ⚠️ **Need to set** |
| **SMTP_PASSWORD** | `your-16-char-app-password` | ⚠️ **Verify this** |
| **FROM_EMAIL** | `suporte@analytichem.com` | ✅ Configured |

---

## 🔍 **Troubleshooting**

### **❌ Issue**: Still in simulation mode
```
"message": "Email processed successfully (simulation mode)"
```
**✅ Solutions**:
1. Make sure `SMTP_USERNAME` is set to your actual email
2. Verify `SMTP_PASSWORD` is an App Password (not regular password)
3. Check the configuration in function logs

### **❌ Issue**: "Authentication failed"
**✅ Solutions**:
- **Generate new App Password** - old ones might be expired
- **Enable SMTP** in your Office 365 admin settings
- **Check email permissions** in Azure AD
- **Verify email address** is exactly correct

### **❌ Issue**: "SMTP not fully configured"
**✅ Check the logs**:
```
⚠️ Outlook SMTP not fully configured
  - Missing SMTP_USERNAME
  - Missing or placeholder SMTP_PASSWORD
```
**Solution**: Follow steps 2 and 3 above

### **❌ Issue**: Domain authentication problems
**✅ Solutions**:
- **Use the email that matches your domain** (analytichem.com)
- **Contact IT admin** for business account App Password
- **Check Exchange Online settings** for SMTP auth

---

## 🔐 **Security Best Practices**

1. **Use App Passwords** - Never use your regular password
2. **Rotate passwords regularly** - Generate new App Passwords quarterly  
3. **Monitor usage** - Check Office 365 admin for SMTP usage
4. **Use business email** - Avoid personal Outlook.com for business
5. **Enable MFA** - Keep your main account secure

---

## 💡 **Why Outlook SMTP?**

**Advantages for your business:**
- ✅ **Already have it** - Using existing infrastructure
- ✅ **Professional sender** - Emails from your domain
- ✅ **Good deliverability** - Microsoft's email reputation
- ✅ **No additional cost** - Part of Office 365
- ✅ **Enterprise features** - Compliance, archiving, etc.

**vs. Resend:**
- Outlook: Use existing business email account
- Resend: Need separate service (but easier setup)

---

## 📊 **SMTP Settings Reference**

**Outlook/Office 365 SMTP:**
- **Server**: `smtp-mail.outlook.com` or `smtp.office365.com`
- **Port**: `587` (STARTTLS) or `25`
- **Security**: STARTTLS 
- **Authentication**: Required (App Password)
- **Username**: Full email address
- **Password**: App Password (16 characters)

---

## 🎯 **Next Steps**

After completing the setup:

1. **Test thoroughly** - Send emails to different providers (Gmail, Yahoo, etc.)
2. **Monitor delivery** - Check Office 365 admin for email flow
3. **Set up SPF/DKIM** - Improve deliverability (IT admin task)
4. **Train users** - How to handle invitation emails
5. **Scale monitoring** - Set up alerts for failed deliveries

---

## 📞 **Need Help?**

**IT Admin Tasks:**
- Setting up App Passwords in business accounts
- Configuring Exchange Online SMTP
- Domain authentication (SPF, DKIM, DMARC)

**Quick Test Command:**
```bash
# Check current configuration
npx supabase secrets list --project-ref plbmgjqitlxedsmdqpld
```

**Expected to see:**
- `SMTP_USERNAME` with your email
- `SMTP_PASSWORD` with App Password  
- `SMTP_HOST` with Outlook server

---

**🔄 Status**: Ready to configure  
**⏱️ Setup Time**: ~10 minutes  
**💰 Cost**: Free (using existing Office 365)  
**🚀 Result**: Professional email delivery via your Outlook account 