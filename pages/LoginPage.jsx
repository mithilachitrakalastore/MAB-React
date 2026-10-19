import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/dbservices';
import { supabase } from '../services/supabaseClient';
import { Sparkles, Mail, ArrowRight, Lock, User as UserIcon, Phone, MapPin, Eye, EyeOff } from 'lucide-react';

export const LoginPage = ({ onLogin }) => {
    const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'completeProfile'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [picture, setPicture] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('');
    const [error, setError] = useState('');
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationMessage, setVerificationMessage] = useState('');
    const [resendingVerificationCode, setResendingVerificationCode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [googleProfile, setGoogleProfile] = useState(null);
    const sessionHandled = useRef(false);
    const submitInProgress = useRef(false);

    useEffect(() => {
        const callbackParams = new URLSearchParams(window.location.search);
        const oauthError = callbackParams.get('error_description') || callbackParams.get('error');
        if (oauthError) setError(oauthError);

        const processSession = (session) => {
            if (session) window.setTimeout(() => handleGoogleSession(session), 0);
        };
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') processSession(session);
        });

        const checkSession = async () => {
            try {
                const { data, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                processSession(data.session);
            } catch (sessionError) {
                console.error('Unable to restore Google sign-in session:', sessionError);
                setError('Unable to complete Google sign-in. Please try again.');
            }
        };
        checkSession();
        return () => authListener.subscription.unsubscribe();
    }, []);

    const handleGoogleSession = async (session) => {
        // Guard: only process the Google session once
        if (sessionHandled.current) return;
        sessionHandled.current = true;

        try {
            const email = session.user.email;
            if (!email) throw new Error('Google did not provide an email address.');
            const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email;
            const avatar_url = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;

            const existingUser = await dbService.getUserByEmail(email);
            const profileNeedsCompletion = !existingUser?.name || !existingUser?.address ||
                !existingUser?.age || !existingUser?.gender;
            if (existingUser && !profileNeedsCompletion) {
                const verifiedUser = existingUser.email_verified === false
                    ? await dbService.registerGoogleUser({
                        email,
                        name: existingUser.name,
                        phone: existingUser.phone || '',
                        address: existingUser.address,
                        city: existingUser.city || '',
                        age: existingUser.age,
                        gender: existingUser.gender,
                        username: existingUser.username,
                        picture: avatar_url,
                    })
                    : existingUser;
                const emailAdminToken = existingUser.role === 'admin'
                    ? await dbService.createAdminEmailSession(session.access_token)
                    : undefined;
                await supabase.auth.signOut();
                const userWithAvatar = { ...verifiedUser, avatar_url, emailAdminToken };
                onLogin(userWithAvatar);
            } else {
                setAuthMode('completeProfile');
                setName(existingUser?.name || name);
                setEmail(email);
                setAddress(existingUser?.address || '');
                setAge(existingUser?.age ? String(existingUser.age) : '');
                setGender(existingUser?.gender || '');
                setGoogleProfile({ email, name: existingUser?.name || name, avatar_url });
            }
        } catch (err) {
            console.error('Error handling Google session:', err);
            sessionHandled.current = false; // Allow retry on error
            setError(err.message || 'Failed to verify Google account.');
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: new URL('/login', window.location.origin).toString()
                }
            });
            if (error) throw error;
        } catch (err) {
            setError(err.message || 'Unable to start Google sign-in. Please try again.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitInProgress.current) return;
        submitInProgress.current = true;
        setIsSubmitting(true);
        setError('');

        try {
            if (authMode === 'verifyEmail') {
                const verifiedUser = await dbService.verifyEmailOtp(pendingVerificationEmail, verificationCode);
                setVerificationMessage('');
                if (verifiedUser?.status === 'disabled') {
                    alert('Email verified. Your artisan account is waiting for administrator approval.');
                    setAuthMode('login');
                    return;
                }
                onLogin(verifiedUser);
            } else if (authMode === 'login') {
                const user = await dbService.login(username, password);
                if (user?.requiresEmailVerification) {
                    setPendingVerificationEmail(user.email || username);
                    setVerificationCode('');
                    setVerificationMessage('Your account needs email verification. Enter the six-digit code we sent you.');
                    setAuthMode('verifyEmail');
                } else if (user) onLogin(user);
                else setError('Invalid credentials or inactive account.');
            } else if (authMode === 'register') {
                if (!gender) {
                    setError('Please select your gender.');
                    return;
                }
                const newUser = await dbService.register({
                    username,
                    password,
                    name,
                    email,
                    role: 'customer',
                    phone: phone || undefined,
                    address: address || undefined,
                    city: city || undefined,
                    gender
                });
                if (newUser.status === 'disabled') {
                    setPendingVerificationEmail(newUser.email || email);
                    setVerificationCode('');
                    setVerificationMessage(newUser.verificationEmailSent
                        ? 'Enter the six-digit verification code sent to your email. Your artisan account will still need administrator approval.'
                        : 'Your account was created, but the verification email could not be sent. You can try resending the code below.');
                    setAuthMode('verifyEmail');
                } else if (newUser.emailVerificationRequired) {
                    setPendingVerificationEmail(newUser.email || email);
                    setVerificationCode('');
                    setVerificationMessage(newUser.verificationEmailSent
                        ? 'Enter the six-digit verification code sent to your email.'
                        : 'Your account was created, but the verification email could not be sent. You can try resending the code below.');
                    setAuthMode('verifyEmail');
                } else {
                    onLogin(newUser);
                }
            } else if (authMode === 'completeProfile') {
                if (!googleProfile || !name.trim() || !address.trim() || !age || !gender) {
                    setError('Please enter your full name, address, age, and gender.');
                    return;
                }
                const numericAge = Number(age);
                if (!Number.isInteger(numericAge) || numericAge < 13 || numericAge > 120) {
                    setError('Please enter an age between 13 and 120.');
                    return;
                }
                const randomPart = Math.random().toString(36).substr(2, 4);
                const generatedUsername = googleProfile.email.split('@')[0] + randomPart;

                const newUser = await dbService.registerGoogleUser({
                    picture: googleProfile.avatar_url,
                    email: googleProfile.email,
                    name: name.trim(),
                    phone: phone.trim(),
                    address: address.trim(),
                    city: city.trim(),
                    age: numericAge,
                    gender,
                    username: generatedUsername,
                    // No password needed for Google users
                });

                if (!newUser?.id) throw new Error('Your profile was not saved. Please try again.');
                await supabase.auth.signOut();
                onLogin(newUser);
            }
        } catch (err) {
            setError(err.message || 'An error occurred.');
        } finally {
            submitInProgress.current = false;
            setIsSubmitting(false);
        }
    };

    const handleResendVerificationCode = async () => {
        setResendingVerificationCode(true);
        setError('');
        try {
            const result = await dbService.resendEmailOtp(pendingVerificationEmail);
            setVerificationMessage(result.message || 'If the account needs verification, a new code has been sent.');
        } catch (resendError) {
            setError(resendError.message || 'Unable to resend the verification code.');
        } finally {
            setResendingVerificationCode(false);
        }
    };

    const isLogin = authMode === 'login';
    const isRegister = authMode === 'register';
    const welcomeCopy = isLogin
        ? {
            eyebrow: 'Your heritage awaits',
            title: <>Welcome back<br /><em>to Mithila</em></>,
            intro: <>Sign in to continue discovering<br className="hidden sm:block" /> authentic art, handmade with love<br className="hidden sm:block" /> and rooted in tradition.</>,
            heading: 'Welcome back to Mithila',
            subheading: 'Sign in to continue your journey through authentic Mithila art.'
        }
        : isRegister
            ? {
                eyebrow: 'Begin your story',
                title: <>Make room<br /><em>for Mithila</em></>,
                intro: <>Create your account and bring<br className="hidden sm:block" /> the color, craft, and spirit<br className="hidden sm:block" /> of Mithila into your world.</>,
                heading: 'Start your Mithila journey',
                subheading: 'Create an account and become part of our heritage community.'
            }
            : authMode === 'completeProfile' ? {
                eyebrow: 'One step from home',
                title: <>Complete your<br /><em>heritage profile</em></>,
                intro: <>Tell us a little more about<br className="hidden sm:block" /> yourself so your Mithila journey<br className="hidden sm:block" /> can begin.</>,
                heading: 'Complete your profile',
                subheading: 'A few more details and your heritage profile is ready.'
            } : {
                eyebrow: 'One final step',
                title: <>Verify your<br /><em>email address</em></>,
                intro: <>A secure six-digit code is on its way<br className="hidden sm:block" /> to your inbox.</>,
                heading: 'Verify your email',
                subheading: `Enter the code sent to ${pendingVerificationEmail || 'your email address'}.`,
            };

    return (
        <div className="login-page">
            <div className="login-page__shell">
                <section className="login-page__art-panel" aria-label="Mithila Chitrakala welcome">
                    <div className="login-page__art-wash" />
                    <div className="login-page__art-copy">
                        <p className="login-page__eyebrow">{welcomeCopy.eyebrow} <span /> Mithila <span /> Art</p>
                        <h1>{welcomeCopy.title}</h1>
                        <p className="login-page__intro">{welcomeCopy.intro}</p>
                        <div className="login-page__ornament"><span /> <span>✦</span> <span /></div>
                    </div>
                    <div className="login-page__art-credit">A living tradition, made by hand</div>
                    <div className="login-page__benefits" aria-label="Store values">
                        <span><b>♡</b> Support Local Artisans</span>
                        <span><b>♧</b> Preserve Mithila Heritage</span>
                        <span><b>♧</b> Authentic Handcrafted Art</span>
                    </div>
                </section>

                <section className="login-page__form-panel">
                    <div className="login-page__brand-lockup">
                        <img src="https://res.cloudinary.com/djmbuuz28/image/upload/v1761108817/logo.png" alt="" />
                        <strong>Mithila Chitrakala</strong>
                        <small>Store</small>
                    </div>

                    {(isLogin || isRegister) && (
                        <div className="login-page__tabs" role="group" aria-label="Account access">
                            <button type="button" className={isLogin ? 'is-active' : ''} onClick={() => { setAuthMode('login'); setError(''); }}>Sign In</button>
                            <button type="button" className={isRegister ? 'is-active' : ''} onClick={() => { setAuthMode('register'); setError(''); }}>Create Account</button>
                        </div>
                    )}

                    <div className="login-page__heading">
                        <h2>{welcomeCopy.heading}</h2>
                        <p>{welcomeCopy.subheading}</p>
                    </div>

                    {error && <p className="login-page__error" role="alert">{error}</p>}
                    {verificationMessage && <p className="text-center text-sm text-stone-600" role="status">{verificationMessage}</p>}

                    <form onSubmit={handleSubmit} className="login-page__form space-y-6">
                    {authMode === 'completeProfile' && (
                        <div className="space-y-6">
                            <p className="text-center text-xs text-stone-500 mb-6">
                                We need a bit more info to establish your heritage profile.
                            </p>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-stone-400 pl-4">Your Full Name</label>
                                <div className="relative">
                                    <UserIcon size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" type="text" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="google-age" className="text-[10px] font-black uppercase text-stone-400 pl-4">Age</label>
                                <input id="google-age" required value={age} onChange={e => setAge(e.target.value)} min="13" max="120" step="1" type="number" inputMode="numeric" className="w-full rounded-2xl border border-transparent bg-[#efece6] px-5 py-4 font-medium outline-none transition-all focus:border-[#5c1111]/20 focus:bg-white" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-stone-400 pl-4">Phone Number</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input required value={phone} title='Enter Your Contact Number' onChange={e => setPhone(e.target.value)} type="tel" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-stone-400 pl-4">Address</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input required value={address} title='Enter Your Address' onChange={e => setAddress(e.target.value)} type="text" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-stone-400 pl-4">City</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input required value={city} title='Enter Your City' onChange={e => setCity(e.target.value)} type="text" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="google-gender" className="text-[10px] font-black uppercase text-stone-400 pl-4">Gender</label>
                                <select id="google-gender" required value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-2xl border border-transparent bg-[#efece6] px-5 py-4 font-medium outline-none transition-all focus:border-[#5c1111]/20 focus:bg-white">
                                    <option value="">Select your gender</option>
                                    <option value="female">Female</option>
                                    <option value="male">Male</option>
                                    <option value="non-binary">Non-binary</option>
                                    <option value="prefer-not-to-say">Prefer not to say</option>
                                </select>
                                <p className="px-1 text-[9px] text-stone-400">You can change this later in your profile.</p>
                            </div>

                            <button type="submit" disabled={isSubmitting} className="w-full bg-[#5c1111] text-white py-6 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.3em] shadow-2xl premium-shadow hover:bg-[#2a2723] hover:-translate-y-1 transition-all disabled:cursor-wait disabled:opacity-60">
                                Establish Heritage
                            </button>
                        </div>
                    )}

                    {authMode === 'verifyEmail' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="email-verification-code" className="text-[10px] font-black uppercase text-stone-400 pl-4">Six-digit code</label>
                                <input
                                    id="email-verification-code"
                                    required
                                    value={verificationCode}
                                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    placeholder="000000"
                                    className="w-full rounded-2xl border border-transparent bg-[#efece6] px-5 py-4 text-center font-mono text-2xl tracking-[0.4em] outline-none transition-all focus:border-[#5c1111]/20 focus:bg-white"
                                />
                                <p className="px-1 text-xs text-stone-500">The code expires in 10 minutes.</p>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full bg-[#5c1111] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-[#2a2723] transition-colors disabled:cursor-wait disabled:opacity-60">
                                Verify Email
                            </button>
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                                <button type="button" onClick={handleResendVerificationCode} disabled={resendingVerificationCode} className="font-bold text-[#5c1111] disabled:opacity-50">
                                    {resendingVerificationCode ? 'Sending code...' : 'Resend code'}
                                </button>
                                <button type="button" onClick={() => { setAuthMode('login'); setError(''); setVerificationMessage(''); }} className="text-stone-500 hover:text-stone-900">
                                    Use another account
                                </button>
                            </div>
                        </div>
                    )}

                    {(isLogin || isRegister) && (
                        <>
                            {authMode === 'register' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-stone-400 pl-4">Your Full Name</label>
                                        <div className="relative">
                                            <UserIcon size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                            <input required value={name} title='Enter Your Full Name' onChange={e => setName(e.target.value)} type="text" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-stone-400 pl-4">Email Address</label>
                                        <div className="relative">
                                            <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                            <input required value={email} title='Enter Your E-mail Address' onChange={e => setEmail(e.target.value)} type="email" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="signup-gender" className="text-[10px] font-black uppercase text-stone-400 pl-4">Gender</label>
                                        <select id="signup-gender" required value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-2xl border border-transparent bg-[#efece6] px-5 py-4 font-medium outline-none transition-all focus:border-[#5c1111]/20 focus:bg-white">
                                            <option value="">Select your gender</option>
                                            <option value="female">Female</option>
                                            <option value="male">Male</option>
                                            <option value="non-binary">Non-binary</option>
                                            <option value="prefer-not-to-say">Prefer not to say</option>
                                        </select>
                                        <p className="px-1 text-[9px] text-stone-400">You can change this later in your profile.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-stone-400 pl-4">Phone Number</label>
                                        <div className="relative">
                                            <Phone size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                            <input value={phone} title='Enter Your Contact Number' onChange={e => setPhone(e.target.value)} type="tel" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-stone-400 pl-4">Address</label>
                                        <div className="relative">
                                            <MapPin size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                            <input value={address} title='Enter Your Address' onChange={e => setAddress(e.target.value)} type="text" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-stone-400 pl-4">City</label>
                                        <div className="relative">
                                            <MapPin size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                            <input value={city} title='Enter Your City' onChange={e => setCity(e.target.value)} type="text" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="account-username" className="text-[10px] font-black uppercase text-stone-400 pl-4">Username</label>
                                <div className="relative">
                                    <Sparkles size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input id="account-username" name="username" required value={username} title='Enter Your Username' onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck="false" type="text" className="w-full pl-12 pr-6 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="account-password" className="text-[10px] font-black uppercase text-stone-400 pl-4">Password</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input id="account-password" name="password" required value={password} title='Enter Your Password' onChange={e => setPassword(e.target.value)} autoComplete={isLogin ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} className="w-full pl-12 pr-12 py-4 bg-[#efece6] rounded-2xl outline-none focus:bg-white border border-transparent focus:border-[#5c1111]/20 transition-all font-medium" />
                                    <button
                                        type="button"
                                        className="login-page__password-toggle"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        aria-pressed={showPassword}
                                        onClick={() => setShowPassword((visible) => !visible)}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={isSubmitting} className="w-full bg-[#5c1111] text-white py-6 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.3em] shadow-2xl premium-shadow hover:bg-[#2a2723] hover:-translate-y-1 transition-all disabled:cursor-wait disabled:opacity-60">
                                {authMode === 'login' ? 'Sign in' : 'Create account'}
                            </button>

                            {/* Google Sign In option only for customer login or register */}
                            {(authMode === 'login' || authMode === 'register') && (
                                <div className="pt-4 border-t border-stone-200 mt-4 flex flex-col items-center">
                                    <p className="text-[10px] font-black uppercase text-stone-400 mb-4">Or continue with</p>
                                    <button
                                        type="button"
                                        onClick={handleGoogleLogin}
                                        className="w-full bg-white text-stone-600 border border-stone-200 py-4 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.2em] shadow-md hover:bg-stone-50 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 48 48" className="inline-block">
                                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                        </svg>
                                        Sign in with Google
                                    </button>
                                </div>
                            )}

                            <button type="button" onClick={() => {
                                setAuthMode(authMode === 'login' ? 'register' : 'login');
                                setError('');
                            }} className="login-page__mode-switch md:flex justify-center w-full text-[10px] font-black uppercase text-stone-400 hover:text-[#5c1111] transition-colors mt-6">
                                {authMode === 'login' ? (
                                    <>
                                        Not registered?
                                        <span className="text-blue-600 ml-1">Create new account here</span>
                                    </>
                                ) : (
                                    <>
                                        Already registered?
                                        <span className="text-blue-600 ml-1">Sign in</span>
                                    </>
                                )}
                                <ArrowRight size={16} />
                            </button>
                        </>
                    )}
                </form>
                </section>
            </div>
        </div>
    );
};
