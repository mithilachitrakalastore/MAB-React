import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const APP_NAME = 'Mithila Chitrakala Store';
const EMAIL_SENDERS = {
    hello: process.env.EMAIL_HELLO || 'hello@mithilachitrakalastore.com.np',
    orders: process.env.EMAIL_ORDERS || 'orders@mithilachitrakalastore.com.np',
    support: process.env.EMAIL_SUPPORT || 'support@mithilachitrakalastore.com.np',
    security: process.env.EMAIL_SECURITY || 'security@mithilachitrakalastore.com.np',
};
const RESEND_TEMPLATES = {
    welcome: process.env.RESEND_TEMPLATE_WELCOME || '',
    verification: process.env.RESEND_TEMPLATE_VERIFICATION || '',
    passwordReset: process.env.RESEND_TEMPLATE_PASSWORD_RESET || '',
    orderConfirmation: process.env.RESEND_TEMPLATE_ORDER_CONFIRMATION || '',
    orderStatus: process.env.RESEND_TEMPLATE_ORDER_STATUS || '',
    shipping: process.env.RESEND_TEMPLATE_SHIPPING || '',
    support: process.env.RESEND_TEMPLATE_SUPPORT || '',
};
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL_TOKEN_SECRET = process.env.ADMIN_EMAIL_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const EMAIL_OTP_SECRET = process.env.EMAIL_OTP_SECRET || ADMIN_EMAIL_TOKEN_SECRET;
const EMAIL_OTP_TTL_MINUTES = 10;
const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_OTP_MAX_ATTEMPTS = 5;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// We recommend using the SERVICE_ROLE_KEY here for secure backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const fallbackGeminiModel = 'gemini-3-flash-preview';

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
}
if (!geminiApiKey) {
    console.error("Missing Gemini API credentials in .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenAI({ apiKey: geminiApiKey });

const hashPassword = (pwd) => btoa(`mcs-salt-${pwd}`);
const hashEmailVerificationCode = (userId, code) => crypto
    .createHmac('sha256', EMAIL_OTP_SECRET)
    .update(`${userId}:${code}`)
    .digest('hex');
const describeSupabaseError = (error) => [
    error.message,
    error.code ? `Code: ${error.code}` : '',
    error.details ? `Details: ${error.details}` : '',
    error.hint ? `Hint: ${error.hint}` : ''
].filter(Boolean).join(' ');

const createAdminEmailToken = (adminId) => {
    if (!ADMIN_EMAIL_TOKEN_SECRET) return '';
    const payload = Buffer.from(JSON.stringify({
        sub: String(adminId),
        exp: Date.now() + (12 * 60 * 60 * 1000),
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', ADMIN_EMAIL_TOKEN_SECRET).update(payload).digest('base64url');
    return `${payload}.${signature}`;
};

const getAdminEmailTokenSubject = (req) => {
    if (!ADMIN_EMAIL_TOKEN_SECRET) return null;
    const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', ADMIN_EMAIL_TOKEN_SECRET).update(payload).digest();
    const providedSignature = Buffer.from(signature, 'base64url');
    if (providedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(providedSignature, expectedSignature)) return null;

    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!decoded.sub || !Number.isFinite(decoded.exp) || decoded.exp <= Date.now()) return null;
        return String(decoded.sub);
    } catch {
        return null;
    }
};

const getActiveAdminForEmailRequest = async (req) => {
    const adminId = getAdminEmailTokenSubject(req);
    if (!adminId) return { error: 'A valid admin session is required.', status: ADMIN_EMAIL_TOKEN_SECRET ? 401 : 503 };

    const { data: admin, error } = await supabase
        .from('users')
        .select('id, role, status')
        .eq('id', adminId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
        return { error: 'Only active administrators can use manual email tools.', status: 403 };
    }
    return { admin };
};

const createSlug = (value) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const normalizeProductData = (productData = {}) => {
    const toTagList = (value) => String(value ?? '')
        .split(/[\n,|·]+/)
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    const customTags = Array.isArray(productData.custom_tags)
        ? productData.custom_tags
        : toTagList(productData.custom_tags || productData.tags || '');
    const advancePercentage = Number(productData.advance_percentage ?? 0);
    if (!Number.isFinite(advancePercentage) || advancePercentage < 0 || advancePercentage > 100) {
        throw new Error('Advance payment percentage must be between 0 and 100.');
    }

    return {
        ...productData,
        storeName: String(productData.storeName || '').trim(),
        name: String(productData.name || '').trim(),
        product_code: String(productData.product_code || '').trim(),
        key_features: String(productData.key_features || '').trim(),
        compare_price: Number(productData.compare_price ?? productData.original_price ?? productData.mrp ?? 0) || 0,
        custom_tags: customTags.join(' · '),
        visible_to_users: Boolean(productData.visible_to_users),
        price: Number(productData.price ?? 0) || 0,
        advance_percentage: advancePercentage,
        stock: Number(productData.stock ?? 0) || 0,
        tags: Array.isArray(productData.tags)
            ? productData.tags.join(', ')
            : String(productData.tags || '').trim(),
    };
};

const getFrontendBaseUrl = (req) => {
    const configuredBaseUrl = process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || process.env.VITE_FRONTEND_URL;
    if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '');
    if (process.env.NODE_ENV === 'production') {
        return 'https://mithilachitrakalastore.com.np';
    }
    return `${req.protocol}://${req.get('host')}`.replace(/\/+$/, '');
};

const getPaymentCallbackBaseUrl = (req) => (
    process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`
).replace(/\/+$/, '');

const getKhaltiApiBaseUrl = () => (
    process.env.KHALTI_BASE_URL || 'https://a.khalti.com/api/v2'
).replace(/\/+$/, '');

const getEsewaCredentials = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const productCode = process.env.ESEWA_PRODUCT_CODE || process.env.PRODUCT_CODE || (isProduction ? '' : 'EPAYTEST');
    const secretKey = process.env.ESEWA_SECRET_KEY || (isProduction ? '' : '8gBm/:&EnhH.1/q');
    if (!productCode || !secretKey) {
        throw new Error('eSewa is not configured on the server. Set ESEWA_PRODUCT_CODE and ESEWA_SECRET_KEY.');
    }
    return { productCode, secretKey };
};

const escapeHtml = (value = '') => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const htmlToPlainText = (html = '') => String(html)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();

const formatDisplayDate = (dateValue, fallback = new Date()) => {
    const date = dateValue ? new Date(dateValue) : new Date(fallback);
    if (Number.isNaN(date.getTime())) return String(dateValue || new Date().toISOString());
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};

const buildEmailTemplateVariables = ({ userName = 'Customer', userEmail = '', createdDate = new Date().toISOString(), appName = APP_NAME } = {}) => ({
    APP_NAME: String(appName || APP_NAME).trim() || APP_NAME,
    CREATED_DATE: formatDisplayDate(createdDate),
    USER_EMAIL: String(userEmail || '').trim(),
    USER_NAME: String(userName || 'Customer').trim() || 'Customer',
    YEAR: Number(new Date().getFullYear()),
    WEBSITE_URL: 'https://mithilachitrakalastore.com.np',
    SUPPORT_EMAIL: 'support@mithilachitrakalastore.com.np',
    PRIVACY: 'https://mithilachitrakalastore.com.np/privacy',
});

const getNameFromEmailAddress = (email) => {
    const localPart = String(email || '').split('@')[0] || '';
    const readableName = localPart
        .replace(/[._+-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    return readableName || 'Customer';
};

const buildBrandHtml = () => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; background:#f8f4ee;">
      <tr>
        <td style="padding:28px 32px 18px; text-align:center;">
          <div style="display:inline-block; background:#fff; border:1px solid #e9dfd4; border-radius:16px; padding:12px 18px; box-shadow:0 8px 20px rgba(42,39,35,0.04);">
            <div style="font-size:11px; letter-spacing:3px; color:#8d6a56; text-transform:uppercase; font-weight:700;">Mithila Chitrakala</div>
            <div style="font-size:22px; line-height:1.2; color:#2a2723; font-weight:700;">Store</div>
          </div>
        </td>
      </tr>
    </table>
`;

const buildEmailLayout = ({ title, intro, bodyHtml, ctaLabel, ctaUrl, footerText, previewText, createdDate, userEmail, userName, appName = APP_NAME }) => {
    const templateVars = buildEmailTemplateVariables({ userName, userEmail, createdDate, appName });
    const resolvedCtaLabel = ctaLabel || 'Visit Store';
    const resolvedFooterText = footerText || `Thank you for choosing ${escapeHtml(appName)}.`;
    const safePreview = escapeHtml(previewText || `${appName} — ${title}`);
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${escapeHtml(title)}</title>
        </head>
        <body style="margin:0; padding:0; background:#f4efe8; font-family:Arial, Helvetica, sans-serif; color:#2a2723;">
          <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${safePreview}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#f4efe8; border-collapse:collapse;">
            <tr>
              <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px; width:100%; border-collapse:collapse; background:#fffdfb; border:1px solid #ece2d7; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(42,39,35,0.05);">
                  ${buildBrandHtml()}
                  <tr>
                    <td style="padding:0 36px 8px; font-size:12px; letter-spacing:2.4px; text-transform:uppercase; color:#8a7c6d; font-weight:700;">
                      ${escapeHtml(appName)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 36px 20px;">
                      <h1 style="margin:0; font-size:30px; line-height:1.2; color:#2a2723; font-weight:700;">${escapeHtml(title)}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 36px 18px;">
                      <p style="margin:0; font-size:15px; line-height:1.7; color:#514b46;">${escapeHtml(intro)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 36px 26px;">
                      <div style="background:#f7f3ee; border:1px solid #e8dfd4; border-radius:14px; padding:22px 20px; color:#2a2723;">
                        ${bodyHtml}
                      </div>
                    </td>
                  </tr>
                  ${ctaLabel && ctaUrl ? `
                  <tr>
                    <td style="padding:0 36px 28px; text-align:center;">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block; background:#5c1111; color:#ffffff; text-decoration:none; border-radius:999px; padding:14px 24px; font-size:14px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;">${escapeHtml(resolvedCtaLabel)}</a>
                    </td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding:0 36px 26px; border-top:1px solid #ece2d7;">
                      <p style="margin:14px 0 0; font-size:12px; line-height:1.7; color:#726b65;">${escapeHtml(resolvedFooterText)}<br />${escapeHtml(appName)} · ${templateVars.YEAR}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 36px 28px; text-align:center;">
                      <a href="${escapeHtml(process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || 'https://mithilachitrakalastore.com.np')}" style="color:#5c1111; text-decoration:none; font-size:13px; font-weight:700;">mithilachitrakalastore.com.np</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
    `;
};

const normalizeRecipientList = (recipients) => {
    const values = Array.isArray(recipients) ? recipients : [recipients];
    return values
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
};

const sendEmail = async ({
    to,
    from,
    replyTo,
    subject,
    html,
    text,
    category = 'general',
    idempotencyKey,
    variables,
    template,
}) => {
    const recipients = normalizeRecipientList(to);
    if (!recipients.length) {
        throw new Error('A valid recipient email is required.');
    }

    if (!resend || !process.env.RESEND_API_KEY) {
        console.warn('[email] Resend is not configured. Skipping email delivery.', {
            category,
            recipients,
            subject,
        });
        return {
            success: false,
            skipped: true,
            reason: 'missing_resend_api_key',
        };
    }

    const senderAddress = from || EMAIL_SENDERS.hello;
    const replyAddress = replyTo || EMAIL_SENDERS.hello;

    try {
        const payload = {
            from: `${APP_NAME} <${senderAddress}>`,
            to: recipients,
            reply_to: replyAddress,
            subject,
            tags: [{ name: 'category', value: category }],
        };

        if (template) {
            payload.template = {
                id: template,
                ...(variables && typeof variables === 'object' && !Array.isArray(variables) ? { variables } : {}),
            };
        } else {
            payload.html = html;
            payload.text = text || String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        if (idempotencyKey) {
            payload.idempotencyKey = idempotencyKey;
        }

        const response = await resend.emails.send(payload);
        if (response?.error) {
            const resendError = new Error(response.error.message || String(response.error));
            resendError.statusCode = response.error.statusCode;
            throw resendError;
        }
        console.log(`[email:${category}] sent via Resend successfully to ${recipients.join(', ')}`, response?.id ? { id: response.id } : {});
        return { success: true, response, recipients };
    } catch (error) {
        const statusCode = error?.statusCode || error?.status || 'unknown';
        const errorMessage = error?.message || 'Unknown email sending error';
        console.error(`[email:${category}] Resend delivery failed`, {
            statusCode,
            message: errorMessage,
            recipients,
            subject,
        });
        return {
            success: false,
            error: errorMessage,
            statusCode,
            recipients,
        };
    }
};

const sendWelcomeEmail = async ({ to, name, userEmail, appName = APP_NAME, websiteUrl = process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || 'https://mithilachitrakalastore.com.np' }) => {
    const recipient = to || userEmail;
    const customerName = String(name || 'Customer').trim() || 'Customer';
    const emailHtml = buildEmailLayout({
        title: 'Welcome to Mithila Chitrakala Store',
        intro: `Hello ${customerName}, welcome to the Mithila Chitrakala Store family.`,
        bodyHtml: `
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Your account has been successfully created.</strong> We are delighted to have you with us.</p>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;">At Mithila Chitrakala Store, we bring you authentic handcrafted art, meaningful gifting, and a curated collection inspired by tradition and craftsmanship.</p>
            <p style="margin:0; font-size:15px; line-height:1.7; color:#2a2723;">You can now explore the collection and manage your account from the store. We look forward to helping you discover pieces that feel personal and timeless.</p>
        `,
        ctaLabel: 'Visit Your Account',
        ctaUrl: websiteUrl,
        footerText: `Your account is ready and we are here to help with every step of your shopping journey.`,
        previewText: `Welcome to ${appName}`,
        createdDate: new Date().toISOString(),
        userEmail: recipient,
        userName: customerName,
        appName,
    });

    const templateVars = buildEmailTemplateVariables({ userName: customerName, userEmail: recipient, createdDate: new Date().toISOString(), appName });
    return sendEmail({
        to: recipient,
        from: EMAIL_SENDERS.hello,
        replyTo: EMAIL_SENDERS.hello,
        subject: `Welcome to ${appName}`,
        html: emailHtml,
        category: 'welcome',
        idempotencyKey: recipient ? `welcome:${String(recipient).toLowerCase()}` : undefined,
        variables: templateVars,
        template: RESEND_TEMPLATES.welcome || undefined,
    });
};

const sendEmailVerification = async ({ to, name, verificationUrl, expiresIn, userEmail, appName = APP_NAME }) => {
    const recipient = to || userEmail;
    const customerName = String(name || 'Customer').trim() || 'Customer';
    const securityUrl = verificationUrl || `${process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || 'https://mithilachitrakalastore.com.np'}/verify-email`;
    const expirationNote = expiresIn ? `This link expires in ${expiresIn}.` : 'This verification link expires shortly for your security.';

    const emailHtml = buildEmailLayout({
        title: 'Verify Your Email Address',
        intro: `Hello ${customerName}, we need to confirm your email address before continuing.`,
        bodyHtml: `
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;">Please verify your email to secure your account and keep your order updates, account activity, and important notifications protected.</p>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;">${escapeHtml(expirationNote)}</p>
            <p style="margin:0; font-size:15px; line-height:1.7; color:#2a2723;">For your security, never share this link with anyone.</p>
        `,
        ctaLabel: 'Verify My Email',
        ctaUrl: securityUrl,
        footerText: `If you did not create this account, please ignore this message and contact our support team immediately.`,
        previewText: `Verify your email at ${appName}`,
        createdDate: new Date().toISOString(),
        userEmail: recipient,
        userName: customerName,
        appName,
    });

    const templateVars = buildEmailTemplateVariables({ userName: customerName, userEmail: recipient, createdDate: new Date().toISOString(), appName });
    return sendEmail({
        to: recipient,
        from: EMAIL_SENDERS.security,
        replyTo: EMAIL_SENDERS.support,
        subject: `Verify your ${appName} account`,
        html: emailHtml,
        category: 'security',
        idempotencyKey: recipient ? `verify-email:${String(recipient).toLowerCase()}` : undefined,
        variables: templateVars,
        template: RESEND_TEMPLATES.verification || undefined,
    });
};

const sendEmailVerificationOtp = async ({ to, name, code }) => {
    const customerName = String(name || 'Customer').trim() || 'Customer';
    const expirationText = `${EMAIL_OTP_TTL_MINUTES} minutes`;
    const emailHtml = buildEmailLayout({
        title: 'Verify Your Email Address',
        intro: `Hello ${customerName}, enter this one-time code to verify your email address.`,
        bodyHtml: `<p style="margin:0; text-align:center; font-size:32px; line-height:1.4; letter-spacing:8px; font-weight:700; color:#5c1111;">${escapeHtml(code)}</p><p style="margin:14px 0 0; text-align:center; font-size:14px; color:#514b46;">This code expires in ${expirationText} and can only be used once.</p>`,
        footerText: 'If you did not create an account, you can ignore this email.',
        previewText: `Your ${APP_NAME} verification code`,
        createdDate: new Date().toISOString(),
        userEmail: to,
        userName: customerName,
    });
    const result = await sendEmail({
        to,
        from: EMAIL_SENDERS.security,
        replyTo: EMAIL_SENDERS.support,
        subject: `Your ${APP_NAME} verification code`,
        html: emailHtml,
        text: `Your ${APP_NAME} verification code is ${code}. It expires in ${expirationText}.`,
        category: 'security',
    });
    if (!result?.success) throw new Error(result?.error || 'Unable to deliver the verification code.');
    return result;
};

const issueEmailVerificationCode = async (user, { enforceCooldown = true } = {}) => {
    if (!EMAIL_OTP_SECRET) throw new Error('Email verification signing is not configured on the server.');
    const email = String(user?.email || '').trim().toLowerCase();
    if (!user?.id || !email) throw new Error('A registered email account is required.');
    if (user.email_verified) return { alreadyVerified: true };

    const { data: previousCode, error: lookupError } = await supabase
        .from('email_verification_codes')
        .select('last_sent_at')
        .eq('user_id', user.id)
        .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);

    const now = new Date();
    if (enforceCooldown && previousCode?.last_sent_at) {
        const secondsSinceLastSend = (now.getTime() - new Date(previousCode.last_sent_at).getTime()) / 1000;
        if (secondsSinceLastSend < EMAIL_OTP_RESEND_COOLDOWN_SECONDS) {
            const waitSeconds = Math.ceil(EMAIL_OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend);
            const error = new Error(`Please wait ${waitSeconds} seconds before requesting another code.`);
            error.statusCode = 429;
            throw error;
        }
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const verificationRecord = {
        user_id: user.id,
        email,
        code_hash: hashEmailVerificationCode(user.id, code),
        expires_at: new Date(now.getTime() + EMAIL_OTP_TTL_MINUTES * 60 * 1000).toISOString(),
        attempts: 0,
        last_sent_at: now.toISOString(),
        created_at: now.toISOString(),
    };
    const { error: saveError } = await supabase
        .from('email_verification_codes')
        .upsert(verificationRecord, { onConflict: 'user_id' });
    if (saveError) throw new Error(saveError.message);

    try {
        await sendEmailVerificationOtp({ to: email, name: user.name || user.username, code });
    } catch (error) {
        await supabase.from('email_verification_codes').delete().eq('user_id', user.id);
        throw error;
    }

    return { sent: true, expiresInMinutes: EMAIL_OTP_TTL_MINUTES };
};

const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresIn, userEmail, appName = APP_NAME }) => {
    const recipient = to || userEmail;
    const customerName = String(name || 'Customer').trim() || 'Customer';
    const passwordResetUrl = resetUrl || `${process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || 'https://mithilachitrakalastore.com.np'}/reset-password`;
    const expirationNote = expiresIn ? `This password reset link expires in ${expiresIn}.` : 'This password reset link expires shortly for your protection.';

    const emailHtml = buildEmailLayout({
        title: 'Reset Your Password',
        intro: `Hello ${customerName}, a password reset for your account was requested.`,
        bodyHtml: `
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;">Use the secure link below to create a new password for your ${appName} account.</p>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;">${escapeHtml(expirationNote)}</p>
            <p style="margin:0; font-size:15px; line-height:1.7; color:#2a2723;">If you did not request this reset, you can ignore this email and your current password will remain unchanged.</p>
        `,
        ctaLabel: 'Reset My Password',
        ctaUrl: passwordResetUrl,
        footerText: `For your security, never share this link or your password with anyone.`,
        previewText: `Reset your ${appName} password`,
        createdDate: new Date().toISOString(),
        userEmail: recipient,
        userName: customerName,
        appName,
    });

    const templateVars = buildEmailTemplateVariables({ userName: customerName, userEmail: recipient, createdDate: new Date().toISOString(), appName });
    return sendEmail({
        to: recipient,
        from: EMAIL_SENDERS.security,
        replyTo: EMAIL_SENDERS.support,
        subject: `Reset your ${appName} password`,
        html: emailHtml,
        category: 'security',
        idempotencyKey: recipient ? `password-reset:${String(recipient).toLowerCase()}` : undefined,
        variables: templateVars,
        template: RESEND_TEMPLATES.passwordReset || undefined,
    });
};

const sendOrderConfirmationEmail = async ({ to, name, userEmail, order, appName = APP_NAME }) => {
    const recipient = to || userEmail || order?.customer?.email || order?.customer_email;
    const customerName = String(name || order?.customer?.name || 'Customer').trim() || 'Customer';
    const items = Array.isArray(order?.items) ? order.items : [];
    const subtotal = Number(order?.subtotal ?? items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0));
    const shippingFee = Number(order?.shipping_fee ?? order?.delivery_fee ?? 0);
    const orderTotal = Number(order?.total ?? subtotal + shippingFee);
    const orderDate = order?.date ? formatDisplayDate(order.date) : formatDisplayDate(new Date().toISOString());
    const orderNumber = order?.id || order?.invoice_no || 'N/A';
    const productRows = items.map((item) => `
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #ece2d7; font-size:14px; color:#2a2723;">${escapeHtml(item.name || 'Art piece')}</td>
          <td style="padding:10px 0; border-bottom:1px solid #ece2d7; font-size:14px; color:#2a2723; text-align:center;">${escapeHtml(item.quantity ?? 1)}</td>
          <td style="padding:10px 0; border-bottom:1px solid #ece2d7; font-size:14px; color:#2a2723; text-align:right;">${escapeHtml(Number(item.price || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }))}</td>
        </tr>
    `).join('');
    const orderLink = `${process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || 'https://mithilachitrakalastore.com.np'}/profile`;

    const emailHtml = buildEmailLayout({
        title: 'Your Order Is Confirmed',
        intro: `Hello ${customerName}, thank you for shopping with ${appName}.`,
        bodyHtml: `
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Order number:</strong> ${escapeHtml(orderNumber)}</p>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Order date:</strong> ${escapeHtml(orderDate)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; margin:20px 0;">
              <thead>
                <tr>
                  <th style="padding:8px 0; text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:#766e62; border-bottom:1px solid #ece2d7;">Item</th>
                  <th style="padding:8px 0; text-align:center; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:#766e62; border-bottom:1px solid #ece2d7;">Qty</th>
                  <th style="padding:8px 0; text-align:right; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:#766e62; border-bottom:1px solid #ece2d7;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${productRows || '<tr><td colspan="3" style="padding:12px 0; font-size:14px; color:#514b46;">Your order details are being prepared.</td></tr>'}
              </tbody>
            </table>
            <p style="margin:0 0 8px; font-size:14px; line-height:1.7; color:#2a2723; text-align:right;"><strong>Subtotal:</strong> NPR ${Number(subtotal).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            <p style="margin:0 0 8px; font-size:14px; line-height:1.7; color:#2a2723; text-align:right;"><strong>Shipping:</strong> NPR ${Number(shippingFee).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            <p style="margin:0; font-size:16px; line-height:1.7; color:#2a2723; text-align:right;"><strong>Total:</strong> NPR ${Number(orderTotal).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            <p style="margin:18px 0 0; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Payment status:</strong> ${escapeHtml(order?.customer_payment_status || order?.payment_status || 'pending')}</p>
            ${(order?.customer?.address || order?.customer?.city) ? `<p style="margin:10px 0 0; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Delivery address:</strong> ${escapeHtml([order.customer.address, order.customer.city].filter(Boolean).join(', '))}</p>` : ''}
        `,
        ctaLabel: 'View Order',
        ctaUrl: orderLink,
        footerText: `We will keep you updated on your order as it moves through our process.`,
        previewText: `Order confirmed for ${customerName}`,
        createdDate: order?.date || new Date().toISOString(),
        userEmail: recipient,
        userName: customerName,
        appName,
    });

    const templateVars = buildEmailTemplateVariables({ userName: customerName, userEmail: recipient, createdDate: order?.date || new Date().toISOString(), appName });
    return sendEmail({
        to: recipient,
        from: EMAIL_SENDERS.orders,
        replyTo: EMAIL_SENDERS.support,
        subject: `Order confirmation #${orderNumber}`,
        html: emailHtml,
        category: 'orders',
        idempotencyKey: orderNumber ? `order-confirmation:${String(orderNumber)}` : undefined,
        variables: templateVars,
        template: RESEND_TEMPLATES.orderConfirmation || undefined,
    });
};

const sendOrderStatusEmail = async ({ to, name, userEmail, order, previousStatus, newStatus, appName = APP_NAME }) => {
    const recipient = to || userEmail || order?.customer?.email || order?.customer_email;
    const customerName = String(name || order?.customer?.name || 'Customer').trim() || 'Customer';
    const orderNumber = order?.id || order?.invoice_no || 'N/A';
    const finalStatus = String(newStatus || order?.status || 'pending').trim();
    const oldStatus = previousStatus || order?.previous_status || 'Pending';
    const emailHtml = buildEmailLayout({
        title: 'Order Status Update',
        intro: `Hello ${customerName}, the status of your order has changed.`,
        bodyHtml: `
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Order number:</strong> ${escapeHtml(orderNumber)}</p>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Previous status:</strong> ${escapeHtml(oldStatus)}</p>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>New status:</strong> ${escapeHtml(finalStatus)}</p>
            <p style="margin:0; font-size:15px; line-height:1.7; color:#2a2723;">We will keep you informed as your order moves through the next step. You can review your order details anytime in your account.</p>
        `,
        ctaLabel: 'View My Order',
        ctaUrl: `${process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || 'https://mithilachitrakalastore.com.np'}/profile`,
        footerText: `You can reply to this email if you need assistance with your order.`,
        previewText: `Your order status changed to ${finalStatus}`,
        createdDate: order?.date || new Date().toISOString(),
        userEmail: recipient,
        userName: customerName,
        appName,
    });

    const templateVars = buildEmailTemplateVariables({ userName: customerName, userEmail: recipient, createdDate: order?.date || new Date().toISOString(), appName });
    return sendEmail({
        to: recipient,
        from: EMAIL_SENDERS.orders,
        replyTo: EMAIL_SENDERS.support,
        subject: `Your order #${orderNumber} is now ${finalStatus}`,
        html: emailHtml,
        category: 'orders',
        idempotencyKey: orderNumber ? `order-status:${String(orderNumber)}:${String(finalStatus).toLowerCase()}` : undefined,
        variables: templateVars,
        template: RESEND_TEMPLATES.orderStatus || undefined,
    });
};

const sendShippingEmail = async ({ to, name, userEmail, order, shippingInfo, trackingNumber, trackingUrl, expectedDelivery, appName = APP_NAME }) => {
    const recipient = to || userEmail || order?.customer?.email || order?.customer_email;
    const customerName = String(name || order?.customer?.name || 'Customer').trim() || 'Customer';
    const orderNumber = order?.id || order?.invoice_no || 'N/A';
    const trackingText = trackingNumber ? `Tracking number: ${trackingNumber}` : 'Tracking number: not provided yet';
    const trackingLink = trackingUrl || `${process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || 'https://mithilachitrakalastore.com.np'}/profile`;
    const expectedText = expectedDelivery ? `Expected delivery: ${expectedDelivery}` : 'Expected delivery details will be shared once the courier confirms the shipment.';

    const emailHtml = buildEmailLayout({
        title: 'Your Order Has Shipped',
        intro: `Hello ${customerName}, your order is on its way.`,
        bodyHtml: `
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Order number:</strong> ${escapeHtml(orderNumber)}</p>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Shipping information:</strong> ${escapeHtml(shippingInfo || 'Your courier is preparing the shipment.')}</p>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>${escapeHtml(trackingText)}</strong></p>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#2a2723;">${escapeHtml(expectedText)}</p>
        `,
        ctaLabel: 'Track My Order',
        ctaUrl: trackingLink,
        footerText: `Please keep an eye on your inbox for the final delivery update.`,
        previewText: `Your ${appName} order is on the way`,
        createdDate: order?.date || new Date().toISOString(),
        userEmail: recipient,
        userName: customerName,
        appName,
    });

    const templateVars = buildEmailTemplateVariables({ userName: customerName, userEmail: recipient, createdDate: order?.date || new Date().toISOString(), appName });
    return sendEmail({
        to: recipient,
        from: EMAIL_SENDERS.orders,
        replyTo: EMAIL_SENDERS.support,
        subject: `Your order #${orderNumber} has shipped`,
        html: emailHtml,
        category: 'orders',
        idempotencyKey: orderNumber ? `order-shipping:${String(orderNumber)}` : undefined,
        variables: templateVars,
        template: RESEND_TEMPLATES.shipping || undefined,
    });
};

const sendSupportNotification = async ({ name, email, subject, message, orderNumber, appName = APP_NAME }) => {
    const customerName = String(name || 'Customer').trim() || 'Customer';
    const customerEmail = String(email || '').trim().toLowerCase();
    const ticketSubject = String(subject || 'Customer support request').trim() || 'Customer support request';
    const orderRef = String(orderNumber || '').trim();
    const emailHtml = buildEmailLayout({
        title: 'New Customer Support Request',
        intro: `A new message has been submitted from ${customerName}.`,
        bodyHtml: `
            <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Name:</strong> ${escapeHtml(customerName)}</p>
            <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Email:</strong> ${escapeHtml(customerEmail)}</p>
            <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Subject:</strong> ${escapeHtml(ticketSubject)}</p>
            ${orderRef ? `<p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Order number:</strong> ${escapeHtml(orderRef)}</p>` : ''}
            <p style="margin:0; font-size:15px; line-height:1.7; color:#2a2723;"><strong>Message:</strong><br />${escapeHtml(message || 'No message text provided.')}</p>
        `,
        ctaLabel: 'Reply to Customer',
        ctaUrl: `mailto:${customerEmail}`,
        footerText: `This request was submitted through ${appName}.`,
        previewText: `Support request from ${customerName}`,
        createdDate: new Date().toISOString(),
        userEmail: customerEmail,
        userName: customerName,
        appName,
    });

    const templateVars = buildEmailTemplateVariables({ userName: customerName, userEmail: customerEmail, createdDate: new Date().toISOString(), appName });
    return sendEmail({
        to: EMAIL_SENDERS.support,
        from: EMAIL_SENDERS.support,
        replyTo: customerEmail || EMAIL_SENDERS.support,
        subject: `Support request: ${ticketSubject}`,
        html: emailHtml,
        category: 'support',
        idempotencyKey: customerEmail ? `support:${String(customerEmail).toLowerCase()}:${String(ticketSubject).toLowerCase()}` : undefined,
        variables: templateVars,
        template: RESEND_TEMPLATES.support || undefined,
    });
};

const getMetaAvailability = (product = {}) => {
    const stockValue = Number(product.stock ?? product.inventory ?? 0) || 0;
    const status = String(product.status || '').trim().toLowerCase();
    if (status && ['draft', 'archived', 'deleted', 'inactive'].includes(status)) {
        return 'out of stock';
    }
    return stockValue > 0 ? 'in stock' : 'out of stock';
};

const normalizeMetaProduct = (product = {}, req) => {
    const productId = String(product.id || product.slug || product.name || 'meta-product').trim();
    const slug = String(product.slug || product.name || productId || '').trim();
    const title = String(product.title || product.name || 'Mithila Chitrakala Store Product').trim();
    const rawKeyFeatures = String(product.key_features || '').trim();
    const parsedKeyFeatures = rawKeyFeatures
        .split(/\r?\n|\r/)
        .map((line) => line.replace(/\|/g, ' • ').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 6)
        .join(' • ');
    const baseDescription = String(product.description || product.short_description || `Premium handcrafted product from Mithila Chitrakala Store.`).trim().replace(/\s+/g, ' ');
    const description = parsedKeyFeatures
        ? `${baseDescription}${baseDescription.endsWith('.') ? ' ' : '. '}Features: ${parsedKeyFeatures}`
        : baseDescription;
    const priceValue = Number(product.price ?? product.sale_price ?? product.final_price ?? 0) || 0;
    const stockValue = Number(product.stock ?? product.inventory ?? 0) || 0;
    const category = String(product.category || product.product_type || product.type || 'General').trim() || 'General';
    const brand = String(product.storeName || product.brand || 'Mithila Chitrakala Store').trim() || 'Mithila Chitrakala Store';
    const productCode = String(product.product_code || product.sku || product.code || '').trim();
    const frontendBaseUrl = getFrontendBaseUrl(req);
    const productUrl = `${frontendBaseUrl}/product/${encodeURIComponent(slug || productId)}`;
    const imageLink = buildProductShareImageUrl(product);
    const rawCondition = String(product.condition || product.product_condition || 'new').trim().toLowerCase();

    return {
        id: productId,
        title,
        description,
        availability: getMetaAvailability(product),
        condition: ['new', 'used', 'refurbished', 'like_new'].includes(rawCondition) ? rawCondition : 'new',
        price: priceValue.toFixed(2),
        currency: 'NPR',
        link: productUrl,
        image_link: imageLink,
        additional_image_link: Array.isArray(product.images) ? product.images.filter(Boolean).slice(0, 10) : [],
        brand,
        category,
        product_type: category,
        sku: productCode || undefined,
        product_code: productCode || undefined,
        inventory: stockValue,
        availability_status: getMetaAvailability(product),
        item_group_id: productId,
        mpn: productCode || undefined,
    };
};

const resolveProductStoreName = async (sellerId, fallbackStoreName = '') => {
    const trimmedFallback = String(fallbackStoreName || '').trim();
    if (trimmedFallback) return trimmedFallback;
    if (!sellerId) return '';

    const { data, error } = await supabase
        .from('users')
        .select('storeName')
        .eq('id', sellerId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return String(data?.storeName || '').trim();
};

const logAction = async (action, adminId) => {
    await supabase.from('logs').insert([{
        id: `l-${Math.random().toString(36).substr(2, 9)}`,
        action,
        admin_id: adminId,
        timestamp: new Date().toISOString()
    }]);
};

const isStoreApprovalSchemaError = (errorMessage = '') => /storeName_pending|storeName_change_requested_at/i.test(errorMessage);

const stripStoreApprovalFields = (record = {}) => {
    const nextRecord = { ...record };
    delete nextRecord.storeName_pending;
    delete nextRecord.storeName_change_requested_at;
    return nextRecord;
};

// --- Gemini API Route ---
app.post('/api/gemini', async (req, res) => {
    try {
        const { userPrompt } = req.body || {};
        if (!String(userPrompt || '').trim()) {
            return res.status(400).json({ error: 'A question is required.' });
        }

        const request = {
            contents: String(userPrompt).trim(),
            config: {
                systemInstruction: `You are Mithila Oracle by Taigra Nexus Labs, an expert art consultant specializing in Mithila (Maithili) art.
                Your identity is Mithila Oracle by Taigra Nexus Labs. If asked your name, who you are, or who made you, answer with that name.
                Never call yourself Gemini and never identify the underlying AI model or provider. Always speak as Mithila Oracle by Taigra Nexus Labs.
                also known as Madhubani art. You are deeply knowledgeable about its history,
                symbolism, traditional techniques, and the cultural heritage of the Mithila region.
                Keep your responses concise but impactful.`
            }
        };

        let result;
        try {
            result = await genAI.models.generateContent({ model: geminiModel, ...request });
        } catch (error) {
            const modelWasRejected = /model|not found|unsupported|invalid/i.test(error.message || '');
            if (!modelWasRejected || geminiModel === fallbackGeminiModel) throw error;
            console.warn(`Gemini model "${geminiModel}" was rejected; using ${fallbackGeminiModel}.`);
            result = await genAI.models.generateContent({ model: fallbackGeminiModel, ...request });
        }
        res.json({ text: result.text });
    } catch (error) {
        console.error('Gemini Error:', error);
        res.status(500).json({ error: 'Gemini could not answer right now. Please try again.' });
    }
});

app.get('/api/cloudinary/signature', (req, res) => {
    if (!cloudinaryApiKey || !cloudinaryApiSecret || !cloudinaryCloudName) {
        return res.status(503).json({ error: 'Cloudinary signed upload is not configured on the server.' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'mithila-products';
    const signatureBase = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(`${signatureBase}${cloudinaryApiSecret}`).digest('hex');

    res.json({ apiKey: cloudinaryApiKey, cloudName: cloudinaryCloudName, timestamp, folder, signature });
});

app.get('/api/meta/products-feed', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw new Error(error.message);

        const activeProducts = (products || [])
            .filter((product) => {
                const visible = product.visible_to_users !== false && product.visible_to_users !== 'false';
                const status = String(product.status || '').trim().toLowerCase();
                const hiddenStatus = ['draft', 'archived', 'deleted', 'inactive'];
                return visible && !(status && hiddenStatus.includes(status));
            })
            .map((product) => normalizeMetaProduct(product, req));

        res.json({
            source: 'existing-products-database',
            currency: 'NPR',
            generated_at: new Date().toISOString(),
            total_products: activeProducts.length,
            products: activeProducts,
        });
    } catch (error) {
        console.error('Meta feed generation failed:', error);
        res.status(500).json({ error: 'Unable to generate the Meta product feed right now.' });
    }
});

// --- Supabase DB Proxy Route ---
app.post('/api/db', async (req, res) => {
    try {
        const { action, payload } = req.body;
        let result = null;

        if (!action) {
            console.error('DB Service Error: missing action', req.body);
            return res.status(400).json({ error: 'Missing action' });
        }

        switch (action) {
            case 'login': {
                const { username, password } = payload;
                let { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('username', username)
                    .maybeSingle();

                if (!data && !error) {
                    const alt = await supabase
                        .from('users')
                        .select('*')
                        .eq('email', username)
                        .maybeSingle();
                    data = alt.data;
                    error = alt.error;
                }

                if (error) {
                    throw new Error(error.message);
                }

                const matchesPassword = data && (
                    data.password_hash === hashPassword(password) ||
                    data.password === password
                );

                if (!matchesPassword || !data) {
                    result = null;
                } else if (data.email_verified === false) {
                    result = { requiresEmailVerification: true, email: data.email };
                } else if (data.status !== 'active') {
                    result = null;
                } else {
                    result = data.role === 'admin'
                        ? { ...data, emailAdminToken: createAdminEmailToken(data.id) || undefined }
                        : data;
                }
                break;
            }
            case 'requestSellerConversion': {
                const { userId, password, storeName } = payload || {};
                const requestedStoreName = String(storeName || '').trim();
                if (!userId || !password || !requestedStoreName) {
                    throw new Error('Enter your current password and studio name to request seller access.');
                }

                const { data: customer, error: customerError } = await supabase
                    .from('users')
                    .select('id, username, name, email, role, status, password, password_hash, email_verified, storeName')
                    .eq('id', userId)
                    .maybeSingle();
                if (customerError) throw new Error(customerError.message);
                if (!customer || customer.role !== 'customer' || customer.status !== 'active') {
                    throw new Error('Only an active customer account can request seller access.');
                }
                if (customer.email_verified === false) {
                    throw new Error('Verify your email address before requesting seller access.');
                }
                const passwordMatches = customer.password_hash === hashPassword(password) || customer.password === password;
                if (!passwordMatches) throw new Error('Your current password is incorrect.');

                const conversion = {
                    role: 'seller',
                    status: 'disabled',
                    storeName: '',
                    storeName_pending: requestedStoreName,
                    storeName_change_requested_at: new Date().toISOString(),
                };
                let convertedUser;
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .update(conversion)
                        .eq('id', customer.id)
                        .eq('role', 'customer')
                        .eq('status', 'active')
                        .select()
                        .maybeSingle();
                    if (error) throw error;
                    convertedUser = data;
                } catch (error) {
                    if (!isStoreApprovalSchemaError(error.message)) throw error;
                    const { data, error: fallbackError } = await supabase
                        .from('users')
                        .update({ role: 'seller', status: 'disabled', storeName: requestedStoreName })
                        .eq('id', customer.id)
                        .eq('role', 'customer')
                        .eq('status', 'active')
                        .select()
                        .maybeSingle();
                    if (fallbackError) throw new Error(fallbackError.message);
                    convertedUser = data;
                }
                if (!convertedUser) throw new Error('This account has already changed. Refresh the page and check its current status.');

                const safeUser = { ...convertedUser };
                delete safeUser.password;
                delete safeUser.password_hash;
                result = safeUser;
                break;
            }
            case 'register': {
                const { userData } = payload;
                const plainPassword = userData.password;
                const sanitizedUserData = {
                    ...userData,
                    email: String(userData.email || '').trim().toLowerCase(),
                };
                if (!sanitizedUserData.email) throw new Error('Enter a valid email address.');
                if (sanitizedUserData.role !== 'customer') {
                    throw new Error('Create a customer account first, then request seller access from Profile Information.');
                }

                const { data: existingEmail, error: emailLookupError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', sanitizedUserData.email)
                    .maybeSingle();
                if (emailLookupError) throw new Error(`Unable to check email availability: ${emailLookupError.message}`);
                if (existingEmail) throw new Error('An account with this email already exists. Sign in or use a different email address.');

                const newUser = {
                    ...sanitizedUserData,
                    id: `u-${Math.random().toString(36).substr(2, 9)}`,
                    role: 'customer',
                    status: 'active',
                    storeName: '',
                    storeName_pending: '',
                    password: plainPassword,
                    password_hash: hashPassword(plainPassword),
                    email_verified: false,
                };
                const throwRegistrationError = (error) => {
                    if (error?.code === '23505' && error?.constraint === 'users_email_key') {
                        throw new Error('An account with this email already exists. Sign in or use a different email address.');
                    }
                    throw new Error(error?.message || 'Unable to create your account.');
                };
                try {
                    const { data, error } = await supabase.from('users').insert([newUser]).select();
                    if (error) throwRegistrationError(error);
                    result = (data && data.length > 0) ? data[0] : newUser;
                } catch (error) {
                    if (!isStoreApprovalSchemaError(error.message)) throw error;
                    const fallbackUser = stripStoreApprovalFields(newUser);
                    const { data, fallbackError } = await supabase.from('users').insert([fallbackUser]).select();
                    if (fallbackError) throwRegistrationError(fallbackError);
                    result = (data && data.length > 0) ? data[0] : fallbackUser;
                }

                if (result?.email) {
                    const createdUser = result;
                    try {
                        await sendWelcomeEmail({
                            to: createdUser.email,
                            name: createdUser.name || createdUser.username || 'Customer',
                            userEmail: createdUser.email,
                        });
                    } catch (error) {
                        console.error('Welcome email failed after registration:', error.message || error);
                    }
                    let verificationEmailSent = false;
                    try {
                        await issueEmailVerificationCode(createdUser);
                        verificationEmailSent = true;
                    } catch (error) {
                        console.error('Verification code email failed after registration:', error.message || error);
                    }
                    const safeCreatedUser = { ...createdUser };
                    delete safeCreatedUser.password;
                    delete safeCreatedUser.password_hash;
                    result = { ...safeCreatedUser, emailVerificationRequired: true, verificationEmailSent };
                }
                break;
            }
            case 'getUserByEmail': {
                const { email } = payload;
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .maybeSingle(); // maybeSingle instead of single so it doesn't throw if not found
                
                if (error) throw new Error(error.message);
                if (!data || data.status !== 'active') result = null;
                else result = data;
                break;
            }
            case 'registerGoogleUser': {
                const { picture, ...restUserData } = payload.userData;
                const normalizedEmail = String(restUserData.email || '').trim().toLowerCase();
                const normalizedName = String(restUserData.name || '').trim();
                const normalizedAddress = String(restUserData.address || '').trim();
                const age = Number(restUserData.age);
                if (!normalizedEmail || !normalizedName || !normalizedAddress ||
                    !Number.isInteger(age) || age < 13 || age > 120 ||
                    !String(restUserData.gender || '').trim()) {
                    throw new Error('Full name, email, address, age, and gender are required.');
                }

                const { data: existingUser, error: lookupError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', normalizedEmail)
                    .maybeSingle();
                if (lookupError) throw new Error(describeSupabaseError(lookupError));
                if (existingUser && existingUser.status !== 'active') {
                    throw new Error('This account is inactive. Please contact the store administrator.');
                }

                const profileData = {
                    name: normalizedName,
                    email: normalizedEmail,
                    email_verified: true,
                    username: String(restUserData.username || '').trim(),
                    phone: String(restUserData.phone || '').trim(),
                    address: normalizedAddress,
                    city: String(restUserData.city || '').trim(),
                    age,
                    gender: String(restUserData.gender).trim(),
                    avatar_url: picture || ''
                };
                if (existingUser) {
                    const { data, error } = await supabase
                        .from('users')
                        .update(profileData)
                        .eq('id', existingUser.id)
                        .select()
                        .single();
                    if (error) throw new Error(describeSupabaseError(error));
                    result = data;
                } else {
                    const newUser = {
                        id: `u-${crypto.randomUUID()}`,
                        role: 'customer',
                        status: 'active',
                        email_verified: true,
                        ...profileData
                    };
                    const { data, error } = await supabase.from('users').insert([newUser]).select().single();
                    if (error) throw new Error(describeSupabaseError(error));
                    result = data;
                }

                if (result?.email) {
                    try {
                        await sendWelcomeEmail({
                            to: result.email,
                            name: result.name || result.username || 'Customer',
                            userEmail: result.email,
                        });
                    } catch (error) {
                        console.error('Google welcome email failed:', error.message || error);
                    }
                }
                break;
            }
            case 'getUsers': {
                const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
                if (error) throw new Error(error.message);
                result = data;
                break;
            }
            case 'updateUser': {
                const { userId, userData } = payload;
                const currentUserQuery = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
                if (currentUserQuery.error) throw new Error(currentUserQuery.error.message);

                const currentUser = currentUserQuery.data;
                let updateData = { ...userData };

                if (currentUser && currentUser.role === 'seller' && updateData.storeName !== undefined) {
                    const approvedStore = String(currentUser.storeName || '').trim();
                    const pendingStore = String(currentUser.storeName_pending || '').trim();
                    const requestedStore = String(updateData.storeName || '').trim();

                    if (!requestedStore) {
                        updateData = {
                            ...updateData,
                            storeName: approvedStore,
                            storeName_pending: pendingStore,
                            storeName_change_requested_at: pendingStore ? currentUser.storeName_change_requested_at || null : null
                        };
                    } else if (!approvedStore && !pendingStore) {
                        updateData = {
                            ...updateData,
                            storeName: '',
                            storeName_pending: requestedStore,
                            storeName_change_requested_at: new Date().toISOString()
                        };
                    } else if (requestedStore !== approvedStore && requestedStore !== pendingStore) {
                        updateData = {
                            ...updateData,
                            storeName: approvedStore,
                            storeName_pending: requestedStore,
                            storeName_change_requested_at: currentUser.storeName_change_requested_at || new Date().toISOString()
                        };
                    } else {
                        updateData = {
                            ...updateData,
                            storeName: approvedStore,
                            storeName_pending: pendingStore || approvedStore,
                            storeName_change_requested_at: pendingStore ? currentUser.storeName_change_requested_at || null : null
                        };
                    }
                }

                try {
                    const { data, error } = await supabase.from('users').update(updateData).eq('id', userId).select();
                    if (error) throw new Error(error.message);
                    result = data[0];
                } catch (error) {
                    if (!isStoreApprovalSchemaError(error.message)) throw error;
                    const fallbackData = stripStoreApprovalFields(updateData);
                    const { data, error: fallbackError } = await supabase.from('users').update(fallbackData).eq('id', userId).select();
                    if (fallbackError) throw new Error(fallbackError.message);
                    result = data[0];
                }
                break;
            }
            case 'approveStoreNameChange': {
                const { userId, approvedStoreName, adminId } = payload;
                const cleanedStore = String(approvedStoreName || '').trim();
                try {
                    const { error } = await supabase.from('users').update({
                        storeName: cleanedStore,
                        storeName_pending: '',
                        storeName_change_requested_at: null
                    }).eq('id', userId);
                    if (error) throw new Error(error.message);
                    if (adminId) await logAction(`Admin approved store name for user ${userId}`, adminId);
                    result = { success: true };
                } catch (error) {
                    if (!isStoreApprovalSchemaError(error.message)) throw error;
                    const { error: fallbackError } = await supabase.from('users').update({
                        storeName: cleanedStore
                    }).eq('id', userId);
                    if (fallbackError) throw new Error(fallbackError.message);
                    if (adminId) await logAction(`Admin approved store name for user ${userId}`, adminId);
                    result = { success: true };
                }
                break;
            }
            case 'rejectStoreNameChange': {
                const { userId, adminId } = payload;
                try {
                    const { error } = await supabase.from('users').update({
                        storeName_pending: '',
                        storeName_change_requested_at: null
                    }).eq('id', userId);
                    if (error) throw new Error(error.message);
                    if (adminId) await logAction(`Admin rejected store name change for user ${userId}`, adminId);
                    result = { success: true };
                } catch (error) {
                    if (!isStoreApprovalSchemaError(error.message)) throw error;
                    const { error: fallbackError } = await supabase.from('users').update({}).eq('id', userId);
                    if (fallbackError) throw new Error(fallbackError.message);
                    if (adminId) await logAction(`Admin rejected store name change for user ${userId}`, adminId);
                    result = { success: true };
                }
                break;
            }
            case 'updateUserStatus': {
                const { id, status, adminId } = payload;
                const { error } = await supabase.from('users').update({ status }).eq('id', id);
                if (error) throw new Error(error.message);
                if (adminId) await logAction(`Admin updated user ${id} status to ${status}`, adminId);
                result = { success: true };
                break;
            }
            case 'getGlobalCommission': {
                const { data, error } = await supabase
                    .from('app_config')
                    .select('globalCommission')
                    .eq('id', 1)
                    .maybeSingle();
                if (error) throw new Error(error.message);
                result = { globalCommission: Number(data?.globalCommission ?? 12) };
                break;
            }
            case 'setGlobalCommission': {
                const { commission, adminId } = payload;
                const commissionRate = Number(commission);
                if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
                    throw new Error('Commission rate must be between 0 and 100.');
                }

                const { data, error } = await supabase
                    .from('app_config')
                    .upsert({ id: 1, globalCommission: commissionRate }, { onConflict: 'id' })
                    .select('globalCommission')
                    .single();
                if (error) throw new Error(error.message);
                if (adminId) await logAction(`Admin updated global commission to ${commissionRate}%`, adminId);
                result = { success: true, globalCommission: Number(data.globalCommission) };
                break;
            }
            case 'getProducts': {
                const { sellerId } = payload;
                let query = supabase.from('products').select('*');
                if (sellerId) {
                    query = query.eq('seller_id', sellerId);
                } else {
                    query = query.or('visible_to_users.is.null,visible_to_users.eq.true');
                }
                const { data, error } = await query;
                if (error) throw new Error(error.message);
                result = data;
                break;
            }
            case 'addProduct': {
                const { productData } = payload;
                const normalizedProduct = normalizeProductData(productData);
                const resolvedStoreName = await resolveProductStoreName(normalizedProduct.seller_id, normalizedProduct.storeName);
                const id = normalizedProduct.id || `p-${Math.random().toString(36).substr(2, 9)}`;
                const product = {
                    ...normalizedProduct,
                    storeName: resolvedStoreName,
                    slug: createSlug(normalizedProduct.slug) || createSlug(normalizedProduct.name) || id,
                    id,
                };
                const { data, error } = await supabase.from('products').insert([product]).select();
                if (error) throw new Error(error.message);
                result = data[0];
                break;
            }
            case 'updateProduct': {
                const { productId, productData } = payload;
                const normalizedProduct = normalizeProductData(productData);
                const resolvedStoreName = await resolveProductStoreName(normalizedProduct.seller_id, normalizedProduct.storeName);
                const { data, error } = await supabase.from('products').update({ ...normalizedProduct, storeName: resolvedStoreName }).eq('id', productId).select();
                if (error) throw new Error(error.message);
                result = data[0];
                break;
            }
            case 'deleteProduct': {
                const { productId } = payload;
                const { error } = await supabase.from('products').delete().eq('id', productId);
                if (error) throw new Error(error.message);
                result = { success: true };
                break;
            }
            case 'getProductCategories': {
                const { data, error } = await supabase
                    .from('product_categories')
                    .select('id, name')
                    .eq('active', true)
                    .order('name', { ascending: true });
                if (error) throw new Error(error.message);
                result = data;
                break;
            }
            case 'addProductCategory': {
                const categoryName = String(payload.category || '').trim();
                if (!categoryName) throw new Error('Category name is required');
                const { data, error } = await supabase
                    .from('product_categories')
                    .upsert({ name: categoryName, active: true }, { onConflict: 'name' })
                    .select('id, name')
                    .single();
                if (error) throw new Error(error.message);
                result = data;
                break;
            }
            case 'getOrders': {
                const { sellerId, customerId } = payload;
                let query = supabase.from('orders').select('*').order('date', { ascending: false });
                if (sellerId) query = query.eq('seller_id', sellerId);
                if (customerId) query = query.eq('customer_id', customerId);
                const { data, error } = await query;
                if (error) throw new Error(error.message);
                result = data;
                break;
            }
            case 'getPublicInvoices': {
                const invoiceNumbers = [...new Set((payload.invoiceNumbers || [])
                    .map((invoiceNumber) => String(invoiceNumber || '').trim())
                    .filter(Boolean))];
                if (invoiceNumbers.length === 0 || invoiceNumbers.length > 20) {
                    throw new Error('One or more invoice numbers are required.');
                }

                const { data, error } = await supabase
                    .from('orders')
                    .select('invoice_no, date, total, status, customer_payment_status, items')
                    .in('invoice_no', invoiceNumbers);
                if (error) throw new Error(error.message);
                result = (data || []).map((invoice) => ({
                    ...invoice,
                    items: (invoice.items || []).map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        category: item.category,
                        material: item.material,
                    })),
                }));
                break;
            }
            case 'saveOrder': {
                const { order } = payload;
                if (!['advance', 'full'].includes(order?.payment_type)) {
                    throw new Error('Choose full payment or advance payment before placing the order.');
                }
                const orderItems = Array.isArray(order.items) ? order.items : [];
                if (orderItems.length === 0) throw new Error('An order must contain at least one product.');
                const productIds = [...new Set(orderItems.map((item) => String(item.id || '').trim()).filter(Boolean))];
                if (productIds.length !== orderItems.length) {
                    throw new Error('Order products must have valid, unique product IDs.');
                }
                const { data: products, error: productsError } = await supabase
                    .from('products')
                    .select('id, price, advance_percentage, seller_id')
                    .in('id', productIds);
                if (productsError) throw new Error(productsError.message);
                if (products.length !== productIds.length || products.some((product) => String(product.seller_id) !== String(order.seller_id))) {
                    throw new Error('One or more products are no longer available from this seller.');
                }

                const productsById = new Map(products.map((product) => [String(product.id), product]));
                const pricedItems = orderItems.map((item) => {
                    const product = productsById.get(String(item.id));
                    const quantity = Number(item.quantity);
                    const price = Number(product.price);
                    const advancePercentage = Number(product.advance_percentage || 0);
                    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0) {
                        throw new Error('Order contains an invalid product quantity or price.');
                    }
                    return { ...item, price, quantity, advance_percentage: advancePercentage };
                });
                const subtotal = pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
                const shippingFee = subtotal > 5000 ? 0 : 250;
                const total = subtotal + shippingFee;
                const advanceDueAmount = Math.min(total, Math.round(pricedItems.reduce(
                    (sum, item) => sum + item.price * item.quantity * item.advance_percentage / 100,
                    0
                ) * 100) / 100);
                if (order.payment_type === 'advance' && advanceDueAmount <= 0) {
                    throw new Error('Advance payment is not available for these products.');
                }
                const { data: configData, error: configError } = await supabase
                    .from('app_config')
                    .select('globalCommission')
                    .eq('id', 1)
                    .maybeSingle();
                if (configError) throw new Error(configError.message);
                const perc = Number(configData?.globalCommission ?? 12);
                if (!Number.isFinite(perc) || perc < 0 || perc > 100) {
                    throw new Error('The configured commission rate is invalid.');
                }
                const commAmt = (total * perc) / 100;
                const sellerAmt = total - commAmt;

                const now = new Date();
                const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
                const invoiceSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
                const invoiceNo = `INV-${dateStr}-${invoiceSuffix}`;
                const trackingId = `MCS-TRK-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

                const orderData = {
                    ...order,
                    items: pricedItems,
                    subtotal,
                    shipping_fee: shippingFee,
                    total,
                    advance_due_amount: advanceDueAmount,
                    amount_paid: 0,
                    payment_gateway: null,
                    customer_payment_status: 'pending',
                    customer_payment_verified: false,
                    invoice_no: invoiceNo,
                    tracking_id: trackingId,
                    commission_percentage: perc,
                    commission_amount: commAmt,
                    seller_payable_amount: sellerAmt,
                    date: now.toISOString()
                };

                const { data, error } = await supabase.from('orders').insert([orderData]).select();
                if (error) throw new Error(error.message);
                result = data[0];

                if (!result.payment_type && (result?.customer?.email || result?.customer_email)) {
                    try {
                        await sendOrderConfirmationEmail({
                            to: result.customer?.email || result.customer_email,
                            name: result.customer?.name || 'Customer',
                            order: result,
                        });
                    } catch (error) {
                        console.error('Order confirmation email failed:', error.message || error);
                    }
                }
                break;
            }
            case 'updateOrderStatus': {
                const { id, status, role, userId } = payload;
                const previousOrder = id ? await supabase.from('orders').select('status, amount_paid').eq('id', id).maybeSingle() : { data: null };
                if (previousOrder?.error) throw new Error(previousOrder.error.message);
                if (status === 'cancelled' && Number(previousOrder?.data?.amount_paid || 0) > 0) {
                    throw new Error('An order with a recorded payment cannot be cancelled here. Contact support for help.');
                }
                const previousStatus = previousOrder?.data?.status || 'pending';
                let updateData = { status };
                if (status === 'cancelled') {
                    updateData.payment_status = 'cancelled';
                    updateData.customer_payment_status = 'cancelled';
                }
                const { error } = await supabase.from('orders').update(updateData).eq('id', id);
                if (error) throw new Error(error.message);
                if (role === 'admin') await logAction(`Admin forced status ${status} on order ${id}`, userId);

                if (id) {
                    const { data: refreshedOrder } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
                    const customerEmail = refreshedOrder?.customer?.email || refreshedOrder?.customer_email;
                    const normalizedStatus = String(status || '').trim().toLowerCase();
                    if (customerEmail && previousStatus !== status) {
                        try {
                            if (normalizedStatus === 'shipped') {
                                await sendShippingEmail({
                                    to: customerEmail,
                                    name: refreshedOrder?.customer?.name || 'Customer',
                                    order: refreshedOrder,
                                    shippingInfo: refreshedOrder?.shipping_info || 'Your order has been dispatched.',
                                    trackingNumber: refreshedOrder?.tracking_id || refreshedOrder?.tracking_number,
                                    trackingUrl: `${process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || 'https://mithilachitrakalastore.com.np'}/profile`,
                                });
                            } else {
                                await sendOrderStatusEmail({
                                    to: customerEmail,
                                    name: refreshedOrder?.customer?.name || 'Customer',
                                    order: refreshedOrder,
                                    previousStatus,
                                    newStatus: status,
                                });
                            }
                        } catch (emailError) {
                            console.error('Order status email failed:', emailError.message || emailError);
                        }
                    }
                }
                result = { success: true };
                break;
            }
            case 'updateOrderDetails': {
                const { orderId, customer, userId } = payload;
                const { data: order, error: orderError } = await supabase.from('orders').select('customer_id, status').eq('id', orderId).single();
                if (orderError) throw new Error(orderError.message);
                if (order.customer_id !== userId) throw new Error('You can only edit your own order.');
                if (order.status !== 'pending') throw new Error('Only pending orders can be edited.');
                const { error } = await supabase.from('orders').update({ customer }).eq('id', orderId);
                if (error) throw new Error(error.message);
                result = { success: true };
                break;
            }
            case 'confirmPayout': {
                const { orderId, adminId } = payload;
                const { error } = await supabase.from('orders').update({
                    payment_status: 'paid',
                    mcs_payment_status: 'done'
                }).eq('id', orderId);
                if (error) throw new Error(error.message);
                if (adminId) await logAction(`Admin confirmed payout for order ${orderId}`, adminId);
                result = { success: true };
                break;
            }
            case 'updateCustomerPaymentVerified': {
                const { orderId, verified, adminId } = payload;
                const { error } = await supabase.from('orders').update({
                    customer_payment_verified: verified,
                    customer_payment_status: verified ? 'done' : 'pending'
                }).eq('id', orderId);
                if (error) throw new Error(error.message);
                if (adminId) await logAction(`Admin verified customer payment for order ${orderId}`, adminId);
                result = { success: true };
                break;
            }
            case 'getLogs': {
                const { data, error } = await supabase.from('logs').select('*').order('timestamp', { ascending: false });
                if (error) throw new Error(error.message);
                result = data;
                break;
            }
            case 'addReview': {
                const { reviewData } = payload;
                const { data, error } = await supabase.from('reviews').insert([{
                    id: `r-${Math.random().toString(36).substr(2, 9)}`,
                    date: new Date().toISOString(),
                    pinned: false,
                    ...reviewData
                }]).select();
                if (error) throw new Error(error.message);
                result = data[0];
                break;
            }
            case 'pinReview': {
                const { reviewId, pinned } = payload;
                const { data, error } = await supabase.from('reviews').update({ pinned }).eq('id', reviewId).select();
                if (error) throw new Error(error.message);
                result = data[0];
                break;
            }
            case 'getReviews': {
                const { productId } = payload;
                const { data: reviews, error: reviewError } = await supabase
                    .from('reviews')
                    .select('*')
                    .eq('productId', productId)
                    .order('pinned', { ascending: false })
                    .order('date', { ascending: false });
                
                if (reviewError) throw new Error(reviewError.message);

                if (reviews && reviews.length > 0) {
                    const userIds = [...new Set(reviews.filter(r => r.userId).map(r => r.userId))];
                    if (userIds.length > 0) {
                        const { data: users, error: userError } = await supabase
                            .from('users')
                            .select('id, avatar_url, name')
                            .in('id', userIds);
                        
                        if (!userError && users) {
                            const userMap = Object.fromEntries(users.map(u => [u.id, u]));
                            result = reviews.map(r => ({
                                ...r,
                                user: userMap[r.userId] || null
                            }));
                        } else {
                            result = reviews;
                        }
                    } else {
                        result = reviews;
                    }
                } else {
                    result = reviews;
                }
                break;
            }
            case 'getWishlists': {
                const { sellerId } = payload;
                const { data, error } = await supabase.from('wishlists').select('*, product:products!productId(*), customer:users!userId(*)');
                if (error) throw new Error(error.message);
                if (sellerId) {
                    result = data.filter((w) => w.product && w.product.seller_id === sellerId);
                } else {
                    result = data;
                }
                break;
            }
            case 'addToWishlist': {
                const { userId, productId } = payload;
                const { data, error } = await supabase.from('wishlists').insert([{
                    id: `w-${Math.random().toString(36).substr(2, 9)}`,
                    userId,
                    productId
                }]).select();
                if (error) throw new Error(error.message);
                result = data[0];
                break;
            }
            case 'removeFromWishlist': {
                const { userId, productId } = payload;
                const { error } = await supabase.from('wishlists').delete().eq('userId', userId).eq('productId', productId);
                if (error) throw new Error(error.message);
                result = { success: true };
                break;
            }
            case 'getHeroSlides': {
                const { data, error } = await supabase.from('hero_slides').select('*').order('sort_order', { ascending: true });
                if (error) throw new Error(error.message);
                result = data;
                break;
            }
            case 'saveHeroSlide': {
                const { slide, adminId } = payload;
                const slideData = {
                    id: slide.id || `h-${Math.random().toString(36).substr(2, 9)}`,
                    cta_label: slide.cta_label || slide.cta || 'Explore Collection',
                    cta_link: slide.cta_link || slide.link || '/products',
                    image: slide.image || '',
                    sort_order: slide.sort_order ?? 0,
                    active: slide.active ?? true
                };
                const { data, error } = await supabase.from('hero_slides').upsert([slideData]).select();
                if (error) throw new Error(error.message);
                if (adminId) await logAction(`Admin saved hero slide "${slideData.cta_label}"`, adminId);
                result = data[0];
                break;
            }
            case 'deleteHeroSlide': {
                const { id, adminId } = payload;
                const { error } = await supabase.from('hero_slides').delete().eq('id', id);
                if (error) throw new Error(error.message);
                if (adminId) await logAction(`Admin deleted hero slide ${id}`, adminId);
                result = { success: true };
                break;
            }
            case 'getJournalPosts': {
                const { data, error } = await supabase.from('journal_posts').select('*').order('created_at', { ascending: false });
                if (error) throw new Error(error.message);
                result = data;
                break;
            }
            case 'saveJournalPost': {
                const { post, adminId } = payload;
                const postData = { ...post };
                if (!postData.id) postData.id = `j-${Math.random().toString(36).substr(2, 9)}`;
                const { data, error } = await supabase.from('journal_posts').upsert([postData]).select();
                if (error) throw new Error(error.message);
                if (adminId) await logAction(`Admin saved journal post "${postData.title}"`, adminId);
                result = data[0];
                break;
            }
            case 'deleteJournalPost': {
                const { id, adminId } = payload;
                const { error } = await supabase.from('journal_posts').delete().eq('id', id);
                if (error) throw new Error(error.message);
                if (adminId) await logAction(`Admin deleted journal post ${id}`, adminId);
                result = { success: true };
                break;
            }
            case 'subscribeJournalEmail': {
                const email = String(payload.email || '').trim().toLowerCase();
                if (!email || !email.includes('@') || !email.includes('.')) {
                    throw new Error('Enter a valid email address.');
                }

                const { data, error } = await supabase.from('journal_subscribers').upsert([
                    {
                        id: `js-${Math.random().toString(36).substr(2, 9)}`,
                        email,
                        created_at: new Date().toISOString()
                    }
                ], { onConflict: 'email' }).select();

                if (error) throw new Error(error.message);
                result = { success: true, email: data?.[0]?.email || email };
                break;
            }
            default:
                throw new Error('Invalid action');
        }

        res.json(result);
    } catch (error) {
        console.error("DB Service Error:", error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/email/verify-otp', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const code = String(req.body?.code || '').trim();
        if (!email || !/^\d{6}$/.test(code)) {
            return res.status(400).json({ error: 'Enter the email address and six-digit verification code.' });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();
        if (userError) throw new Error(userError.message);
        if (!user) return res.status(400).json({ error: 'The verification code is invalid or expired.' });
        if (user.email_verified) return res.status(400).json({ error: 'This email address is already verified. Please sign in.' });

        const { data: verification, error: verificationError } = await supabase
            .from('email_verification_codes')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
        if (verificationError) throw new Error(verificationError.message);
        if (!verification) return res.status(400).json({ error: 'The verification code is invalid or expired. Request a new code.' });
        if (verification.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
            return res.status(429).json({ error: 'Too many incorrect attempts. Request a new verification code.' });
        }

        const expiresAt = new Date(verification.expires_at).getTime();
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            await supabase.from('email_verification_codes').delete().eq('user_id', user.id);
            return res.status(400).json({ error: 'The verification code has expired. Request a new code.' });
        }

        const expectedHash = Buffer.from(verification.code_hash, 'hex');
        const providedHash = Buffer.from(hashEmailVerificationCode(user.id, code), 'hex');
        if (expectedHash.length !== providedHash.length || !crypto.timingSafeEqual(expectedHash, providedHash)) {
            const attempts = Number(verification.attempts || 0) + 1;
            await supabase.from('email_verification_codes').update({ attempts }).eq('user_id', user.id);
            return res.status(attempts >= EMAIL_OTP_MAX_ATTEMPTS ? 429 : 400).json({
                error: attempts >= EMAIL_OTP_MAX_ATTEMPTS
                    ? 'Too many incorrect attempts. Request a new verification code.'
                    : 'That verification code is incorrect.',
            });
        }

        const { data: verifiedUser, error: updateError } = await supabase
            .from('users')
            .update({ email_verified: true })
            .eq('id', user.id)
            .select('*')
            .single();
        if (updateError) throw new Error(updateError.message);
        await supabase.from('email_verification_codes').delete().eq('user_id', user.id);

        const { password, password_hash, ...safeUser } = verifiedUser;
        return res.json({ success: true, user: safeUser });
    } catch (error) {
        console.error('Email OTP verification error:', error);
        return res.status(500).json({ error: 'Unable to verify the email address right now.' });
    }
});

app.post('/api/email/resend-otp', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Enter a valid email address.' });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, email_verified, name, username')
            .eq('email', email)
            .maybeSingle();
        if (userError) throw new Error(userError.message);

        if (user && !user.email_verified) {
            await issueEmailVerificationCode(user);
        }
        return res.json({ success: true, message: 'If the account needs verification, a new code has been sent.' });
    } catch (error) {
        if (error.statusCode === 429) {
            return res.status(429).json({ error: error.message });
        }
        console.error('Email OTP resend error:', error);
        return res.status(500).json({ error: 'Unable to send a verification code right now.' });
    }
});

app.post('/api/support', async (req, res) => {
    try {
        const { name, email, subject, message, orderNumber } = req.body || {};
        const trimmedName = String(name || '').trim();
        const trimmedEmail = String(email || '').trim();
        const trimmedSubject = String(subject || 'Customer support request').trim();
        const trimmedMessage = String(message || '').trim();

        if (!trimmedName || !trimmedEmail || !trimmedMessage) {
            return res.status(400).json({ error: 'Name, email, and message are required.' });
        }

        const result = await sendSupportNotification({
            name: trimmedName,
            email: trimmedEmail,
            subject: trimmedSubject,
            message: trimmedMessage,
            orderNumber: String(orderNumber || '').trim(),
        });

        if (result?.success === false) {
            return res.status(500).json({
                error: 'The support message could not be delivered right now. Please try again later.',
                details: result.error || 'Unknown email error',
            });
        }

        return res.json({ success: true, message: 'Your message has been sent to the support team.' });
    } catch (error) {
        console.error('Support route error:', error);
        return res.status(500).json({ error: 'Unable to send the support message right now.' });
    }
});

app.post('/api/email/manual', async (req, res) => {
    try {
        const {
            to,
            name,
            subject,
            message,
            category = 'general',
            sender = 'hello',
            replyTo = 'support',
            template = '',
            templateMode = 'custom',
            templateVariables = {},
            isHtml = false,
        } = req.body || {};

        const recipient = String(to || '').trim();
        let customerName = String(name || '').trim();
        const emailSubject = String(subject || '').trim();
        const emailBody = String(message || '').trim();
        const templateId = String(template || '').trim();

        const authorization = await getActiveAdminForEmailRequest(req);
        if (authorization.error) return res.status(authorization.status).json({ error: authorization.error });

        if (!recipient || (templateMode === 'template' ? !templateId : !emailSubject || !emailBody)) {
            return res.status(400).json({ error: 'Recipient, subject, and the selected email content are required.' });
        }

        const selectedSender = EMAIL_SENDERS[sender] || EMAIL_SENDERS.hello;
        const selectedReply = EMAIL_SENDERS[replyTo] || EMAIL_SENDERS.support;

        if (templateMode === 'template' && templateId) {
            if (!resend) {
                return res.status(503).json({ error: 'Resend is not configured on the server.' });
            }

            if (!customerName) {
                const { data: customerProfile, error: customerLookupError } = await supabase
                    .from('users')
                    .select('name, username')
                    .eq('email', recipient.toLowerCase())
                    .maybeSingle();
                if (customerLookupError) {
                    console.warn('[email] Could not resolve recipient profile name:', customerLookupError.message);
                }
                customerName = String(customerProfile?.name || customerProfile?.username || getNameFromEmailAddress(recipient)).trim();
            }

            const { data: templateDetails, error: templateError } = await resend.templates.get(templateId);
            if (templateError) {
                return res.status(502).json({ error: templateError.message || 'Unable to retrieve the selected Resend template.' });
            }
            if (templateDetails?.status !== 'published') {
                return res.status(400).json({ error: 'The selected Resend template must be published before it can be sent.' });
            }

            const defaultVariables = buildEmailTemplateVariables({
                userName: customerName,
                userEmail: recipient,
                createdDate: new Date().toISOString(),
                appName: APP_NAME,
            });
            const requestedVariables = templateVariables && typeof templateVariables === 'object' && !Array.isArray(templateVariables)
                ? templateVariables
                : {};
            const variables = {};

            for (const variable of templateDetails.variables || []) {
                const isAutomaticVariable = ['USER_NAME', 'USER_EMAIL', 'APP_NAME', 'CREATED_DATE', 'YEAR'].includes(variable.key);
                const providedValue = isAutomaticVariable ? undefined : requestedVariables[variable.key];
                const fallbackValue = defaultVariables[variable.key] ?? variable.fallback_value;
                const value = providedValue === undefined || providedValue === '' ? fallbackValue : providedValue;

                if (value === undefined || value === null || value === '') {
                    return res.status(400).json({ error: `Enter a value for template variable "${variable.key}".` });
                }

                if (variable.type === 'number') {
                    const numericValue = Number(value);
                    if (!Number.isFinite(numericValue)) {
                        return res.status(400).json({ error: `Template variable "${variable.key}" must be a number.` });
                    }
                    variables[variable.key] = numericValue;
                } else {
                    variables[variable.key] = String(value);
                }
            }

            const result = await sendEmail({
                to: recipient,
                from: selectedSender,
                replyTo: selectedReply,
                subject: emailSubject || undefined,
                category: String(category || 'general').trim() || 'general',
                template: templateId,
                variables,
            });

            if (result?.success === false) {
                return res.status(500).json({ error: result.error || 'Unable to send the selected template email.' });
            }

            return res.json({ success: true, message: 'Template email sent successfully.' });
        }

        const html = isHtml ? emailBody : buildEmailLayout({
            title: emailSubject,
            intro: `Hello ${customerName},`,
            bodyHtml: `<p style="margin:0; font-size:15px; line-height:1.8; color:#2a2723;">${escapeHtml(emailBody).replace(/\n/g, '<br />')}</p>`,
            footerText: 'This message was sent manually from the Mithila Chitrakala Store admin console.',
            previewText: emailSubject,
            createdDate: new Date().toISOString(),
            userEmail: recipient,
            userName: customerName,
            appName: APP_NAME,
        });

        const result = await sendEmail({
            to: recipient,
            from: selectedSender,
            replyTo: selectedReply,
            subject: emailSubject,
            html,
            text: isHtml ? htmlToPlainText(html) : emailBody,
            category: String(category || 'general').trim() || 'general',
        });

        if (result?.success === false) {
            return res.status(500).json({ error: result.error || 'Unable to send the custom email.' });
        }

        return res.json({ success: true, message: 'Manual email sent successfully.' });
    } catch (error) {
        console.error('Manual email route error:', error);
        return res.status(500).json({ error: error.message || 'Unable to send the manual email.' });
    }
});

app.post('/api/email/admin-session', async (req, res) => {
    try {
        if (!ADMIN_EMAIL_TOKEN_SECRET) {
            return res.status(503).json({ error: 'Admin email signing is not configured on the server.' });
        }

        const supabaseAccessToken = String(req.body?.supabaseAccessToken || '').trim();
        if (!supabaseAccessToken) {
            return res.status(401).json({ error: 'A valid Supabase sign-in session is required.' });
        }

        const { data: authData, error: authError } = await supabase.auth.getUser(supabaseAccessToken);
        if (authError || !authData?.user?.email) {
            return res.status(401).json({ error: 'The Supabase sign-in session is invalid or expired.' });
        }

        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('id, role, status')
            .eq('email', authData.user.email)
            .maybeSingle();

        if (adminError) throw new Error(adminError.message);
        if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
            return res.status(403).json({ error: 'Only active administrators can use manual email tools.' });
        }

        return res.json({ emailAdminToken: createAdminEmailToken(admin.id) });
    } catch (error) {
        console.error('Admin email session exchange error:', error);
        return res.status(500).json({ error: error.message || 'Unable to create the admin email session.' });
    }
});

app.get('/api/email/templates', async (req, res) => {
    try {
        const authorization = await getActiveAdminForEmailRequest(req);
        if (authorization.error) return res.status(authorization.status).json({ error: authorization.error });
        if (!resend) {
            return res.status(503).json({ error: 'Resend is not configured on the server.' });
        }

        const { data, error } = await resend.templates.list({ limit: 100 });
        if (error) {
            return res.status(502).json({ error: error.message || 'Unable to retrieve Resend templates.' });
        }

        return res.json({ templates: (data?.data || []).filter((template) => template.status === 'published') });
    } catch (error) {
        console.error('Resend template list error:', error);
        return res.status(500).json({ error: error.message || 'Unable to retrieve Resend templates.' });
    }
});

app.get('/api/email/templates/:templateId', async (req, res) => {
    try {
        const authorization = await getActiveAdminForEmailRequest(req);
        if (authorization.error) return res.status(authorization.status).json({ error: authorization.error });
        if (!resend) {
            return res.status(503).json({ error: 'Resend is not configured on the server.' });
        }

        const { data, error } = await resend.templates.get(String(req.params.templateId || '').trim());
        if (error) return res.status(502).json({ error: error.message || 'Unable to retrieve the Resend template.' });
        if (data?.status !== 'published') {
            return res.status(400).json({ error: 'Only published Resend templates can be sent.' });
        }

        return res.json({ template: data });
    } catch (error) {
        console.error('Resend template detail error:', error);
        return res.status(500).json({ error: error.message || 'Unable to retrieve the Resend template.' });
    }
});

app.post('/api/email/test', async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production' && process.env.ENABLE_EMAIL_TESTS !== 'true') {
            return res.status(403).json({ error: 'Email testing is disabled in production.' });
        }

        const { type = 'welcome', to, name, email, verificationUrl, resetUrl, order, previousStatus, newStatus, subject, message, orderNumber } = req.body || {};
        const recipient = String(to || email || '').trim();
        const customerName = String(name || 'Test Customer').trim();

        if (!recipient && !['welcome', 'verification', 'reset', 'order-confirmation', 'order-status', 'shipping', 'support'].includes(type)) {
            return res.status(400).json({ error: 'A valid recipient email address is required for the selected test type.' });
        }

        const handlers = {
            welcome: () => sendWelcomeEmail({ to: recipient || 'hello@mithilachitrakalastore.com.np', name: customerName }),
            verification: () => sendEmailVerification({ to: recipient || 'hello@mithilachitrakalastore.com.np', name: customerName, verificationUrl: verificationUrl || 'https://mithilachitrakalastore.com.np/verify-email', expiresIn: '30 minutes' }),
            reset: () => sendPasswordResetEmail({ to: recipient || 'hello@mithilachitrakalastore.com.np', name: customerName, resetUrl: resetUrl || 'https://mithilachitrakalastore.com.np/reset-password', expiresIn: '30 minutes' }),
            'order-confirmation': () => sendOrderConfirmationEmail({
                to: recipient || 'hello@mithilachitrakalastore.com.np',
                name: customerName,
                order: order || {
                    id: 'TEST-ORDER-001',
                    date: new Date().toISOString(),
                    customer: { name: customerName, email: recipient || 'hello@mithilachitrakalastore.com.np', address: 'Kathmandu, Nepal', city: 'Kathmandu' },
                    items: [{ name: 'Mithila Art Print', quantity: 1, price: 3500 }],
                    subtotal: 3500,
                    shipping_fee: 250,
                    total: 3750,
                    customer_payment_status: 'pending',
                },
            }),
            'order-status': () => sendOrderStatusEmail({
                to: recipient || 'hello@mithilachitrakalastore.com.np',
                name: customerName,
                order: order || { id: 'TEST-ORDER-001', date: new Date().toISOString(), customer: { name: customerName, email: recipient || 'hello@mithilachitrakalastore.com.np' }, status: 'processing' },
                previousStatus: previousStatus || 'pending',
                newStatus: newStatus || 'processing',
            }),
            shipping: () => sendShippingEmail({
                to: recipient || 'hello@mithilachitrakalastore.com.np',
                name: customerName,
                order: order || { id: 'TEST-ORDER-001', date: new Date().toISOString(), customer: { name: customerName, email: recipient || 'hello@mithilachitrakalastore.com.np' } },
                shippingInfo: 'Courier handoff to Araniko Logistics',
                trackingNumber: 'MCS-TRK-TEST-001',
                trackingUrl: 'https://mithilachitrakalastore.com.np/profile',
                expectedDelivery: '3–5 business days',
            }),
            support: () => sendSupportNotification({
                name: customerName,
                email: recipient || 'hello@mithilachitrakalastore.com.np',
                subject: subject || 'Test support request',
                message: message || 'This is a test support email from the local development environment.',
                orderNumber: orderNumber || 'TEST-ORDER-001',
            }),
        };

        const handler = handlers[type];
        if (!handler) {
            return res.status(400).json({ error: 'Unsupported email test type.' });
        }

        const result = await handler();
        return res.json({
            success: result?.success !== false,
            type,
            result,
            note: 'Email test sent only in non-production environments or when ENABLE_EMAIL_TESTS=true.',
        });
    } catch (error) {
        console.error('Email test endpoint error:', error);
        return res.status(500).json({ error: error.message || 'Unable to send the email test.' });
    }
});

const sendPaidOrderConfirmation = async (order) => {
    const recipient = order.customer?.email || order.customer_email;
    if (!recipient) return;
    try {
        await sendOrderConfirmationEmail({
            to: recipient,
            name: order.customer?.name || 'Customer',
            order,
        });
    } catch (error) {
        console.error('Paid order confirmation email failed:', error.message || error);
    }
};

app.post('/api/payments/start', async (req, res) => {
    let paymentSessionId;
    try {
        const { orderIds, userId, gateway, paymentType } = req.body || {};
        const requestedOrderIds = [...new Set((Array.isArray(orderIds) ? orderIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean))];
        if (!userId || requestedOrderIds.length === 0 || requestedOrderIds.length > 50) {
            return res.status(400).json({ error: 'A customer and at least one order are required.' });
        }
        if (!['esewa', 'khalti'].includes(gateway)) {
            return res.status(400).json({ error: 'Choose eSewa or Khalti.' });
        }
        if (!['advance', 'full', 'balance'].includes(paymentType)) {
            return res.status(400).json({ error: 'Choose advance, full, or remaining balance payment.' });
        }

        const { data: orders, error: orderError } = await supabase
            .from('orders')
            .select('id, customer_id, total, amount_paid, advance_due_amount, payment_type, status, customer')
            .in('id', requestedOrderIds)
            .eq('customer_id', String(userId));
        if (orderError) throw new Error(orderError.message);
        if (orders.length !== requestedOrderIds.length) {
            return res.status(404).json({ error: 'One or more orders could not be found for this account.' });
        }

        const allocations = orders.map((order) => {
            if (order.status === 'cancelled') throw new Error(`Order ${order.id} has been cancelled.`);
            const total = Number(order.total);
            const paid = Number(order.amount_paid || 0);
            if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(paid) || paid < 0) {
                throw new Error(`Order ${order.id} has an invalid payment balance.`);
            }
            if (paymentType !== 'balance' && order.payment_type !== paymentType) {
                throw new Error(`Order ${order.id} is not eligible for this payment option.`);
            }

            let amount = total - paid;
            if (paymentType === 'advance') amount = Number(order.advance_due_amount || 0) - paid;
            amount = Math.round(Math.min(amount, total - paid) * 100) / 100;
            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error(`Order ${order.id} has no amount due for this payment option.`);
            }
            return { order_id: order.id, amount: amount.toFixed(2) };
        });
        const paymentAmount = Math.round(allocations.reduce((sum, item) => sum + Number(item.amount), 0) * 100) / 100;
        const { data: session, error: sessionError } = await supabase
            .from('payment_sessions')
            .insert([{
                customer_id: String(userId),
                order_allocations: allocations,
                amount: paymentAmount,
                gateway,
                payment_type: paymentType,
            }])
            .select()
            .single();
        if (sessionError) throw new Error(sessionError.message);
        paymentSessionId = session.id;
        const { error: paymentMethodError } = await supabase
            .from('orders')
            .update({ payment_gateway: gateway })
            .in('id', requestedOrderIds)
            .eq('customer_id', String(userId));
        if (paymentMethodError) throw new Error(paymentMethodError.message);

        const frontendUrl = getFrontendBaseUrl(req);
        const callbackUrl = getPaymentCallbackBaseUrl(req);
        if (gateway === 'khalti') {
            if (!process.env.KHALTI_SECRET_KEY) throw new Error('Khalti is not configured on the server.');
            const khaltiResponse = await fetch(`${getKhaltiApiBaseUrl()}/epayment/initiate/`, {
                method: 'POST',
                headers: {
                    Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    return_url: `${callbackUrl}/api/payments/khalti/return`,
                    website_url: frontendUrl,
                    amount: Math.round(paymentAmount * 100),
                    purchase_order_id: session.id,
                    purchase_order_name: `Mithila order ${requestedOrderIds.join(', ')}`,
                    customer_info: {
                        name: orders[0].customer?.name || 'Customer',
                        email: orders[0].customer?.email || '',
                        phone: orders[0].customer?.phone || '',
                    },
                }),
            });
            const khaltiData = await khaltiResponse.json().catch(() => ({}));
            if (!khaltiResponse.ok || !khaltiData.payment_url || !khaltiData.pidx) {
                throw new Error(khaltiData.detail || khaltiData.error_key || 'Khalti could not create a payment session.');
            }
            const { error: updateError } = await supabase
                .from('payment_sessions')
                .update({ provider_reference: khaltiData.pidx })
                .eq('id', session.id);
            if (updateError) throw new Error(updateError.message);
            return res.json({ gateway, paymentUrl: khaltiData.payment_url });
        }

        const { productCode, secretKey } = getEsewaCredentials();
        const amount = paymentAmount.toFixed(2);
        const signedFieldNames = 'total_amount,transaction_uuid,product_code';
        const signature = crypto.createHmac('sha256', secretKey)
            .update(`total_amount=${amount},transaction_uuid=${session.id},product_code=${productCode}`)
            .digest('base64');
        const esewaBaseUrl = (process.env.ESEWA_BASE_URL || 'https://rc-epay.esewa.com.np').replace(/\/+$/, '');
        const returnUrl = `${callbackUrl}/api/payments/esewa/return`;
        return res.json({
            gateway,
            paymentUrl: `${esewaBaseUrl}/api/epay/main/v2/form`,
            fields: {
                amount,
                tax_amount: '0',
                total_amount: amount,
                transaction_uuid: session.id,
                product_code: productCode,
                product_service_charge: '0',
                product_delivery_charge: '0',
                success_url: returnUrl,
                failure_url: returnUrl,
                signed_field_names: signedFieldNames,
                signature,
            },
        });
    } catch (error) {
        if (paymentSessionId) {
            const { error: updateError } = await supabase
                .from('payment_sessions')
                .update({ status: 'failed' })
                .eq('id', paymentSessionId);
            if (updateError) console.error('Failed to mark payment session as failed:', updateError.message);
        }
        console.error('Payment initiation failed:', error);
        return res.status(502).json({ error: error.message || 'Unable to start payment.' });
    }
});

app.get('/api/payments/khalti/return', async (req, res) => {
    const frontendUrl = getFrontendBaseUrl(req);
    try {
        const pidx = String(req.query.pidx || '');
        const sessionId = String(req.query.purchase_order_id || '');
        if (!pidx || !sessionId || !process.env.KHALTI_SECRET_KEY) {
            return res.redirect(`${frontendUrl}/profile?payment=failed`);
        }
        const { data: session, error: sessionError } = await supabase
            .from('payment_sessions')
            .select('id, amount, gateway, provider_reference, payment_type, order_allocations, status')
            .eq('id', sessionId)
            .maybeSingle();
        if (sessionError) throw new Error(sessionError.message);
        if (!session || session.gateway !== 'khalti' || session.provider_reference !== pidx) {
            return res.redirect(`${frontendUrl}/profile?payment=failed`);
        }
        const lookupResponse = await fetch(`${getKhaltiApiBaseUrl()}/epayment/lookup/`, {
            method: 'POST',
            headers: {
                Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pidx }),
        });
        const lookup = await lookupResponse.json().catch(() => ({}));
        if (!lookupResponse.ok || lookup.status !== 'Completed' ||
            Number(lookup.total_amount) !== Math.round(Number(session.amount) * 100) ||
            (lookup.purchase_order_id && lookup.purchase_order_id !== session.id)) {
            return res.redirect(`${frontendUrl}/profile?payment=failed`);
        }
        const { error: completionError } = await supabase.rpc('complete_payment_session', {
            session_id: session.id,
            gateway_reference: pidx,
        });
        if (completionError) throw new Error(completionError.message);
        if (session.payment_type !== 'balance' && session.status !== 'completed') {
            const orderIds = session.order_allocations.map((allocation) => allocation.order_id);
            const { data: paidOrders, error: paidOrdersError } = await supabase.from('orders').select('*').in('id', orderIds);
            if (paidOrdersError) throw new Error(paidOrdersError.message);
            for (const order of paidOrders) await sendPaidOrderConfirmation(order);
        }
        return res.redirect(`${frontendUrl}/profile?payment=success`);
    } catch (error) {
        console.error('Khalti payment verification failed:', error);
        return res.redirect(`${frontendUrl}/profile?payment=failed`);
    }
});

app.get('/api/payments/esewa/return', async (req, res) => {
    const frontendUrl = getFrontendBaseUrl(req);
    try {
        if (!req.query.data) {
            return res.redirect(`${frontendUrl}/profile?payment=failed`);
        }
        const { productCode, secretKey } = getEsewaCredentials();
        const responseData = JSON.parse(Buffer.from(String(req.query.data), 'base64').toString('utf8'));
        const sessionId = String(responseData.transaction_uuid || '');
        if (!sessionId || responseData.product_code !== productCode) {
            return res.redirect(`${frontendUrl}/profile?payment=failed`);
        }
        const { data: session, error: sessionError } = await supabase
            .from('payment_sessions')
            .select('id, amount, gateway, payment_type, order_allocations, status')
            .eq('id', sessionId)
            .maybeSingle();
        if (sessionError) throw new Error(sessionError.message);
        if (!session || session.gateway !== 'esewa') {
            return res.redirect(`${frontendUrl}/profile?payment=failed`);
        }

        const esewaBaseUrl = (process.env.ESEWA_BASE_URL || 'https://rc-epay.esewa.com.np').replace(/\/+$/, '');
        const statusUrl = new URL(`${esewaBaseUrl}/api/epay/transaction/status/`);
        statusUrl.search = new URLSearchParams({
            product_code: productCode,
            total_amount: Number(session.amount).toFixed(2),
            transaction_uuid: session.id,
        }).toString();
        const statusResponse = await fetch(statusUrl);
        const statusData = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok || statusData.status !== 'COMPLETE' ||
            Number.parseFloat(String(statusData.total_amount).replace(/[^\d.]/g, '')) !== Number(session.amount) ||
            (statusData.transaction_uuid && statusData.transaction_uuid !== session.id)) {
            return res.redirect(`${frontendUrl}/profile?payment=failed`);
        }
        const { error: completionError } = await supabase.rpc('complete_payment_session', {
            session_id: session.id,
            gateway_reference: String(responseData.transaction_code || responseData.refId || session.id),
        });
        if (completionError) throw new Error(completionError.message);
        if (session.payment_type !== 'balance' && session.status !== 'completed') {
            const orderIds = session.order_allocations.map((allocation) => allocation.order_id);
            const { data: paidOrders, error: paidOrdersError } = await supabase.from('orders').select('*').in('id', orderIds);
            if (paidOrdersError) throw new Error(paidOrdersError.message);
            for (const order of paidOrders) await sendPaidOrderConfirmation(order);
        }
        return res.redirect(`${frontendUrl}/profile?payment=success`);
    } catch (error) {
        console.error('eSewa payment verification failed:', error);
        return res.redirect(`${frontendUrl}/profile?payment=failed`);
    }
});

app.use(express.static(path.join(__dirname, 'dist')));

const escapeHtmlAttribute = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const defaultShareImage = 'https://res.cloudinary.com/djmbuuz28/image/upload/w_1200,h_630,c_pad,b_white,f_jpg,q_auto/v1790219754/LOGO_only_Zoomed_for_search_results_ynpjvm.png';
const shareImageMetadata = (imageUrl) => `
    <meta property="og:image:secure_url" content="${escapeHtmlAttribute(imageUrl)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />`;

const buildProductShareImageUrl = (product = {}) => {
    const configuredCloudName = cloudinaryCloudName || 'djmbuuz28';

    const candidateImages = [
        ...(Array.isArray(product.images) ? product.images : []),
        product.image,
        product.product_image_id,
        product.image_public_id,
        product.cloudinary_public_id,
    ].filter(Boolean);

    const normalizeCloudinaryImage = (value) => {
        const candidate = String(value || '').trim();
        if (!candidate) return null;

        const directPublicId = candidate
            .replace(/^https?:\/\/[^/]+\/[^/]+\/image\/upload\/(?:v\d+\/)?/, '')
            .replace(/^https?:\/\/[^/]+\//, '')
            .replace(/\.[^.]+$/, '')
            .replace(/^\//, '');

        if (directPublicId && directPublicId !== candidate) {
            return `https://res.cloudinary.com/${configuredCloudName}/image/upload/w_1200,h_630,c_fill,f_jpg,q_auto/${directPublicId}`;
        }

        if (candidate.includes('/image/upload/')) {
            try {
                const parsedUrl = new URL(candidate);
                const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
                const uploadIndex = pathParts.indexOf('upload');
                if (uploadIndex !== -1) {
                    const publicId = pathParts.slice(uploadIndex + 1).join('/').replace(/^v\d+\//, '').replace(/\.[^.]+$/, '');
                    if (publicId) {
                        return `https://res.cloudinary.com/${configuredCloudName}/image/upload/w_1200,h_630,c_fill,f_jpg,q_auto/${publicId}`;
                    }
                }
            } catch (error) {
                console.warn('Unable to normalize Cloudinary product image URL for share preview:', error.message);
            }
        }

        if (/^https?:\/\//i.test(candidate)) return candidate;

        return `https://res.cloudinary.com/${configuredCloudName}/image/upload/w_1200,h_630,c_fill,f_jpg,q_auto/${candidate}`;
    };

    for (const imageCandidate of candidateImages) {
        const normalized = normalizeCloudinaryImage(imageCandidate);
        if (normalized) {
            return normalized;
        }
    }

    return defaultShareImage;
};

app.get('/share/product/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const frontendBaseUrl = process.env.PUBLIC_FRONTEND_URL || process.env.VITE_APP_URL || `${req.protocol}://${req.get('host')}`;
        const targetProductUrl = `${frontendBaseUrl.replace(/\/+$/, '')}/product/${encodeURIComponent(productId)}`;

        const { data: product, error } = await supabase
            .from('products')
            .select('id, slug, name, title, description, image, product_image_id, image_public_id, cloudinary_public_id')
            .eq('id', productId)
            .maybeSingle();

        if (error) {
            console.error('Share product lookup failed:', error.message);
            return res.redirect(`${frontendBaseUrl.replace(/\/+$/, '')}/`);
        }

        if (!product) {
            return res.redirect(`${frontendBaseUrl.replace(/\/+$/, '')}/`);
        }

        const productTitle = String(product.title || product.name || 'Mithila Chitrakala Store').trim();
        const productDescription = String(product.description || `Discover ${productTitle} at Mithila Chitrakala Store.`).trim();
        const shareImage = buildProductShareImageUrl(product);
        const ogUrl = `${frontendBaseUrl.replace(/\/+$/, '')}/product/${encodeURIComponent(product.slug || productId)}`;
        const pageTitle = `${productTitle} | Mithila Chitrakala Store`;
        const safeDescription = productDescription || `Discover ${productTitle} at Mithila Chitrakala Store.`;

        const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtmlAttribute(pageTitle)}</title>
    <meta name="description" content="${escapeHtmlAttribute(safeDescription)}" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escapeHtmlAttribute(pageTitle)}" />
    <meta property="og:description" content="${escapeHtmlAttribute(safeDescription)}" />
    <meta property="og:image" content="${escapeHtmlAttribute(shareImage)}" />
    ${shareImageMetadata(shareImage)}
    <meta property="og:url" content="${escapeHtmlAttribute(ogUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttribute(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtmlAttribute(safeDescription)}" />
    <meta name="twitter:image" content="${escapeHtmlAttribute(shareImage)}" />
    <script>
      window.location.replace(${JSON.stringify(ogUrl)});
    </script>
  </head>
  <body></body>
</html>`;

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error('Share proxy error:', error);
        return res.redirect('/');
    }
});

app.get('/product/:slug', async (req, res, next) => {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('name, description, image, slug')
            .eq('slug', req.params.slug)
            .maybeSingle();

        if (error || !product) return next();

        const title = `${product.name} | Mithila Chitrakala Store`;
        const description = product.description || `Discover ${product.name} at Mithila Chitrakala Store.`;
        const pageUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        let html = fs.readFileSync(path.join(__dirname, 'dist', 'index.html'), 'utf8');
        const shareImage = buildProductShareImageUrl(product);
        const replaceMetaContent = (selector, content) => {
            const pattern = new RegExp(`(<meta\\s+${selector}\\s+content=")[^"]*("\\s*/?>)`, 'i');
            html = html.replace(pattern, `$1${escapeHtmlAttribute(content)}$2`);
        };

        html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtmlAttribute(title)}</title>`);
        replaceMetaContent('name="description"', description);
        replaceMetaContent('property="og:title"', title);
        replaceMetaContent('property="og:description"', description);
        replaceMetaContent('property="og:url"', pageUrl);
        replaceMetaContent('property="og:image"', shareImage);
        replaceMetaContent('name="twitter:title"', title);
        replaceMetaContent('name="twitter:description"', description);
        replaceMetaContent('name="twitter:image"', shareImage);
        html = html.replace('</head>', `${shareImageMetadata(shareImage)}\n</head>`);
        html = html.replace('</head>', `<link rel="canonical" href="${escapeHtmlAttribute(pageUrl)}">\n</head>`);
        res.send(html);
    } catch (error) {
        next(error);
    }
});


// Handle SPA routing: send all non-API requests to index.html
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
}); 

app.listen(PORT, () => {
    console.log(`Node Server running on http://localhost:${PORT}`);
});
