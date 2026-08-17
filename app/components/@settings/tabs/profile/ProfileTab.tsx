import { useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { profileStore, updateProfile } from '~/lib/stores/profile';
import { authStore, signInWithPassword, signUpWithPassword, signOut } from '~/lib/stores/auth';
import { entitlementTierStore } from '~/lib/stores/entitlement';
import { toast } from 'react-toastify';
import { debounce } from '~/utils/debounce';

function AccountSection() {
  const auth = useStore(authStore);
  const tier = useStore(entitlementTierStore);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const inputClasses = classNames(
    'w-full px-4 py-2.5 rounded-xl',
    'bg-white dark:bg-gray-800/50',
    'border border-gray-200 dark:border-gray-700/50',
    'text-gray-900 dark:text-white',
    'placeholder-gray-400 dark:placeholder-gray-500',
    'focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500/50',
    'transition-all duration-300 ease-out',
  );

  if (auth.status === 'unconfigured') {
    return (
      <div className="mb-8 p-4 rounded-xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          VELDRA account sign-in isn't configured in this build. Local profile data below still works; premium
          entitlement requires a signed-in account.
        </p>
      </div>
    );
  }

  if (auth.status === 'signed-in') {
    return (
      <div className="mb-8 p-4 rounded-xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{auth.user?.email}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tier: {tier}</p>
          </div>
          <button
            onClick={() => void signOut()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (!email || !password) {
      return;
    }

    void (mode === 'signin' ? signInWithPassword(email, password) : signUpWithPassword(email, password));
  };

  return (
    <div className="mb-8 space-y-3">
      <label className="block text-base font-medium text-gray-900 dark:text-gray-100">VELDRA Account</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className={inputClasses}
        disabled={auth.status === 'loading'}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className={inputClasses}
        disabled={auth.status === 'loading'}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {auth.error && <p className="text-sm text-red-500">{auth.error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={auth.status === 'loading'}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors disabled:opacity-50"
        >
          {auth.status === 'loading' ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-accent-500 transition-colors"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}

export default function ProfileTab() {
  const profile = useStore(profileStore);
  const [isUploading, setIsUploading] = useState(false);

  // Create debounced update functions
  const debouncedUpdate = useCallback(
    debounce((field: 'username' | 'bio', value: string) => {
      updateProfile({ [field]: value });
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated`);
    }, 1000),
    [],
  );

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsUploading(true);

      // Convert the file to base64
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateProfile({ avatar: base64String });
        setIsUploading(false);
        toast.success('Profile picture updated');
      };

      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
        setIsUploading(false);
        toast.error('Failed to update profile picture');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setIsUploading(false);
      toast.error('Failed to update profile picture');
    }
  };

  const handleProfileUpdate = (field: 'username' | 'bio', value: string) => {
    // Update the store immediately for UI responsiveness
    updateProfile({ [field]: value });

    // Debounce the toast notification
    debouncedUpdate(field, value);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-6">
        <AccountSection />

        {/* Personal Information Section */}
        <div>
          {/* Avatar Upload */}
          <div className="flex items-start gap-6 mb-8">
            <div
              className={classNames(
                'w-24 h-24 rounded-full overflow-hidden',
                'bg-gray-100 dark:bg-gray-800/50',
                'flex items-center justify-center',
                'ring-1 ring-gray-200 dark:ring-gray-700',
                'relative group',
                'transition-all duration-300 ease-out',
                'hover:ring-accent-500/30 dark:hover:ring-accent-500/30',
                'hover:shadow-lg hover:shadow-accent-500/10',
              )}
            >
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Profile"
                  className={classNames(
                    'w-full h-full object-cover',
                    'transition-all duration-300 ease-out',
                    'group-hover:scale-105 group-hover:brightness-90',
                  )}
                />
              ) : (
                <div className="i-ph:robot-fill w-16 h-16 text-gray-400 dark:text-gray-500 transition-colors group-hover:text-accent-500/70 transform -translate-y-1" />
              )}

              <label
                className={classNames(
                  'absolute inset-0',
                  'flex items-center justify-center',
                  'bg-black/0 group-hover:bg-black/40',
                  'cursor-pointer transition-all duration-300 ease-out',
                  isUploading ? 'cursor-wait' : '',
                )}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="i-ph:spinner-gap w-6 h-6 text-white animate-spin" />
                ) : (
                  <div className="i-ph:camera-plus w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out transform group-hover:scale-110" />
                )}
              </label>
            </div>

            <div className="flex-1 pt-1">
              <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                Profile Picture
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload a profile picture or avatar</p>
            </div>
          </div>

          {/* Username Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Username</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <div className="i-ph:user-circle-fill w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors group-focus-within:text-accent-500" />
              </div>
              <input
                type="text"
                value={profile.username}
                onChange={(e) => handleProfileUpdate('username', e.target.value)}
                className={classNames(
                  'w-full pl-11 pr-4 py-2.5 rounded-xl',
                  'bg-white dark:bg-gray-800/50',
                  'border border-gray-200 dark:border-gray-700/50',
                  'text-gray-900 dark:text-white',
                  'placeholder-gray-400 dark:placeholder-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500/50',
                  'transition-all duration-300 ease-out',
                )}
                placeholder="Enter your username"
              />
            </div>
          </div>

          {/* Bio Input */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Bio</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-3">
                <div className="i-ph:text-aa w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors group-focus-within:text-accent-500" />
              </div>
              <textarea
                value={profile.bio}
                onChange={(e) => handleProfileUpdate('bio', e.target.value)}
                className={classNames(
                  'w-full pl-11 pr-4 py-2.5 rounded-xl',
                  'bg-white dark:bg-gray-800/50',
                  'border border-gray-200 dark:border-gray-700/50',
                  'text-gray-900 dark:text-white',
                  'placeholder-gray-400 dark:placeholder-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500/50',
                  'transition-all duration-300 ease-out',
                  'resize-none',
                  'h-32',
                )}
                placeholder="Tell us about yourself"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
