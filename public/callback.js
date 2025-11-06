const API_BASE = "VITE_BASE44_BACKEND_URL";

export async function handleSocialCallback() {
  try {
    const hash = new URLSearchParams(window.location.hash.substring(1));
    const params = Object.fromEntries(hash.entries());
    const search = new URLSearchParams(window.location.search);

    let provider = search.get("provider") || params.provider;
    if (!provider && params.state) {
      try {
        const stateObj = JSON.parse(decodeURIComponent(params.state));
        provider = stateObj.provider;
      } catch (err) {
        console.warn("⚠️ state parse error:", err);
      }
    }

    const accessToken = params.access_token;
    const idToken = params.id_token;

    if (!provider || (!accessToken && !idToken)) {
      document.body.innerText = "⚠️ 액세스 토큰 또는 제공자 정보가 없습니다.";
      return;
    }

    let userInfo = null;

    if (provider === "apple" && idToken) {
      userInfo = decodeAppleToken(idToken);
    }

    const apiUrl = `${API_BASE}/auth/login`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_type: provider,
        provider_token: accessToken || idToken, 
        profile: userInfo, 
      }),
    });

    if (!response.ok) {
      throw new Error("백엔드 로그인 요청에 실패했습니다.");
    }

    const result = await response.json();
    const backendToken = result?.data?.access_token;

    if (window.opener) {
      try {
        window.opener.localStorage.setItem("access_token", backendToken);
        window.opener.location.href = "/";
      } catch (err) {
        console.warn("⚠️ Cannot save token or redirect parent:", err);
      }

      window.opener.postMessage(
        {
          __socialAuth: true,
          provider,
          ok: true,
          backendToken,
          user: result?.data?.user || userInfo,
        },
        window.location.origin
      );

      document.body.innerHTML = `
        <div style="font-family: system-ui, sans-serif; text-align: center; margin-top: 60px;">
          <div style="display:inline-block;padding:16px 24px;border-radius:8px;background:#ecfdf5;">
            <h2 style="color:#16a34a;margin-bottom:8px;">✅ 로그인 성공</h2>
            <p style="color:#374151;">토큰이 저장되었습니다. 잠시 후 페이지가 새로고침됩니다...</p>
          </div>
        </div>
      `;

      setTimeout(() => window.close(), 1200);
    } else {
      document.body.innerHTML = `
        <div style="font-family:sans-serif;text-align:center;margin-top:40px;">
          <div style="display:inline-block;padding:16px 24px;border-radius:8px;background:#fffbeb;">
            <h2 style="color:#d97706;margin-bottom:8px;">⚠️ 부모 창을 찾을 수 없습니다.</h2>
            <p style="color:#374151;">로그인 팝업이 아닌 새 탭에서 열렸을 수 있습니다.</p>
            <p style="color:#6b7280;">이 창을 닫고 다시 시도하세요.</p>
          </div>
        </div>
      `;
    }
  } catch (e) {
    console.error("소셜 로그인 콜백 오류:", e);

    if (window.opener) {
      window.opener.postMessage(
        { __socialAuth: true, ok: false, error: e.message },
        window.location.origin
      );
    }

    document.body.innerHTML = `
      <div style="font-family: system-ui, sans-serif; text-align: center; margin-top: 60px;">
        <div style="display:inline-block;padding:16px 24px;border-radius:8px;background:#fef2f2;">
          <h2 style="color:#dc2626;margin-bottom:8px;">❌ 로그인 실패</h2>
          <p style="color:#374151;">${e.message}</p>
          <p style="color:#6b7280;font-size:14px;">잠시 후 창이 닫힙니다...</p>
        </div>
      </div>
    `;
    setTimeout(() => window.close(), 5000);
  }
}

function decodeAppleToken(idToken) {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) throw new Error("Invalid id_token format");
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload["given_name"],
    };
  } catch (err) {
    return null;
  }
}
