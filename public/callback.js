const API_BASE = "VITE_BASE44_BACKEND_URL";

export async function handleSocialCallback() {
  try {

    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.substring(1));

    const params = { ...Object.fromEntries(search.entries()), ...Object.fromEntries(hash.entries()) };

    let provider = params.provider;
    let redirectUri = "";
    if (!provider && params.state) {
      try {
        const stateObj = JSON.parse(decodeURIComponent(params.state));
        provider = stateObj.provider;
        redirectUri = stateObj.redirectUri;
      } catch (err) {
        console.warn("⚠️ state 파싱 오류:", err);
      }
    }

    const accessToken = params.access_token;
    const idToken = params.id_token;
    const authCode = params.code;

    if (!provider) {
      showError("⚠️ 제공자(provider)를 확인할 수 없습니다.");
      return;
    }

    if (!accessToken && !idToken && !authCode) {
      showError("⚠️ 토큰 또는 코드 정보가 없습니다.");
      return;
    }

    let userInfo = null;
    if (provider === "apple" && idToken) {
      userInfo = decodeAppleToken(idToken);
    }

    const apiUrl = `${API_BASE}/auth/login`;
    const payload = {
      provider_type: provider,
      provider_token: accessToken || idToken || authCode,
    };

    if (redirectUri && provider === "kakao") {
      payload.redirect_uri = redirectUri;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`❌ 백엔드 로그인 요청 실패 (${response.status})`);
    }

    const result = await response.json();
    const backendToken = result?.data?.access_token;

    if (!backendToken) {
      throw new Error("⚠️ 백엔드에서 access_token을 받지 못했습니다.");
    }

    if (window.opener) {
      try {
        window.opener.localStorage.setItem("access_token", backendToken);
        window.opener.postMessage(
          {
            __socialAuth: true,
            provider,
            ok: true,
            backendToken,
            user: result?.data?.user || userInfo,
          },
          "*"
        );
        window.opener.location.href = "/";
        showSuccess("✅ 로그인 성공! 잠시 후 창이 닫힙니다...");
        setTimeout(() => window.close(), 1000);
      } catch (err) {
        console.warn("⚠️ 토큰 저장 실패:", err);
        showError("⚠️ 부모 창에 토큰을 저장할 수 없습니다.");
      }
    } else {
      showError("⚠️ 부모 창을 찾을 수 없습니다. 팝업 로그인으로 다시 시도해주세요.");
    }
  } catch (e) {
    console.error("❌ 소셜 로그인 콜백 오류:", e);

    if (window.opener) {
      window.opener.postMessage({ __socialAuth: true, ok: false, error: e.message }, "*");
    }

    showError(`${e.message}`);
    setTimeout(() => window.close(), 5000);
  }
}
function decodeAppleToken(idToken) {
  try {
    const [header, payload] = idToken.split(".");
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name || decoded.given_name,
    };
  } catch {
    return null;
  }
}

function showSuccess(message) {
  document.body.innerHTML = `
    <div style="font-family: system-ui; text-align: center; margin-top: 60px;">
      <div style="display:inline-block;padding:16px 24px;border-radius:8px;background:#ecfdf5;">
        <h2 style="color:#16a34a;margin-bottom:8px;">${message}</h2>
        <p style="color:#374151;">잠시만 기다려주세요...</p>
      </div>
    </div>`;
}

function showError(message) {
  document.body.innerHTML = `
    <div style="font-family: system-ui; text-align: center; margin-top: 60px;">
      <div style="display:inline-block;padding:16px 24px;border-radius:8px;background:#fef2f2;">
        <h2 style="color:#dc2626;margin-bottom:8px;">${message}</h2>
      </div>
    </div>`;
}


