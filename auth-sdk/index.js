class SocialAuthSDK {
  constructor(config) {
    this.cfg = config;
    this.providers = ['google', 'kakao', 'facebook', 'naver', 'apple'];
    this.maxAttempts = 500;
    this.attemptCount = 0;
    this.observer = null;
  }

  init() {
    this.setupDelegatedClicks();
    this.setupMutationObserver();
    this.waitForReactRoot();
  }

  waitForReactRoot() {
    const tryInit = () => {
      const root = document.getElementById('root');
      const hasButton = root && root.querySelector('button[id^="login-"]');
      this.attemptCount++;

      if (hasButton) {
        return;
      }

      if (this.attemptCount >= this.maxAttempts) {
        console.warn('[SDK] No login buttons found after waiting.');
        return;
      }

      requestAnimationFrame(tryInit);
    };

    tryInit();
  }

  setupDelegatedClicks() {
    if (this._delegationBound) return;
    this._delegationBound = true;

    this.clickHandler = (e) => {
      const target = e.target.closest('button[id^="login-"]');
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const provider = target.id.replace('login-', '');
      if (!this.providers.includes(provider)) return;

      console.log('[SDK] Login button clicked:', provider);
      this.login(provider);
    };

    document.addEventListener('click', this.clickHandler, true);
  }

  verifyButtons() {
    const root = document.getElementById('root');
    const buttons = root?.querySelectorAll('button[id^="login-"]');
    if (buttons && buttons.length > 0) {
      console.log(`[SDK] Found ${buttons.length} login button(s), event delegation is active.`);
      return true;
    }
    return false;
  }

  setupMutationObserver() {
    if (this.observer) return;
    
    const root = document.getElementById('root');
    if (!root) {
      setTimeout(() => this.setupMutationObserver(), 100);
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      let hasLoginButton = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          hasLoginButton = Array.from(mutation.addedNodes).some(
            (node) => node.nodeType === 1 && (
              node.matches?.('button[id^="login-"]') ||
              node.querySelector?.('button[id^="login-"]')
            )
          );
          if (hasLoginButton) break;
        }
      }
      
      if (hasLoginButton) {
        this.verifyEventDelegation();
      }
    });

    this.observer.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  verifyEventDelegation() {
    if (!this._delegationBound) {
      console.warn('[SDK] Event delegation not bound, re-initializing...');
      this.setupDelegatedClicks();
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this._delegationBound && this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this._delegationBound = false;
      this.clickHandler = null;
    }
  }

  async login(provider) {
    const { clientIds, redirectUri } = this.cfg;
    const clientId = clientIds[provider];
    const kakaoSerect = clientIds['kakao_serect'];
    const state = provider === "kakao" ? encodeURIComponent(JSON.stringify({ provider, redirectUri, clientId, kakaoSerect })) :  encodeURIComponent(JSON.stringify({ provider }));

    const url = this.getAuthUrl(provider, clientId, redirectUri, state);

    const popup = window.open(
      url,
      '_blank',
      'width=480,height=640'
    );

    if (!popup) {
      alert('⚠️ 팝업이 차단되었습니다. 팝업을 허용해주세요.');
      return;
    }

    const onMessage = async (e) => {
      if (e.origin !== window.location.origin) return;
      if (!e.data?.__socialAuth || e.data.provider !== provider) return;

      const token = e.data.access_token;
      if (!token) return;

      const profile = await this.getProfile(provider, token);

      popup?.close();
      window.removeEventListener('message', onMessage);
    };

    window.addEventListener('message', onMessage);
  }

  getAuthUrl(provider, id, redirect, state) {
    const encodedRedirect = encodeURIComponent(redirect);
    switch (provider) {
      case 'google':
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${id}&redirect_uri=${encodedRedirect}&response_type=token&scope=profile email&state=${state}`;

      case 'kakao':
        return `https://kauth.kakao.com/oauth/authorize?client_id=${id}&redirect_uri=${encodedRedirect}&response_type=code&state=${state}`;

      case 'facebook':
        return `https://www.facebook.com/v13.0/dialog/oauth?client_id=${id}&redirect_uri=${encodedRedirect}&response_type=token&scope=email,public_profile&state=${state}`;

      case 'naver':
        return `https://nid.naver.com/oauth2.0/authorize?client_id=${id}&redirect_uri=${encodedRedirect}&response_type=token&state=${encodeURIComponent(state)}`;

      case 'apple':
        return `https://appleid.apple.com/auth/authorize?client_id=${id}&redirect_uri=${encodedRedirect}&response_type=token%20id_token&scope=name%20email&response_mode=fragment&state=${state}`;

      default:
        throw new Error('Unknown provider: ' + provider);
    }
  }

  async getProfile(provider, token) {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      if (provider === 'google')
        return (
          await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers })
        ).json();

      if (provider === 'kakao')
        return (
          await fetch('https://kapi.kakao.com/v2/user/me', { headers })
        ).json();

      if (provider === 'facebook')
        return (
          await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${token}`)
        ).json();

      if (provider === 'naver') {
        const res = await fetch('https://openapi.naver.com/v1/nid/me', { headers });
        const data = await res.json();
        return data.response;
      }

      if (provider === 'apple') {
        return { provider: 'apple', token };
      }
    } catch (err) {
      console.error(`[${provider}] fetchProfile error`, err);
      return null;
    }
  }
}

const sdk = new SocialAuthSDK({
  clientIds: {
    google: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    kakao: import.meta.env.VITE_KAKAO_REST_API_KEY,
    kakao_serect: import.meta.env.VITE_CLIENT_SERECT,
    facebook: import.meta.env.VITE_FACEBOOK_APP_ID,
    naver: import.meta.env.VITE_NAVER_CLIENT_ID,
    apple: import.meta.env.VITE_APPLE_CLIENT_ID, 
  },
  redirectUri: `${window.location.origin}/callback.html`,
});

sdk.init();
window.socialAuth = sdk;
console.log('[SDK] SocialAuth auto initialized');
